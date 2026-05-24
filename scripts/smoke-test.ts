import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildGraph } from "../src/graph/builder.ts";
import { findPath } from "../src/graph/traversal.ts";
import { formatPath } from "../src/graph/labeler.ts";
import type { Person, Relationship, LeadershipPosition } from "../src/graph/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../data");

function load(file: string) {
  return JSON.parse(readFileSync(join(dataDir, file), "utf-8"));
}

const people = load("people.json") as Person[];
const relationships = load("relationships.json") as Relationship[];
const positions = load("leadership_positions.json") as LeadershipPosition[];
const graph = buildGraph(people, relationships, positions, []);

console.log(`Graph loaded: ${graph.people.size} people, ${graph.nodes.size} nodes\n`);

// [from, to, expectedLabel] — null means any found path is acceptable
const tests: [string, string, string | null][] = [
  // Core smoke test from project memory
  ["hb-eyring-1933", "spencerw-kimball-1895", "nephew by marriage of"],
  // Quentin L. Cook → Heber C. Kimball (great-great-grandson via David Patten Kimball)
  ["quentinl-cook-1940", "heber-c-kimball-1801", "2nd-great-grandson of"],
  // Neal A. Maxwell → Gordon B. Hinckley (in-law cousins via Ira Hinckley)
  ["neal-a-maxwell-1926", "gordon-b-hinckley-1910", null],
  // Jeffrey R. Holland → George Q. Cannon (via Cannon/Gardner/Snow/Bentley family)
  ["jeffrey-r-holland-1940", "george-q-cannon-1827", null],
  // Heber J. Grant → George Q. Cannon (via Wells/Cannon marriage)
  ["heber-j-grant-1856", "george-q-cannon-1827", null],
  // M. Russell Ballard → Joseph Smith Jr. (via Smith/Ballard family)
  ["m-russell-ballard-1928", "joseph-smith-jr-1805", null],
  // Parley P. Pratt → George Q. Cannon (via Amanda Pratt → Angus M. Cannon sibling bridge)
  ["parley-p-pratt-1807", "george-q-cannon-1827", null],
  // Henry B. Eyring → M. Russell Ballard (Kimball cluster now joined to main via Alice Ann Kimball/JFS)
  ["hb-eyring-1933", "m-russell-ballard-1928", null],
  // Orson Hyde → John Taylor (Hyde/Cowley cluster via Matthew Cowley/Elva Taylor/John W. Taylor bridge)
  ["orson-hyde-1805", "john-taylor-1808", null],
];

let passed = 0, failed = 0;

for (const [from, to, expected] of tests) {
  const result = findPath(graph, from, to);
  const fn = graph.people.get(from)?.display_name ?? from;
  const tn = graph.people.get(to)?.display_name ?? to;
  if (result) {
    const ok = !expected || result.summary_label === expected;
    const mark = ok ? '✓' : '✗';
    if (ok) passed++; else failed++;
    console.log(`${mark} ${fn} → ${tn}: "${result.summary_label}" (len=${result.path_length})`);
    console.log(formatPath(result.hops, graph));
    if (!ok) console.log(`  Expected: "${expected}"`);
  } else {
    console.log(`✗ ${fn} → ${tn}: NO PATH FOUND`);
    failed++;
  }
  console.log();
}

console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
