import type { Graph, PositionCode } from "../graph/types";
import { getAllPaths } from "../graph/traversal";

const FP_Q12_CODES: ReadonlySet<PositionCode> = new Set<PositionCode>([
  "church-president",
  "fp-first-counselor",
  "fp-second-counselor",
  "fp-counselor",
  "q12-president",
  "q12-member",
]);

// Lower number = higher office.
const OFFICE_RANK: Record<PositionCode, number> = {
  "church-president": 1,
  "fp-first-counselor": 2,
  "fp-second-counselor": 2,
  "fp-counselor": 2,
  "q12-president": 3,
  "q12-member": 4,
  "presiding-bishop": 99,
  "presiding-patriarch": 99,
};

const OFFICE_LABEL: Record<PositionCode, string> = {
  "church-president": "President of the Church",
  "fp-first-counselor": "Counselor in the First Presidency",
  "fp-second-counselor": "Counselor in the First Presidency",
  "fp-counselor": "Counselor in the First Presidency",
  "q12-president": "President of the Quorum of the Twelve",
  "q12-member": "Apostle",
  "presiding-bishop": "Presiding Bishop",
  "presiding-patriarch": "Presiding Patriarch",
};

export interface LeaderEntry {
  personId: string;
  firstCallDate: string;
  highestOffice: string;
  seniorityTiebreak: number;
}

export function collectLeaders(graph: Graph): LeaderEntry[] {
  const byPerson = new Map<
    string,
    {
      firstCallDate: string;
      bestRank: number;
      bestCode: PositionCode;
      tiebreak: number;
    }
  >();

  for (const pos of graph.positions) {
    if (!FP_Q12_CODES.has(pos.position_code)) continue;
    const existing = byPerson.get(pos.person_id);
    if (!existing) {
      byPerson.set(pos.person_id, {
        firstCallDate: pos.ordination_date,
        bestRank: OFFICE_RANK[pos.position_code],
        bestCode: pos.position_code,
        tiebreak: pos.seniority_tiebreak,
      });
      continue;
    }
    if (pos.ordination_date < existing.firstCallDate) {
      existing.firstCallDate = pos.ordination_date;
      existing.tiebreak = pos.seniority_tiebreak;
    }
    const rank = OFFICE_RANK[pos.position_code];
    if (rank < existing.bestRank) {
      existing.bestRank = rank;
      existing.bestCode = pos.position_code;
    }
  }

  const entries: LeaderEntry[] = [];
  for (const [personId, v] of byPerson) {
    entries.push({
      personId,
      firstCallDate: v.firstCallDate,
      highestOffice: OFFICE_LABEL[v.bestCode],
      seniorityTiebreak: v.tiebreak,
    });
  }

  entries.sort(
    (a, b) =>
      a.firstCallDate.localeCompare(b.firstCallDate) ||
      a.seniorityTiebreak - b.seniorityTiebreak
  );

  return entries;
}

export interface CirclePoint {
  angle: number;
  x: number;
  y: number;
}

export function computeAngles(
  leaderIds: string[],
  cx: number,
  cy: number,
  radius: number
): Map<string, CirclePoint> {
  const out = new Map<string, CirclePoint>();
  const n = leaderIds.length;
  if (n === 0) return out;
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    out.set(leaderIds[i], {
      angle,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return out;
}

export type ThicknessTier = 1 | 2 | 3 | 4 | 5;

export function pairKey(a: string, b: string): string {
  return a < b ? a + "|" + b : b + "|" + a;
}

/** Returns raw shortest-path hop counts for every connected leader pair.
 *  Key = sorted "id1|id2", value = path_length (1–30).
 *  Tier bucketing is left to the consumer so it can be combined with
 *  slider filtering without a second pass. */
export function computeHopCounts(
  graph: Graph,
  leaderIds: string[]
): Map<string, number> {
  const leaderSet = new Set(leaderIds);
  const out = new Map<string, number>();

  for (const id of leaderIds) {
    const paths = getAllPaths(graph, id, { leadersOnly: true, maxDepth: 30 });
    for (const [otherId, result] of paths) {
      if (!leaderSet.has(otherId)) continue;
      const key = pairKey(id, otherId);
      if (out.has(key)) continue;
      out.set(key, result.path_length);
    }
  }

  return out;
}
