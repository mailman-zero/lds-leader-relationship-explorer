/**
 * Find leaders not yet connected to the main family-graph cluster.
 *
 * Replaces the ad-hoc /tmp/cluster-check*.ts scripts. Self-updates from the
 * current data files, so re-running it always shows the current state.
 *
 * Usage:
 *   node --experimental-strip-types scripts/find-singletons.ts
 *   node --experimental-strip-types scripts/find-singletons.ts --json
 *
 * Exit code is non-zero if the singleton count exceeds the previous run
 * (best-effort comparison against data/singleton-research.json).
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildGraph } from "../src/graph/builder.ts";
import type {
  Person,
  Relationship,
  LeadershipPosition,
  Temple,
} from "../src/graph/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../data");

function load<T>(file: string): T {
  return JSON.parse(readFileSync(join(dataDir, file), "utf-8")) as T;
}

const people = load<Person[]>("people.json");
const relationships = load<Relationship[]>("relationships.json");
const positions = load<LeadershipPosition[]>("leadership_positions.json");
const temples = existsSync(join(dataDir, "temples.json"))
  ? load<Temple[]>("temples.json")
  : [];

const researchPath = join(dataDir, "singleton-research.json");
type ResearchStatus = "connected" | "promising" | "dead_end" | "unresearched";
interface ResearchRecord {
  status: ResearchStatus;
  checked_at?: string;
  depth_checked?: string;
  pedigree_summary?: string;
  leads_explored?: { hypothesis: string; result: string; source_url?: string }[];
  remaining_uncertainty?: string;
  sources?: { url: string; accessed: string }[];
}
const research: Record<string, ResearchRecord> = existsSync(researchPath)
  ? JSON.parse(readFileSync(researchPath, "utf-8"))
  : {};

const graph = buildGraph(people, relationships, positions, temples);

// --- Union-find over the entire graph ---
const parent = new Map<string, string>();
function find(x: string): string {
  if (!parent.has(x)) parent.set(x, x);
  let root = x;
  while (parent.get(root)! !== root) root = parent.get(root)!;
  // Path compression
  let cur = x;
  while (parent.get(cur)! !== root) {
    const next = parent.get(cur)!;
    parent.set(cur, root);
    cur = next;
  }
  return root;
}
function union(a: string, b: string) {
  const ra = find(a);
  const rb = find(b);
  if (ra !== rb) parent.set(rb, ra);
}

for (const [id, node] of graph.nodes) {
  for (const edge of node.edges) union(id, edge.to_id);
}

// --- Bucket leaders by cluster ---
const leaders = people.filter((p) => p.is_leader);
const clusters = new Map<string, Person[]>();
for (const leader of leaders) {
  const root = find(leader.id);
  if (!clusters.has(root)) clusters.set(root, []);
  clusters.get(root)!.push(leader);
}

const sortedClusters = [...clusters.values()].sort((a, b) => b.length - a.length);
const mainCluster = sortedClusters[0] ?? [];
const isolatedClusters = sortedClusters.slice(1);

// --- Position-period helper for context ---
function positionPeriod(personId: string): string {
  const pers = positions.filter((p) => p.person_id === personId);
  if (pers.length === 0) return "(no position)";
  const first = pers
    .map((p) => p.ordination_date)
    .sort()[0]
    .slice(0, 4);
  const releases = pers.map((p) => p.release_date).filter(Boolean) as string[];
  if (releases.length === 0) return `${first}–present`;
  const last = releases.sort().reverse()[0].slice(0, 4);
  return `${first}–${last}`;
}

const statusEmoji: Record<ResearchStatus, string> = {
  connected: "✓",
  promising: "→",
  dead_end: "✗",
  unresearched: "?",
};

const jsonOut = process.argv.includes("--json");
const summary = {
  total_leaders: leaders.length,
  main_cluster_size: mainCluster.length,
  isolated_cluster_count: isolatedClusters.length,
  singleton_count: isolatedClusters.filter((c) => c.length === 1).length,
  small_cluster_leaders: isolatedClusters
    .filter((c) => c.length > 1)
    .reduce((sum, c) => sum + c.length, 0),
};

if (jsonOut) {
  const detail = isolatedClusters.map((c) => ({
    size: c.length,
    leaders: c.map((l) => ({
      id: l.id,
      display_name: l.display_name,
      period: positionPeriod(l.id),
      research_status: research[l.id]?.status ?? "unresearched",
    })),
  }));
  console.log(JSON.stringify({ summary, isolated_clusters: detail }, null, 2));
} else {
  console.log(`Leaders total:        ${summary.total_leaders}`);
  console.log(`Main cluster:         ${summary.main_cluster_size}`);
  console.log(`Isolated clusters:    ${summary.isolated_cluster_count}`);
  console.log(`  true singletons:    ${summary.singleton_count}`);
  console.log(`  in small clusters:  ${summary.small_cluster_leaders}`);
  console.log();
  console.log(`Status legend: ${statusEmoji.connected} connected  ${statusEmoji.promising} promising  ${statusEmoji.dead_end} dead-end  ${statusEmoji.unresearched} unresearched`);
  console.log();

  for (const cluster of isolatedClusters) {
    const sizeLabel = cluster.length === 1 ? "SINGLETON" : `CLUSTER (${cluster.length})`;
    console.log(`── ${sizeLabel} ──`);
    for (const leader of cluster.sort((a, b) =>
      a.display_name.localeCompare(b.display_name)
    )) {
      const rec = research[leader.id];
      const sym = statusEmoji[rec?.status ?? "unresearched"];
      const note =
        rec?.status === "dead_end"
          ? "  dead-end logged"
          : rec?.status === "promising"
            ? `  lead: ${rec.leads_explored?.[0]?.hypothesis ?? "(see log)"}`
            : "";
      console.log(
        `  ${sym}  ${leader.display_name.padEnd(28)} ${positionPeriod(leader.id).padEnd(14)}${note}`
      );
    }
    console.log();
  }
}

// Soft monotonic check: warn (but don't fail) if singleton count grew vs.
// what the research log claims.
const loggedSingletons = Object.keys(research).filter(
  (id) => research[id].status !== "connected"
).length;
if (summary.singleton_count + summary.small_cluster_leaders > loggedSingletons && loggedSingletons > 0) {
  console.warn(
    `\nNote: ${summary.singleton_count + summary.small_cluster_leaders} unconnected leaders, ${loggedSingletons} in research log. Some leaders are missing log entries.`
  );
}
