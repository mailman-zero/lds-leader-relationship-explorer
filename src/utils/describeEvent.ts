import type { Graph, LeadershipPosition, PositionCode, Snapshot } from "../graph/types";
import { getSnapshot } from "../graph/timeline";
import { EVENT_NOTES } from "../data/eventNotes";
import type { EventNote } from "../data/eventNotes";

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
  date: string
): LeadershipPosition | undefined {
  if (!personId) return undefined;
  return graph.positions.find(
    (p) =>
      p.person_id === personId &&
      p.position_code === (code as PositionCode) &&
      p.release_date === date
  );
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

  const lines: string[] = [];
  for (const entry of added) {
    const [pid, code] = entry.split(":");
    lines.push(`${titledName(graph, pid, code)} called as ${posLabel(code)}.`);
  }
  for (const entry of removed) {
    const [pid, code] = entry.split(":");
    const ending = endingPosition(graph, pid, code, date);
    if (ending?.end_reason === "death") {
      lines.push(`${titledName(graph, pid, code)} passed away.`);
    } else if (!isQ12Code(code)) {
      lines.push(`${titledName(graph, pid, code)} released as ${posLabel(code)}.`);
    }
  }

  const note = lines.length ? lines.join(" ") : "Change in the First Presidency or Quorum of the Twelve.";

  // Auto-generate title
  let title: string;
  if (added.length === 1) {
    const [pid, code] = added[0].split(":");
    const n = name(graph, pid);
    if (code === "church-president") title = `President ${lastName(n)} sustained`;
    else if (code.startsWith("fp-")) title = `President ${lastName(n)} called to First Presidency`;
    else if (code === "q12-president") title = `President ${lastName(n)} called`;
    else if (code === "q12-member") title = `Elder ${lastName(n)} called`;
    else title = n;
  } else if (added.length > 1) {
    const names = added.map(e => lastName(name(graph, e.split(":")[0])));
    if (names.length <= 3) title = `${names.slice(0, -1).join(", ")} & ${names.at(-1)} called`;
    else title = `${names.length} new callings`;
  } else if (removed.length === 1) {
    const [pid, code] = removed[0].split(":");
    const ending = endingPosition(graph, pid, code, date);
    if (ending?.end_reason === "death") {
      title = `${titledLastName(graph, pid, code)} passed away`;
    } else if (isQ12Code(code)) {
      title = `Change — ${date}`;
    } else {
      title = `${titledLastName(graph, pid, code)} released`;
    }
  } else if (removed.length > 1) {
    title = `${removed.length} changes`;
  } else {
    title = `Change — ${date}`;
  }

  return { title, note };
}
