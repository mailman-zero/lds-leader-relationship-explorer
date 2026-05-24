/**
 * Match each singleton's frontier names against existing graph people to
 * surface candidate connections worth manual verification.
 *
 * Reads:  data/frontiers/<leader_id>.json (from build-singleton-frontier.ts)
 * Reads:  data/people.json, data/relationships.json
 * Writes: data/frontier-matches.json (per-singleton candidate report)
 * Prints: human-readable summary, ranked easiest-wins first
 *
 * Usage:
 *   node --experimental-strip-types scripts/match-frontier.ts
 *   node --experimental-strip-types scripts/match-frontier.ts --id <leader_id>
 *   node --experimental-strip-types scripts/match-frontier.ts --min-score 5
 *
 * Scoring:
 *   surname exact match            +3
 *   given-name token overlap       +1 per token (cap 2)
 *   birth year within ±2           +2
 *   birth year within ±5           +1
 *   birth-state match              +2
 *   birth-state mismatch           −2 (US regions differ by >1)
 *   year off >5 from expected slot −2
 *
 * JSJ plural-wives rule: candidate paths routing through Joseph Smith Jr.'s
 * spouses are de-prioritized (still listed, but flagged).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildGraph } from "../src/graph/builder.ts";
import type {
  Person,
  Relationship,
  LeadershipPosition,
} from "../src/graph/types.ts";
import type { Frontier } from "./build-singleton-frontier.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FRONTIER_DIR = resolve(ROOT, "data/frontiers");
const OUTPUT_PATH = resolve(ROOT, "data/frontier-matches.json");

const args = process.argv.slice(2);
const singleId = args.includes("--id") ? args[args.indexOf("--id") + 1] : null;
const minScore = args.includes("--min-score")
  ? parseInt(args[args.indexOf("--min-score") + 1], 10)
  : 4;

// ─── Load graph ───────────────────────────────────────────────────────────────

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf-8")) as T;
}

const people = loadJson<Person[]>("data/people.json");
const relationships = loadJson<Relationship[]>("data/relationships.json");
const positions = loadJson<LeadershipPosition[]>("data/leadership_positions.json");
const graph = buildGraph(people, relationships, positions, []);

// ─── JSJ plural-wives exclusion set ───────────────────────────────────────────

const JSJ_ID = "joseph-smith-jr-1805";
const jsjSpouseIds = new Set<string>();
for (const rel of relationships) {
  if (rel.type === "spouse") {
    if (rel.person_a_id === JSJ_ID) jsjSpouseIds.add(rel.person_b_id);
    if (rel.person_b_id === JSJ_ID) jsjSpouseIds.add(rel.person_a_id);
  }
}
// Emma Smith is JSJ's legal first wife — keep her in scope as a valid bridge.
jsjSpouseIds.delete("emma-hale-smith-1804");

// ─── Indexing helpers ─────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "jr", "sr", "ii", "iii", "iv", "the", "of", "von", "van", "de", "le", "mc",
]);

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[.,()'’]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t) && t.length > 1);
}

function surnameOf(name: string): string {
  const tokens = nameTokens(name);
  return tokens[tokens.length - 1] ?? "";
}

function givenTokensOf(name: string): string[] {
  const t = nameTokens(name);
  return t.slice(0, Math.max(0, t.length - 1));
}

function yearFromDate(d: string | null | undefined): number | null {
  if (!d) return null;
  const m = d.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

const US_REGION: Record<string, string> = {
  // New England
  ME: "NE", NH: "NE", VT: "NE", MA: "NE", RI: "NE", CT: "NE",
  // Mid-Atlantic
  NY: "MA", NJ: "MA", PA: "MA", DE: "MA", MD: "MA",
  // Old NW
  OH: "MW", IN: "MW", IL: "MW", MI: "MW", WI: "MW",
  // Plains
  IA: "PL", MN: "PL", MO: "PL", KS: "PL", NE: "PL", ND: "PL", SD: "PL",
  // Mormon corridor / Mountain
  UT: "MC", ID: "MC", WY: "MC", NV: "MC", AZ: "MC", CO: "MC", MT: "MC",
  // South
  VA: "S", WV: "S", NC: "S", SC: "S", GA: "S", FL: "S", AL: "S", MS: "S",
  TN: "S", KY: "S", AR: "S", LA: "S", TX: "S", OK: "S",
  // West coast
  CA: "WC", OR: "WC", WA: "WC", AK: "WC", HI: "WC",
};

function stateOf(place: string | null | undefined): string | null {
  if (!place) return null;
  const norm = place.toLowerCase();
  // Look for two-letter state codes OR full state names
  const map: [RegExp, string][] = [
    [/\butah\b|\but\b/i, "UT"],
    [/\bidaho\b|\bid\b/i, "ID"],
    [/\bvermont\b|\bvt\b/i, "VT"],
    [/\bmassachusetts\b|\bma\b/i, "MA"],
    [/\bnew hampshire\b|\bnh\b/i, "NH"],
    [/\bnew york\b|\bny\b/i, "NY"],
    [/\bpennsylvania\b|\bpa\b/i, "PA"],
    [/\bohio\b|\boh\b/i, "OH"],
    [/\billinois\b|\bil\b/i, "IL"],
    [/\bmissouri\b|\bmo\b/i, "MO"],
    [/\biowa\b|\bia\b/i, "IA"],
    [/\bvirginia\b|\bva\b/i, "VA"],
    [/\btennessee\b|\btn\b/i, "TN"],
    [/\bconnecticut\b|\bct\b/i, "CT"],
    [/\bmaine\b|\bme\b/i, "ME"],
    [/\barizona\b|\baz\b/i, "AZ"],
    [/\bcalifornia\b|\bca\b/i, "CA"],
    [/\bwyoming\b|\bwy\b/i, "WY"],
    [/\bcolorado\b|\bco\b/i, "CO"],
  ];
  for (const [rx, code] of map) if (rx.test(norm)) return code;
  return null;
}

function regionOf(place: string | null | undefined): string | null {
  const st = stateOf(place);
  return st ? US_REGION[st] ?? null : null;
}

// ─── Build person index ───────────────────────────────────────────────────────

interface IndexEntry {
  person: Person;
  surname: string;
  given: string[];
  birthYear: number | null;
  state: string | null;
  region: string | null;
}

const bySurname = new Map<string, IndexEntry[]>();
for (const p of people) {
  const entry: IndexEntry = {
    person: p,
    surname: surnameOf(p.full_name),
    given: givenTokensOf(p.full_name),
    birthYear: yearFromDate(p.birth_date),
    state: stateOf(p.birth_place),
    region: regionOf(p.birth_place),
  };
  if (!entry.surname) continue;
  if (!bySurname.has(entry.surname)) bySurname.set(entry.surname, []);
  bySurname.get(entry.surname)!.push(entry);
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface Candidate {
  frontier_name: string;
  frontier_year: number | null;
  frontier_place: string | null;
  match_person_id: string;
  match_display_name: string;
  match_birth: string;
  match_place: string;
  score: number;
  reasons: string[];
  jsj_spouse: boolean;
}

function scoreMatch(
  frontierName: string,
  frontierYear: number | null,
  frontierPlace: string | null,
  expectedSlotYear: number | null, // approx birth year of the singleton — for "off by >5 from slot" penalty
  entry: IndexEntry
): { score: number; reasons: string[] } | null {
  const sname = surnameOf(frontierName);
  if (!sname || sname !== entry.surname) return null;
  const reasons: string[] = [`surname=${sname}`];
  let score = 3;

  const fGiven = givenTokensOf(frontierName);
  let givenHits = 0;
  for (const g of fGiven) {
    if (entry.given.includes(g)) givenHits++;
  }
  if (givenHits > 0) {
    const add = Math.min(2, givenHits);
    score += add;
    reasons.push(`given+${add}(${givenHits})`);
  }

  if (frontierYear && entry.birthYear) {
    const diff = Math.abs(frontierYear - entry.birthYear);
    if (diff <= 2) {
      score += 2;
      reasons.push(`year±${diff}`);
    } else if (diff <= 5) {
      score += 1;
      reasons.push(`year±${diff}`);
    } else if (diff > 15) {
      score -= 2;
      reasons.push(`year off ${diff}`);
    }
  }

  const fRegion = regionOf(frontierPlace);
  const fState = stateOf(frontierPlace);
  if (fState && entry.state && fState === entry.state) {
    score += 2;
    reasons.push(`state=${fState}`);
  } else if (fRegion && entry.region && fRegion !== entry.region) {
    score -= 2;
    reasons.push(`region≠`);
  }

  if (expectedSlotYear && entry.birthYear) {
    const slotDiff = Math.abs(expectedSlotYear - entry.birthYear);
    if (slotDiff > 5 && slotDiff < 200) {
      // year off slot is suspicious but not killing
    }
  }

  return { score, reasons };
}

// ─── Process frontiers ───────────────────────────────────────────────────────

if (!existsSync(FRONTIER_DIR)) {
  console.error(`No frontier directory at ${FRONTIER_DIR}`);
  console.error(`Run scripts/build-singleton-frontier.ts first.`);
  process.exit(1);
}

const frontierFiles = readdirSync(FRONTIER_DIR).filter((f) => f.endsWith(".json"));
const frontiers = frontierFiles
  .map((f) => JSON.parse(readFileSync(join(FRONTIER_DIR, f), "utf-8")) as Frontier)
  .filter((f) => !singleId || f.person_id === singleId);

if (frontiers.length === 0) {
  console.log("No frontiers to match.");
  process.exit(0);
}

interface PerLeaderReport {
  person_id: string;
  display_name: string;
  candidate_count: number;
  top_candidates: Candidate[];
}

const allReports: PerLeaderReport[] = [];

for (const fr of frontiers) {
  const leader = people.find((p) => p.id === fr.person_id);
  if (!leader) continue;
  const leaderYear = yearFromDate(leader.birth_date);

  const candidates: Candidate[] = [];

  type FrontierName = {
    name: string;
    year: number | null;
    place: string | null;
    expectedSlot: number | null;
  };
  const frontierNames: FrontierName[] = [];

  // grandparents: born ~60-100 yrs before leader
  for (const g of fr.pedigree.grandparents)
    frontierNames.push({
      name: g.name,
      year: g.birth_year,
      place: g.birth_place,
      expectedSlot: leaderYear ? leaderYear - 60 : null,
    });
  for (const g of fr.pedigree.great_grandparents)
    frontierNames.push({
      name: g.name,
      year: g.birth_year,
      place: g.birth_place,
      expectedSlot: leaderYear ? leaderYear - 90 : null,
    });
  for (const g of fr.pedigree.great_great_grandparents)
    frontierNames.push({
      name: g.name,
      year: g.birth_year,
      place: g.birth_place,
      expectedSlot: leaderYear ? leaderYear - 120 : null,
    });
  for (const sp of fr.spouses) {
    frontierNames.push({
      name: sp.name,
      year: sp.marriage_year ? sp.marriage_year - 25 : null,
      place: null,
      expectedSlot: leaderYear,
    });
    for (const g of sp.grandparents)
      frontierNames.push({
        name: g.name,
        year: g.birth_year,
        place: g.birth_place,
        expectedSlot: leaderYear ? leaderYear - 60 : null,
      });
  }
  for (const sib of fr.siblings) {
    frontierNames.push({
      name: sib.name,
      year: leaderYear,
      place: leader.birth_place ?? null,
      expectedSlot: leaderYear,
    });
    if (sib.spouse)
      frontierNames.push({
        name: sib.spouse,
        year: leaderYear,
        place: null,
        expectedSlot: leaderYear,
      });
  }

  for (const fn of frontierNames) {
    const sname = surnameOf(fn.name);
    const bucket = bySurname.get(sname) ?? [];
    for (const entry of bucket) {
      // skip the leader matching themselves and their own already-known kin
      if (entry.person.id === leader.id) continue;
      const result = scoreMatch(fn.name, fn.year, fn.place, fn.expectedSlot, entry);
      if (!result) continue;
      if (result.score < minScore) continue;
      candidates.push({
        frontier_name: fn.name,
        frontier_year: fn.year,
        frontier_place: fn.place,
        match_person_id: entry.person.id,
        match_display_name: entry.person.display_name,
        match_birth: entry.person.birth_date,
        match_place: entry.person.birth_place ?? "",
        score: result.score,
        reasons: result.reasons,
        jsj_spouse: jsjSpouseIds.has(entry.person.id),
      });
    }
  }

  candidates.sort((a, b) => {
    // De-prioritize JSJ spouses
    if (a.jsj_spouse !== b.jsj_spouse) return a.jsj_spouse ? 1 : -1;
    return b.score - a.score;
  });

  allReports.push({
    person_id: fr.person_id,
    display_name: fr.display_name,
    candidate_count: candidates.length,
    top_candidates: candidates.slice(0, 5),
  });
}

allReports.sort((a, b) => {
  const aTop = a.top_candidates[0]?.score ?? 0;
  const bTop = b.top_candidates[0]?.score ?? 0;
  return bTop - aTop;
});

writeFileSync(OUTPUT_PATH, JSON.stringify(allReports, null, 2));

// ─── Print human-readable summary ─────────────────────────────────────────────

console.log(`Matched ${frontiers.length} singleton frontier(s) against ${people.length} indexed persons.`);
console.log(`Score threshold: ${minScore}\n`);

const easiest = allReports.filter((r) => r.top_candidates.length > 0);
const empty = allReports.filter((r) => r.top_candidates.length === 0);

console.log(`── Singletons WITH candidate hits (${easiest.length}) ──\n`);
for (const r of easiest) {
  console.log(`${r.display_name}  [${r.candidate_count} candidates]`);
  for (const c of r.top_candidates) {
    const flag = c.jsj_spouse ? " ⚠JSJ-spouse" : "";
    console.log(
      `  ${c.score.toString().padStart(2)}  "${c.frontier_name}" → ${c.match_display_name} (${c.match_birth}, ${c.match_place})${flag}`
    );
    console.log(`        ${c.reasons.join(", ")}`);
  }
  console.log();
}

if (empty.length > 0) {
  console.log(`── Singletons WITHOUT candidate hits (${empty.length}) ──`);
  for (const r of empty) console.log(`  ${r.display_name}`);
  console.log();
}

console.log(`Full report → ${OUTPUT_PATH}`);
