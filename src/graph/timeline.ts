import type { Graph, LeadershipPosition, Snapshot, TimelineEvent } from "./types.ts";

export function getTimelineEvents(graph: Graph): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const pos of graph.positions) {
    events.push({
      date: pos.ordination_date,
      type: "called",
      person_id: pos.person_id,
      position_code: pos.position_code,
    });
    if (pos.release_date && pos.end_reason) {
      events.push({
        date: pos.release_date,
        type: pos.end_reason,
        person_id: pos.person_id,
        position_code: pos.position_code,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function getChangeDates(graph: Graph): string[] {
  const fpAndQ12Codes = new Set([
    "church-president",
    "fp-first-counselor",
    "fp-second-counselor",
    "fp-counselor",
    "q12-president",
    "q12-member",
  ]);

  const dates = new Set<string>();
  for (const pos of graph.positions) {
    if (!fpAndQ12Codes.has(pos.position_code)) continue;
    dates.add(pos.ordination_date);
    if (pos.release_date) dates.add(pos.release_date);
  }

  return Array.from(dates).sort();
}

export function getSnapshot(graph: Graph, date: string): Snapshot {
  const active = graph.positions.filter(
    (p) =>
      p.ordination_date <= date &&
      (p.release_date === null || p.release_date > date)
  );

  const president = active.find((p) => p.position_code === "church-president");
  const firstCounselor = active.find((p) => p.position_code === "fp-first-counselor");
  const secondCounselor = active.find((p) => p.position_code === "fp-second-counselor");
  const additionalCounselors = active
    .filter((p) => p.position_code === "fp-counselor")
    .sort(
      (a, b) =>
        a.ordination_date.localeCompare(b.ordination_date) ||
        a.seniority_date.localeCompare(b.seniority_date) ||
        a.seniority_tiebreak - b.seniority_tiebreak
    );

  const q12 = active
    .filter(
      (p) =>
        p.position_code === "q12-member" || p.position_code === "q12-president"
    )
    .sort(
      (a, b) =>
        a.seniority_date.localeCompare(b.seniority_date) ||
        a.seniority_tiebreak - b.seniority_tiebreak
    );

  return {
    date,
    president,
    first_presidency: {
      president,
      first_counselor: firstCounselor,
      second_counselor: secondCounselor,
      additional_counselors: additionalCounselors,
    },
    quorum_of_twelve: q12,
  };
}

export function getLeadersAtDate(
  graph: Graph,
  date: string
): { person_id: string; position: LeadershipPosition }[] {
  const snapshot = getSnapshot(graph, date);
  const results: { person_id: string; position: LeadershipPosition }[] = [];

  const allActive = [
    snapshot.president,
    snapshot.first_presidency.first_counselor,
    snapshot.first_presidency.second_counselor,
    ...snapshot.first_presidency.additional_counselors,
    ...snapshot.quorum_of_twelve,
  ].filter((p): p is LeadershipPosition => p !== undefined);

  for (const pos of allActive) {
    results.push({ person_id: pos.person_id, position: pos });
  }

  return results;
}
