import type { Graph, LeadershipPosition, PersonTimelineEvent, PositionCode, Snapshot, TimelineEvent } from "./types.ts";

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

  const fpPersonIds = new Set<string>();
  for (const slot of [president, firstCounselor, secondCounselor, ...additionalCounselors]) {
    if (slot) fpPersonIds.add(slot.person_id);
  }

  // A person can have both q12-member and q12-president active (the latter
  // overlays the former). Pick the highest-priority active role per person.
  const Q12_PRIORITY: Record<string, number> = { "q12-president": 2, "q12-member": 1 };
  const bestByPerson = new Map<string, LeadershipPosition>();
  for (const p of active) {
    if (p.position_code !== "q12-member" && p.position_code !== "q12-president") continue;
    if (fpPersonIds.has(p.person_id)) continue;
    const existing = bestByPerson.get(p.person_id);
    if (!existing || Q12_PRIORITY[p.position_code] > Q12_PRIORITY[existing.position_code]) {
      bestByPerson.set(p.person_id, p);
    }
  }

  const q12 = Array.from(bestByPerson.values()).sort(
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

const FP_Q12_CODES = new Set<PositionCode>([
  "church-president",
  "fp-first-counselor",
  "fp-second-counselor",
  "fp-counselor",
  "q12-president",
  "q12-member",
]);

function calledLabel(code: PositionCode): string {
  switch (code) {
    case "church-president":
      return "Sustained as President of the Church";
    case "fp-first-counselor":
      return "Called as First Counselor in the First Presidency";
    case "fp-second-counselor":
      return "Called as Second Counselor in the First Presidency";
    case "fp-counselor":
      return "Called as Counselor in the First Presidency";
    case "q12-president":
      return "Sustained as President of the Quorum of the Twelve";
    case "q12-member":
      return "Called to the Quorum of the Twelve Apostles";
    default:
      return "Called";
  }
}

function releaseLabel(code: PositionCode, reason: string | null): string {
  if (reason === "fp-dissolved") return "First Presidency dissolved";
  if (reason === "emeritus") return "Granted emeritus status";
  if (reason === "resigned") return "Resigned";
  if (reason === "excommunicated") return "Excommunicated";
  switch (code) {
    case "church-president":
      return "Released as President of the Church";
    case "fp-first-counselor":
    case "fp-second-counselor":
    case "fp-counselor":
      return "Released from the First Presidency";
    case "q12-president":
      return "Released as President of the Quorum of the Twelve";
    case "q12-member":
      return "Released from the Quorum of the Twelve";
    default:
      return "Released";
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getPersonTimeline(graph: Graph, personId: string): PersonTimelineEvent[] {
  const person = graph.people.get(personId);
  if (!person) return [];

  const positions = graph.positions.filter(
    (p) => p.person_id === personId && FP_Q12_CODES.has(p.position_code)
  );

  const today = todayISO();
  type Raw = Omit<PersonTimelineEvent, "navigate_date"> & { navigate_date?: string };
  const raw: Raw[] = [];

  // Calls (every ordination)
  for (const p of positions) {
    raw.push({
      date: p.ordination_date,
      type: "called",
      position_code: p.position_code,
      label: calledLabel(p.position_code),
      hypothetical: p.ordination_date > today,
    });
  }

  // Releases — skip the ones that are immediately superseded by a higher call.
  // "became-president" and "called-to-fp" are bookkeeping ends; the new position's
  // own ordination_date will surface in the timeline already.
  const supersededReasons = new Set(["became-president", "called-to-fp"]);

  for (const p of positions) {
    if (!p.release_date || !p.end_reason) continue;
    if (supersededReasons.has(p.end_reason)) continue;

    if (p.end_reason === "death") {
      raw.push({
        date: p.release_date,
        type: "death",
        position_code: p.position_code,
        label: "Passed away",
        hypothetical: p.release_date > today,
      });
    } else {
      raw.push({
        date: p.release_date,
        type: "released",
        position_code: p.position_code,
        label: releaseLabel(p.position_code, p.end_reason),
        hypothetical: p.release_date > today,
      });
    }
  }

  // Fallback: death from people.json if not already captured (e.g. q12 member who
  // died with no position-end record). De-dup by date+type.
  if (person.death_date) {
    const hasDeath = raw.some((r) => r.type === "death" && r.date === person.death_date);
    if (!hasDeath) {
      raw.push({
        date: person.death_date,
        type: "death",
        label: "Passed away",
        hypothetical: person.death_date > today,
      });
    }
  }

  // Dedup: same date+type+position_code (multiple overlapping positions can
  // emit duplicate death events on the same date).
  const dedupKey = (r: Raw) => `${r.date}|${r.type}|${r.position_code ?? ""}`;
  const seen = new Set<string>();
  const deduped: Raw[] = [];
  for (const r of raw) {
    const k = dedupKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }

  // Collapse: a "released" and a "called" on the same date for the same person
  // represent a promotion/transition. Keep the "called" event (more informative).
  const byDate = new Map<string, Raw[]>();
  for (const r of deduped) {
    const arr = byDate.get(r.date) ?? [];
    arr.push(r);
    byDate.set(r.date, arr);
  }

  const collapsed: Raw[] = [];
  for (const [, arr] of byDate) {
    if (arr.length === 1) {
      collapsed.push(arr[0]);
      continue;
    }
    const called = arr.find((r) => r.type === "called");
    const death = arr.find((r) => r.type === "death");
    if (death) {
      collapsed.push(death);
    } else if (called) {
      collapsed.push({ ...called, type: "promoted", label: calledLabel(called.position_code!) });
    } else {
      collapsed.push(arr[0]);
    }
  }

  collapsed.sort((a, b) => a.date.localeCompare(b.date));

  // navigate_date: snap to the nearest FP/Q12 change-date ≤ event date
  // (almost always equal — but if a death date falls between snapshots, fall
  // back to the prior change-date so we don't navigate to an undefined snapshot).
  const changeDates = getChangeDates(graph);
  return collapsed.map((r) => {
    let navDate = r.date;
    if (!changeDates.includes(r.date)) {
      // Find largest change-date ≤ r.date
      const candidates = changeDates.filter((d) => d <= r.date);
      navDate = candidates.length ? candidates[candidates.length - 1] : changeDates[0] ?? r.date;
    }
    return { ...r, navigate_date: navDate } as PersonTimelineEvent;
  });
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
