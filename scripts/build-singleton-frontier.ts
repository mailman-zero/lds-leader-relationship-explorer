/**
 * Build a "frontier" pedigree for each singleton — the set of ancestor and
 * in-law names worth matching against the existing graph.
 *
 * Phase 1 (Haiku): fetch Wikipedia, extract structured pedigree.
 * Phase 2 (Haiku): no prose — frontier is itself the deliverable.
 *
 * Output: data/frontiers/<leader_id>.json
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node --experimental-strip-types scripts/build-singleton-frontier.ts
 *
 * Flags:
 *   --id <leader_id>      run for a single leader (otherwise: all singletons)
 *   --concurrency 4       parallel calls (default 4 — Wikipedia is rate-limited)
 *   --skip-existing       skip leaders that already have a frontier file
 *   --include-connected   also build frontiers for leaders already in main cluster (useful for connector hunting)
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildGraph } from "../src/graph/builder.ts";
import type {
  Person,
  Relationship,
  LeadershipPosition,
} from "../src/graph/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PEOPLE_PATH = resolve(ROOT, "data/people.json");
const RELS_PATH = resolve(ROOT, "data/relationships.json");
const POS_PATH = resolve(ROOT, "data/leadership_positions.json");
const FRONTIER_DIR = resolve(ROOT, "data/frontiers");

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ancestor {
  name: string;
  birth_year: number | null;
  birth_place: string | null;
  death_year: number | null;
}

interface SpouseFrontier {
  name: string;
  marriage_year: number | null;
  grandparents: Ancestor[]; // up to 4
}

interface SiblingFrontier {
  name: string;
  spouse: string | null;
}

export interface Frontier {
  person_id: string;
  display_name: string;
  generated_at: string;
  wikipedia_url: string | null;
  pedigree: {
    grandparents: Ancestor[]; // up to 4
    great_grandparents: Ancestor[]; // up to 8
    great_great_grandparents: Ancestor[]; // up to 16
  };
  spouses: SpouseFrontier[];
  siblings: SiblingFrontier[];
  notes: string;
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const singleId = args.includes("--id") ? args[args.indexOf("--id") + 1] : null;
const concurrency = args.includes("--concurrency")
  ? parseInt(args[args.indexOf("--concurrency") + 1], 10)
  : 4;
const skipExisting = args.includes("--skip-existing");
const includeConnected = args.includes("--include-connected");

// ─── Load data + compute singletons ───────────────────────────────────────────

const people = JSON.parse(readFileSync(PEOPLE_PATH, "utf-8")) as Person[];
const relationships = JSON.parse(readFileSync(RELS_PATH, "utf-8")) as Relationship[];
const positions = JSON.parse(readFileSync(POS_PATH, "utf-8")) as LeadershipPosition[];
const graph = buildGraph(people, relationships, positions, []);

function computeSingletons(): Person[] {
  const parent = new Map<string, string>();
  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r)! !== r) r = parent.get(r)!;
    return r;
  }
  function union(a: string, b: string) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  }
  for (const [id, node] of graph.nodes) for (const e of node.edges) union(id, e.to_id);

  const clusters = new Map<string, Person[]>();
  for (const p of people.filter((p) => p.is_leader)) {
    const root = find(p.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(p);
  }
  const sorted = [...clusters.values()].sort((a, b) => b.length - a.length);
  const main = new Set(sorted[0].map((p) => p.id));
  return people.filter(
    (p) => p.is_leader && (includeConnected || !main.has(p.id))
  );
}

const targets: Person[] = singleId
  ? people.filter((p) => p.id === singleId)
  : computeSingletons();

if (!existsSync(FRONTIER_DIR)) mkdirSync(FRONTIER_DIR, { recursive: true });

let toProcess = targets;
if (skipExisting) {
  toProcess = toProcess.filter(
    (p) => !existsSync(resolve(FRONTIER_DIR, `${p.id}.json`))
  );
}

console.log(`Processing ${toProcess.length} leader(s) (concurrency=${concurrency})`);
if (toProcess.length === 0) process.exit(0);

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
  return json.query?.pages?.[0]?.extract ?? null;
}

// ─── Pedigree extraction prompt ──────────────────────────────────────────────

const SYSTEM = `You extract structured genealogical data from Wikipedia articles about LDS Church leaders. Your job is to surface NAMES of ancestors and in-laws that could potentially be matched against other LDS leaders' families.

Return ONLY a valid JSON object with this exact shape (use null for unknown fields, empty arrays if no entries):
{
  "pedigree": {
    "grandparents": [{"name": "Full Name", "birth_year": 1850, "birth_place": "Town, State", "death_year": 1920}],
    "great_grandparents": [{"name": "...", "birth_year": null, "birth_place": null, "death_year": null}],
    "great_great_grandparents": []
  },
  "spouses": [
    {
      "name": "Full Maiden Name",
      "marriage_year": 1900,
      "grandparents": [{"name": "Full Name of spouse's grandparent", "birth_year": null, "birth_place": null, "death_year": null}]
    }
  ],
  "siblings": [
    {"name": "Full Name", "spouse": "Spouse Full Name or null"}
  ],
  "notes": "Free-text — anything notable about ancestry or in-laws, e.g. 'father was Norwegian immigrant, 1872' or 'mother's grandmother was Eliza Snow's niece'."
}

Rules:
- Include ALL named ancestors, even if dates are unknown. Names are the unit of search.
- For spouses, list every named spouse (plural marriages were common in 19th century leadership).
- For siblings, include FULL siblings and their spouses when named — sibling-in-laws are common bridge points.
- Do NOT fabricate. If Wikipedia does not mention a person, omit them. Empty array is fine.
- Do NOT include the leader themselves, their children, or their parents (parents are usually already in the dataset; we want grandparents and beyond).
- Birth/death years should be integers; null if unknown.
- Output ONLY the JSON object, no surrounding text.`;

async function extractFrontier(
  person: Person,
  wikiText: string
): Promise<Frontier | null> {
  const truncated = wikiText.slice(0, 14000);
  const prompt = `Extract pedigree and in-law names for ${person.full_name} from this Wikipedia article. Focus on grandparents and beyond; spouse families; full siblings and their spouses.\n\n${truncated}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    return {
      person_id: person.id,
      display_name: person.display_name,
      generated_at: new Date().toISOString(),
      wikipedia_url:
        person.sources.find((s) => s.url.includes("wikipedia.org"))?.url ?? null,
      pedigree: {
        grandparents: parsed.pedigree?.grandparents ?? [],
        great_grandparents: parsed.pedigree?.great_grandparents ?? [],
        great_great_grandparents: parsed.pedigree?.great_great_grandparents ?? [],
      },
      spouses: parsed.spouses ?? [],
      siblings: parsed.siblings ?? [],
      notes: parsed.notes ?? "",
    };
  } catch (e) {
    console.error(`  ${person.display_name}: extraction error:`, e);
    return null;
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
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await pMap(
    toProcess,
    async (person, i) => {
      const label = `[${i + 1}/${toProcess.length}] ${person.display_name}`;
      const wikiSource = person.sources.find((s) =>
        s.url.includes("wikipedia.org")
      );
      if (!wikiSource) {
        console.log(`${label} — no Wikipedia source, skip`);
        return;
      }
      const title = extractWikiTitle(wikiSource.url);
      if (!title) {
        console.log(`${label} — bad Wikipedia URL`);
        return;
      }
      const wikiText = await fetchWikipediaText(title);
      if (!wikiText) {
        console.log(`${label} — Wikipedia fetch failed`);
        return;
      }
      const frontier = await extractFrontier(person, wikiText);
      if (!frontier) {
        console.log(`${label} — extraction returned null`);
        return;
      }
      writeFileSync(
        resolve(FRONTIER_DIR, `${person.id}.json`),
        JSON.stringify(frontier, null, 2)
      );
      const count =
        frontier.pedigree.grandparents.length +
        frontier.pedigree.great_grandparents.length +
        frontier.pedigree.great_great_grandparents.length +
        frontier.spouses.reduce((n, s) => n + s.grandparents.length, 0) +
        frontier.siblings.length;
      console.log(`${label} ✓ ${count} frontier names`);
    },
    concurrency
  );

  console.log(`\nDone. Frontiers written to ${FRONTIER_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
