/**
 * Build data/temples.json from the Wikipedia article
 *   "List of temples of The Church of Jesus Christ of Latter-day Saints"
 *
 * Pipeline:
 *  1. Fetch the article via Wikipedia API (plain-text extract).
 *  2. Split into manageable chunks and ask Haiku to extract structured rows.
 *  3. Resolve `dedicated_by` strings to person_ids by matching against people.json.
 *  4. Write data/temples.json and public/data/temples.json.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node --experimental-strip-types scripts/generate-temples.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

interface PersonLite {
  id: string;
  display_name: string;
  full_name: string;
}

interface ExtractedRow {
  name: string;
  location: string | null;
  dedication_date: string | null;
  dedicated_by: string | null;
  rededication_date: string | null;
  rededicated_by: string | null;
}

interface TempleRecord {
  id: string;
  name: string;
  location: string | null;
  dedication_date: string;
  dedicated_by: string | null;
  type: "dedication" | "rededication";
  sources: { url: string; accessed: string }[];
}

const ROOT = resolve(import.meta.dirname, "..");
const PEOPLE_PATH = resolve(ROOT, "data", "people.json");
const OUT_DATA = resolve(ROOT, "data", "temples.json");
const OUT_PUBLIC = resolve(ROOT, "public", "data", "temples.json");
const WIKI_URL = "https://en.wikipedia.org/wiki/List_of_temples_of_The_Church_of_Jesus_Christ_of_Latter-day_Saints";

const client = new Anthropic();

async function fetchWikipedia(title: string): Promise<string> {
  const encoded = encodeURIComponent(title);
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}` +
    `&prop=extracts&explaintext=true&exsectionformat=plain&exlimit=1&format=json&formatversion=2`;
  const res = await fetch(url, {
    headers: { "User-Agent": "LDS-Leader-Explorer/1.0 (educational project)" },
  });
  if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`);
  const json = (await res.json()) as { query: { pages: { extract?: string }[] } };
  const extract = json.query?.pages?.[0]?.extract;
  if (!extract) throw new Error("No extract returned");
  return extract;
}

const EXTRACT_SYSTEM = `You extract temple dedication records from text describing temples of The Church of Jesus Christ of Latter-day Saints.

Return ONLY a JSON array. Each element is one temple with this exact shape:
{
  "name": "Salt Lake Temple",
  "location": "Salt Lake City, Utah, United States",
  "dedication_date": "YYYY-MM-DD",
  "dedicated_by": "Full name of dedicator (e.g. 'Wilford Woodruff')",
  "rededication_date": "YYYY-MM-DD or null",
  "rededicated_by": "Full name or null"
}

Rules:
- Only include temples that have been dedicated (skip announced/under construction).
- Use ISO YYYY-MM-DD for dates. If only year is known, use YYYY-01-01 and note it in dedicated_by as null.
- If multiple rededications exist, include only the most recent.
- Do not invent dedicators or dates. Use null when unknown.
- Do not include any text outside the JSON array.`;

async function extractChunk(chunk: string): Promise<ExtractedRow[]> {
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: `Extract temples from this text:\n\n${chunk}` }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    return JSON.parse(text.slice(start, end + 1)) as ExtractedRow[];
  } catch (err) {
    console.warn("  JSON parse failed for chunk:", err);
    return [];
  }
}

function chunkText(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + maxChars, text.length);
    if (end < text.length) {
      // Try to break on a paragraph
      const lastBreak = text.lastIndexOf("\n\n", end);
      if (lastBreak > i + maxChars / 2) end = lastBreak;
    }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNameIndex(people: PersonLite[]): Map<string, string> {
  // Map normalized name → person_id. Index both display_name and full_name,
  // plus a "first last" stripped-middle variant.
  const index = new Map<string, string>();
  for (const p of people) {
    for (const candidate of [p.display_name, p.full_name]) {
      if (!candidate) continue;
      const norm = normalize(candidate);
      if (!index.has(norm)) index.set(norm, p.id);

      // Strip middle initials/names: "Russell M Nelson" → "russell nelson"
      const tokens = norm.split(" ").filter((t) => !/^[a-z]\.?$/.test(t));
      if (tokens.length >= 2) {
        const firstLast = `${tokens[0]} ${tokens[tokens.length - 1]}`;
        if (!index.has(firstLast)) index.set(firstLast, p.id);
      }
    }
  }
  return index;
}

function resolveDedicator(name: string | null, index: Map<string, string>): string | null {
  if (!name) return null;
  const norm = normalize(name);
  if (index.has(norm)) return index.get(norm)!;

  const tokens = norm.split(" ").filter((t) => !/^[a-z]\.?$/.test(t));
  if (tokens.length >= 2) {
    const firstLast = `${tokens[0]} ${tokens[tokens.length - 1]}`;
    if (index.has(firstLast)) return index.get(firstLast)!;
  }
  return null;
}

function templeIdFrom(name: string, date: string): string {
  const slug = name
    .toLowerCase()
    .replace(/temple$/i, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const year = date.slice(0, 4);
  return `${slug}-${year}`;
}

async function main() {
  console.log("Fetching Wikipedia article…");
  const text = await fetchWikipedia("List of temples of The Church of Jesus Christ of Latter-day Saints");
  console.log(`  ${text.length.toLocaleString()} chars`);

  const people: PersonLite[] = JSON.parse(readFileSync(PEOPLE_PATH, "utf-8"));
  const nameIndex = buildNameIndex(people);
  console.log(`Loaded ${people.length} people; ${nameIndex.size} name variants indexed`);

  const chunks = chunkText(text, 11000);
  console.log(`\nExtracting from ${chunks.length} chunk(s) via Haiku…`);

  const all: ExtractedRow[] = [];
  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`  chunk ${i + 1}/${chunks.length} `);
    const rows = await extractChunk(chunks[i]);
    process.stdout.write(`→ ${rows.length} rows\n`);
    all.push(...rows);
  }

  // Dedup by name+dedication_date
  const seen = new Set<string>();
  const records: TempleRecord[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const unresolved = new Set<string>();

  for (const row of all) {
    if (!row.name || !row.dedication_date) continue;
    const key = `${row.name}|${row.dedication_date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const dedicatedBy = resolveDedicator(row.dedicated_by, nameIndex);
    if (row.dedicated_by && !dedicatedBy) unresolved.add(row.dedicated_by);

    records.push({
      id: templeIdFrom(row.name, row.dedication_date),
      name: row.name,
      location: row.location,
      dedication_date: row.dedication_date,
      dedicated_by: dedicatedBy,
      type: "dedication",
      sources: [{ url: WIKI_URL, accessed: today }],
    });

    if (row.rededication_date) {
      const rededKey = `${row.name}|${row.rededication_date}|red`;
      if (seen.has(rededKey)) continue;
      seen.add(rededKey);
      const rededBy = resolveDedicator(row.rededicated_by, nameIndex);
      if (row.rededicated_by && !rededBy) unresolved.add(row.rededicated_by);
      records.push({
        id: `${templeIdFrom(row.name, row.rededication_date)}-rededication`,
        name: row.name,
        location: row.location,
        dedication_date: row.rededication_date,
        dedicated_by: rededBy,
        type: "rededication",
        sources: [{ url: WIKI_URL, accessed: today }],
      });
    }
  }

  records.sort((a, b) => a.dedication_date.localeCompare(b.dedication_date));

  writeFileSync(OUT_DATA, JSON.stringify(records, null, 2));
  writeFileSync(OUT_PUBLIC, JSON.stringify(records, null, 2));

  // Reporting
  const byPerson = new Map<string, number>();
  for (const r of records) {
    if (!r.dedicated_by) continue;
    byPerson.set(r.dedicated_by, (byPerson.get(r.dedicated_by) ?? 0) + 1);
  }
  const top = [...byPerson.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  console.log(`\nWrote ${records.length} records → ${OUT_DATA}`);
  console.log("\nTop dedicators:");
  for (const [pid, n] of top) {
    const person = people.find((p) => p.id === pid);
    console.log(`  ${n.toString().padStart(3)}  ${person?.display_name ?? pid}`);
  }
  if (unresolved.size) {
    console.log(`\n${unresolved.size} unresolved dedicator name(s):`);
    for (const n of unresolved) console.log(`  - ${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
