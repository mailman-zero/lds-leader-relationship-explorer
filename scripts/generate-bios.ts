/**
 * Two-phase biography pipeline for LDS leaders.
 *
 * Phase 1 — Haiku: fetch Wikipedia text, extract structured facts as JSON.
 * Phase 2 — Sonnet: turn facts into polished prose paragraphs.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node --experimental-strip-types scripts/generate-bios.ts
 *
 * Optional flags:
 *   --id joseph-smith-jr-1805   run for a single person ID
 *   --concurrency 8             parallel calls per phase (default 8)
 *   --skip-existing             skip leaders already present in biographies.json
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Person {
  id: string;
  display_name: string;
  full_name: string;
  birth_date: string;
  birth_place?: string;
  death_date: string | null;
  death_place?: string | null;
  is_leader: boolean;
  sources: { url: string }[];
}

export interface BiographySpouse {
  name: string;
  marriage_date: string | null;
  marriage_end_date: string | null;
  marriage_end_reason: "death" | "divorce" | null;
}

export interface Biography {
  person_id: string;
  life_summary: string;
  church_summary: string;
  born: string | null;
  birth_place: string | null;
  died: string | null;
  death_place: string | null;
  burial_place: string | null;
  find_a_grave_url: string | null;
  spouses: BiographySpouse[];
  mission: { location: string; years: string } | null;
  notable_companions: string[];
  temples_dedicated: string[];
  teaching_emphasis: string[];
  generated_at: string;
  wikipedia_url: string | null;
}

interface RawFacts {
  born: string | null;
  birth_place: string | null;
  died: string | null;
  death_place: string | null;
  burial_place: string | null;
  find_a_grave_url: string | null;
  spouses: BiographySpouse[];
  mission: { location: string; years: string } | null;
  notable_companions: string[];
  temples_dedicated: string[];
  teaching_emphasis: string[];
  career_notes: string;
  church_service_notes: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, "..");
const PEOPLE_PATH = resolve(ROOT, "data", "people.json");
const OUTPUT_PATH = resolve(ROOT, "public", "data", "biographies.json");

const args = process.argv.slice(2);
const singleId = args.includes("--id") ? args[args.indexOf("--id") + 1] : null;
const concurrency = args.includes("--concurrency")
  ? parseInt(args[args.indexOf("--concurrency") + 1], 10)
  : 8;
const skipExisting = args.includes("--skip-existing");

const client = new Anthropic();

// ─── Wikipedia fetch ──────────────────────────────────────────────────────────

function extractWikiTitle(url: string): string | null {
  const m = url.match(/wikipedia\.org\/wiki\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function fetchWikipediaText(title: string): Promise<string | null> {
  const encoded = encodeURIComponent(title);
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}` +
    `&prop=extracts&explaintext=true&exsectionformat=plain&exlimit=1&format=json&formatversion=2`;

  const res = await fetch(url, {
    headers: { "User-Agent": "LDS-Leader-Explorer/1.0 (educational project)" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    query: { pages: { extract?: string }[] };
  };
  const page = json.query?.pages?.[0];
  return page?.extract ?? null;
}

// ─── Phase 1: Haiku fact extraction ──────────────────────────────────────────

const EXTRACT_SYSTEM = `You extract structured biographical facts from Wikipedia articles about LDS Church leaders.
Return ONLY a valid JSON object with exactly these keys (use null for unknown fields):
{
  "born": "YYYY-MM-DD or descriptive string or null",
  "birth_place": "City, State/Country or null",
  "died": "YYYY-MM-DD or descriptive string or null",
  "death_place": "City, State/Country or null",
  "burial_place": "Cemetery name, City, State or null",
  "find_a_grave_url": "full findagrave.com URL if mentioned in the article or null",
  "spouses": [
    {
      "name": "Full Name",
      "marriage_date": "YYYY-MM-DD or year string or null",
      "marriage_end_date": "YYYY-MM-DD or year string or null",
      "marriage_end_reason": "death | divorce | null"
    }
  ],
  "mission": { "location": "Country or region", "years": "YYYY–YYYY" } or null,
  "notable_companions": ["Name if a later-notable person served with them"],
  "temples_dedicated": ["Temple Name (year)"],
  "teaching_emphasis": ["3-6 word phrase describing a key theme"],
  "career_notes": "Bullet-point notes on occupation, education, military service, civic roles OUTSIDE the church. Keep factual, 100-250 words.",
  "church_service_notes": "Bullet-point notes on mission, calling sequence, years served in each position, notable acts, general conference themes. 100-250 words."
}
Do not include any text outside the JSON object.`;

async function extractFacts(
  person: Person,
  wikiText: string
): Promise<RawFacts | null> {
  const truncated = wikiText.slice(0, 12000);
  const prompt = `Extract biographical facts about ${person.full_name} from this Wikipedia article.\n\n${truncated}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: EXTRACT_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as RawFacts;
  } catch {
    return null;
  }
}

// ─── Phase 2: Sonnet prose generation ────────────────────────────────────────

const PROSE_SYSTEM = `You write concise, engaging biographical text for an educational web app about LDS Church leaders.
Your tone is respectful, factual, and suitable for a general audience interested in history.
Write in third person. Do not use headers or bullet points — flowing prose only.
Avoid starting consecutive sentences with the same word.`;

async function generateProse(
  person: Person,
  facts: RawFacts
): Promise<{ life_summary: string; church_summary: string }> {
  const factsJson = JSON.stringify(facts, null, 2);
  const prompt = `Write biographical text about ${person.full_name} based on these facts:

${factsJson}

Produce exactly two fields:
1. life_summary: 1–2 paragraphs (120–220 words) covering their life OUTSIDE the Church — upbringing, education, career, family life, notable secular accomplishments.
2. church_summary: 1 paragraph (80–140 words) summarizing their Church service — mission, callings, years of service, any temples dedicated, any signature teaching themes or programs they championed.

Return ONLY a JSON object: { "life_summary": "...", "church_summary": "..." }`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: PROSE_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return { life_summary: text.trim(), church_summary: "" };
    }
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch {
    return {
      life_summary: facts.career_notes ?? "",
      church_summary: facts.church_service_notes ?? "",
    };
  }
}

// ─── Concurrency helper ───────────────────────────────────────────────────────

async function pMap<T, R>(
  items: T[],
  fn: (item: T, i: number) => Promise<R>,
  limit: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const people: Person[] = JSON.parse(readFileSync(PEOPLE_PATH, "utf-8"));
  let leaders = people.filter((p) => p.is_leader);
  if (singleId) leaders = leaders.filter((p) => p.id === singleId);

  const existing: Record<string, Biography> = existsSync(OUTPUT_PATH)
    ? JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"))
    : {};

  if (skipExisting) {
    leaders = leaders.filter((p) => !(p.id in existing));
    console.log(`Skipping ${Object.keys(existing).length} existing — processing ${leaders.length} remaining`);
  } else {
    console.log(`Processing ${leaders.length} leaders`);
  }

  if (leaders.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // ── Phase 1: Wikipedia fetch + Haiku extraction ──
  console.log("\n── Phase 1: Haiku fact extraction ──");
  const factsMap = new Map<string, { facts: RawFacts; wikiUrl: string }>();

  await pMap(leaders, async (person, i) => {
    const wikiSource = person.sources.find((s) =>
      s.url.includes("wikipedia.org")
    );
    if (!wikiSource) {
      console.log(`  [${i + 1}/${leaders.length}] ${person.display_name} — no Wikipedia source, skipping`);
      return;
    }

    const title = extractWikiTitle(wikiSource.url);
    if (!title) {
      console.log(`  [${i + 1}/${leaders.length}] ${person.display_name} — could not parse Wikipedia title`);
      return;
    }

    const wikiText = await fetchWikipediaText(title);
    if (!wikiText) {
      console.log(`  [${i + 1}/${leaders.length}] ${person.display_name} — Wikipedia fetch failed`);
      return;
    }

    const facts = await extractFacts(person, wikiText);
    if (!facts) {
      console.log(`  [${i + 1}/${leaders.length}] ${person.display_name} — Haiku extraction failed`);
      return;
    }

    factsMap.set(person.id, { facts, wikiUrl: wikiSource.url });
    console.log(`  [${i + 1}/${leaders.length}] ${person.display_name} ✓`);
  }, concurrency);

  // ── Phase 2: Sonnet prose generation ──
  console.log("\n── Phase 2: Sonnet prose generation ──");
  const readyLeaders = leaders.filter((p) => factsMap.has(p.id));

  await pMap(readyLeaders, async (person, i) => {
    const { facts, wikiUrl } = factsMap.get(person.id)!;
    const prose = await generateProse(person, facts);

    const bio: Biography = {
      person_id: person.id,
      life_summary: prose.life_summary,
      church_summary: prose.church_summary,
      born: facts.born,
      birth_place: facts.birth_place,
      died: facts.died,
      death_place: facts.death_place,
      burial_place: facts.burial_place,
      find_a_grave_url: facts.find_a_grave_url,
      spouses: facts.spouses ?? [],
      mission: facts.mission ?? null,
      notable_companions: facts.notable_companions ?? [],
      temples_dedicated: facts.temples_dedicated ?? [],
      teaching_emphasis: facts.teaching_emphasis ?? [],
      generated_at: new Date().toISOString(),
      wikipedia_url: wikiUrl,
    };

    existing[person.id] = bio;
    console.log(`  [${i + 1}/${readyLeaders.length}] ${person.display_name} ✓`);
  }, concurrency);

  writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 2));
  console.log(`\nWrote ${Object.keys(existing).length} biographies → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
