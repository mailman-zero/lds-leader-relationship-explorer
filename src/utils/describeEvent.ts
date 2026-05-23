import type { Graph, LeadershipPosition, PositionCode, Snapshot } from "../graph/types";
import { getSnapshot } from "../graph/timeline";
import { EVENT_NOTES } from "../data/eventNotes";
import type { EventNote } from "../data/eventNotes";
import { formatTenure } from "./tenure";

function name(graph: Graph, personId: string | undefined): string {
  if (!personId) return "Unknown";
  return graph.people.get(personId)?.display_name ?? personId;
}

function posLabel(code: string): string {
  if (code === "church-president") return "President of the Church";
  if (code === "fp-first-counselor") return "First Counselor in the First Presidency";
  if (code === "fp-second-counselor") return "Second Counselor in the First Presidency";
  if (code === "fp-counselor") return "Counselor in the First Presidency";
  if (code === "q12-president") return "President of the Quorum of the Twelve";
  if (code === "q12-member") return "member of the Quorum of the Twelve";
  return code;
}

function isFirstPresidencyCode(code: string): boolean {
  return code === "church-president" || code.startsWith("fp-");
}

function isQ12Code(code: string): boolean {
  return code === "q12-member" || code === "q12-president";
}

function lastName(fullName: string): string {
  return fullName.split(" ").pop() ?? fullName;
}

function honorificFor(code: string): "President" | "Elder" | null {
  if (isFirstPresidencyCode(code) || code === "q12-president") return "President";
  if (code === "q12-member") return "Elder";
  return null;
}

function titledName(graph: Graph, personId: string | undefined, code: string): string {
  const n = name(graph, personId);
  const honorific = honorificFor(code);
  return honorific ? `${honorific} ${n}` : n;
}

function titledLastName(graph: Graph, personId: string | undefined, code: string): string {
  const n = name(graph, personId);
  const honorific = honorificFor(code);
  return honorific ? `${honorific} ${lastName(n)}` : lastName(n);
}

function endingPosition(
  graph: Graph,
  personId: string | undefined,
  code: string,
  date: string,
  prevDate?: string | null
): LeadershipPosition | undefined {
  if (!personId) return undefined;
  // A person may have left between two snapshot dates (e.g. died Sep 2 but
  // the next snapshot is Oct 1). Match any release that fell within the
  // window (prevDate, date] so deaths and releases aren't silently dropped.
  return graph.positions.find(
    (p) =>
      p.person_id === personId &&
      p.position_code === (code as PositionCode) &&
      !!p.release_date &&
      p.release_date <= date &&
      (!prevDate || p.release_date > prevDate)
  );
}

// Earliest q12-member ordination date for a person — used to compute total
// time served in the Quorum of the Twelve.
function earliestQ12Date(graph: Graph, personId: string): string | null {
  let earliest: string | null = null;
  for (const p of graph.positions) {
    if (p.person_id !== personId) continue;
    if (p.position_code !== "q12-member" && p.position_code !== "q12-president") continue;
    if (earliest === null || p.ordination_date < earliest) earliest = p.ordination_date;
  }
  return earliest;
}

export function describeEvent(
  graph: Graph,
  date: string,
  allDates: string[]
): EventNote {
  if (EVENT_NOTES[date]) return EVENT_NOTES[date];

  const currSnap = getSnapshot(graph, date);
  const idx = allDates.indexOf(date);
  const prevDate = idx > 0 ? allDates[idx - 1] : null;
  const prevSnap: Snapshot | null = prevDate ? getSnapshot(graph, prevDate) : null;

  const prevIds = new Set<string>();
  const currIds = new Set<string>();

  function collectIds(snap: Snapshot | null, target: Set<string>) {
    if (!snap) return;
    if (snap.president) target.add(snap.president.person_id + ":" + snap.president.position_code);
    if (snap.first_presidency.first_counselor) target.add(snap.first_presidency.first_counselor.person_id + ":" + snap.first_presidency.first_counselor.position_code);
    if (snap.first_presidency.second_counselor) target.add(snap.first_presidency.second_counselor.person_id + ":" + snap.first_presidency.second_counselor.position_code);
    for (const p of snap.first_presidency.additional_counselors) target.add(p.person_id + ":" + p.position_code);
    for (const p of snap.quorum_of_twelve) target.add(p.person_id + ":" + p.position_code);
  }

  collectIds(prevSnap, prevIds);
  collectIds(currSnap, currIds);

  const added = [...currIds].filter(k => !prevIds.has(k));
  const removed = [...prevIds].filter(k => !currIds.has(k));

  // Index added/removed by person_id so we can detect FP↔Q12 transitions
  // (same person on both sides).
  const addedByPid = new Map<string, string>();
  for (const entry of added) {
    const [pid, code] = entry.split(":");
    addedByPid.set(pid, code);
  }
  const removedByPid = new Map<string, string>();
  for (const entry of removed) {
    const [pid, code] = entry.split(":");
    removedByPid.set(pid, code);
  }

  const lines: string[] = [];
  const consumedAdded = new Set<string>();
  const consumedRemoved = new Set<string>();
  // Track president-death for title priority.
  let presidentDeath: { pid: string; code: string } | null = null;

  // Pre-pass: pair transitions where the same person appears in both added and removed.
  for (const [pid, oldCode] of removedByPid) {
    const newCode = addedByPid.get(pid);
    if (!newCode) continue;

    consumedRemoved.add(`${pid}:${oldCode}`);
    consumedAdded.add(`${pid}:${newCode}`);

    const oldIsFP = isFirstPresidencyCode(oldCode);
    const newIsFP = isFirstPresidencyCode(newCode);
    const newIsQ12 = isQ12Code(newCode);
    const oldIsQ12 = isQ12Code(oldCode);

    if (oldIsFP && newIsQ12) {
      // Counselor returning to the Twelve after FP dissolution. Never called.
      lines.push(`${titledName(graph, pid, oldCode)} returned to his place in the Quorum of the Twelve Apostles.`);
    } else if (oldIsQ12 && newIsFP) {
      lines.push(`${titledName(graph, pid, newCode)} called as ${posLabel(newCode)}.`);
    } else if (oldIsFP && newIsFP) {
      lines.push(`${titledName(graph, pid, newCode)} called as ${posLabel(newCode)}.`);
    } else if (oldIsQ12 && newIsQ12) {
      // e.g. q12-member promoted to q12-president
      lines.push(`${titledName(graph, pid, newCode)} sustained as ${posLabel(newCode)}.`);
    }
  }

  // Remaining "added" — pure callings.
  for (const entry of added) {
    if (consumedAdded.has(entry)) continue;
    const [pid, code] = entry.split(":");
    lines.push(`${titledName(graph, pid, code)} called as ${posLabel(code)}.`);
  }

  // Remaining "removed" — deaths, releases, etc.
  for (const entry of removed) {
    if (consumedRemoved.has(entry)) continue;
    const [pid, code] = entry.split(":");
    const ending = endingPosition(graph, pid, code, date, prevDate);
    if (ending?.end_reason === "death") {
      lines.push(`${titledName(graph, pid, code)} passed away.`);
      if (code === "church-president") presidentDeath = { pid, code };

      // Tenure as President of the Church (months if <1 year).
      if (code === "church-president" && ending.ordination_date) {
        lines.push(
          `He had served as President of the Church for ${formatTenure(ending.ordination_date, date)}.`
        );
      }
      // Tenure since first apostolic ordination.
      const q12Start = earliestQ12Date(graph, pid);
      if (q12Start && q12Start < date) {
        lines.push(
          `He had served in the Quorum of the Twelve Apostles for ${formatTenure(q12Start, date)}.`
        );
      }
    } else if (!isQ12Code(code)) {
      lines.push(`${titledName(graph, pid, code)} released as ${posLabel(code)}.`);
    }
  }

  const note = lines.length ? lines.join(" ") : "Change in the First Presidency or Quorum of the Twelve.";

  // Title — president-death takes precedence so coincident events don't overshadow it.
  // Then a newly-sustained President of the Church (FP reorganization) takes precedence
  // over the other coincident transitions.
  let title: string;
  const newPresident = added
    .map(e => e.split(":"))
    .find(([_pid, code]) => code === "church-president");
  if (presidentDeath) {
    title = `${titledLastName(graph, presidentDeath.pid, presidentDeath.code)} passed away`;
  } else if (newPresident) {
    title = `President ${lastName(name(graph, newPresident[0]))} sustained`;
  } else if (added.length === 1 && removed.length === 0) {
    const [pid, code] = added[0].split(":");
    const n = name(graph, pid);
    if (code === "church-president") title = `President ${lastName(n)} sustained`;
    else if (code.startsWith("fp-")) title = `President ${lastName(n)} called to First Presidency`;
    else if (code === "q12-president") title = `President ${lastName(n)} called`;
    else if (code === "q12-member") title = `Elder ${lastName(n)} called`;
    else title = n;
  } else if (added.length > 1 && removed.length === 0) {
    const names = added.map(e => lastName(name(graph, e.split(":")[0])));
    if (names.length <= 3) title = `${names.slice(0, -1).join(", ")} & ${names.at(-1)} called`;
    else title = `${names.length} new callings`;
  } else if (removed.length === 1 && added.length === 0) {
    const [pid, code] = removed[0].split(":");
    const ending = endingPosition(graph, pid, code, date, prevDate);
    if (ending?.end_reason === "death") {
      title = `${titledLastName(graph, pid, code)} passed away`;
    } else if (isQ12Code(code)) {
      title = `Change — ${date}`;
    } else {
      title = `${titledLastName(graph, pid, code)} released`;
    }
  } else if (added.length === 1 && removed.length === 1) {
    // Reorganization: most often a counselor promoted, or a new president sustained
    // alongside a counselor returning to the Twelve.
    const [aPid, aCode] = added[0].split(":");
    if (aCode === "church-president") title = `President ${lastName(name(graph, aPid))} sustained`;
    else if (aCode.startsWith("fp-")) title = `President ${lastName(name(graph, aPid))} called to First Presidency`;
    else title = `Change — ${date}`;
  } else {
    title = `${added.length + removed.length} changes`;
  }

  return { title, note };
}
