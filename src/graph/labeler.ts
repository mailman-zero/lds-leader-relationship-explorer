import type { Hop, Graph } from "./types.ts";

function gender(graph: Graph, id: string): "M" | "F" | "X" {
  return graph.people.get(id)?.gender ?? "X";
}

function parentLabel(g: "M" | "F" | "X") {
  return g === "M" ? "father" : g === "F" ? "mother" : "parent";
}
function childLabel(g: "M" | "F" | "X") {
  return g === "M" ? "son" : g === "F" ? "daughter" : "child";
}
function siblingLabel(g: "M" | "F" | "X") {
  return g === "M" ? "brother" : g === "F" ? "sister" : "sibling";
}
function spouseLabel(g: "M" | "F" | "X") {
  return g === "M" ? "husband" : g === "F" ? "wife" : "spouse";
}
function auntUncleLabel(g: "M" | "F" | "X") {
  return g === "M" ? "uncle" : g === "F" ? "aunt" : "aunt/uncle";
}
function nieceNephewLabel(g: "M" | "F" | "X") {
  return g === "M" ? "nephew" : g === "F" ? "niece" : "niece/nephew";
}
function grandparentLabel(g: "M" | "F" | "X") {
  return g === "M" ? "grandfather" : g === "F" ? "grandmother" : "grandparent";
}
function grandchildLabel(g: "M" | "F" | "X") {
  return g === "M" ? "grandson" : g === "F" ? "granddaughter" : "grandchild";
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

export function deriveLabel(hops: Hop[], graph: Graph): string {
  if (hops.length === 0) return "same person";

  const dirs = hops.map((h) => h.direction);
  const toId = hops[hops.length - 1].to_id;
  const toGender = gender(graph, toId);
  const fromId = hops[0].from_id;
  const fromGender = gender(graph, fromId);

  if (hops.length === 1) {
    const d = dirs[0];
    if (d === "parent") return `${childLabel(fromGender)} of`;
    if (d === "child") return `${parentLabel(toGender)} of`;
    if (d === "spouse") return `${spouseLabel(toGender)} of`;
    if (d === "sibling") return `${siblingLabel(toGender)} of`;
  }

  if (hops.length === 2) {
    const [d0, d1] = dirs;

    if (d0 === "parent" && d1 === "child") return `${siblingLabel(toGender)} of`;
    if (d0 === "parent" && d1 === "parent") return `${grandchildLabel(fromGender)} of`;
    if (d0 === "child" && d1 === "child") return `${grandparentLabel(toGender)} of`;
    if (d0 === "child" && d1 === "parent") return `${auntUncleLabel(toGender)} of`;
    if (d0 === "spouse" && d1 === "parent") return `${parentLabel(toGender)}-in-law of`;
    if (d0 === "spouse" && d1 === "child") return `${parentLabel(toGender)}-in-law of`;
    if (d0 === "parent" && d1 === "spouse") return `${siblingLabel(toGender)}-in-law of`;
    if (d0 === "child" && d1 === "spouse") return `${childLabel(fromGender)}-in-law of`;
    if (d0 === "sibling" && d1 === "spouse") return `${siblingLabel(toGender)}-in-law of`;
    if (d0 === "spouse" && d1 === "sibling") return `${siblingLabel(toGender)}-in-law of`;
  }

  if (hops.length === 3) {
    const [d0, d1, d2] = dirs;

    if (d0 === "parent" && d1 === "child" && d2 === "child") return `${nieceNephewLabel(fromGender)} of`;
    if (d0 === "parent" && d1 === "parent" && d2 === "child") return `${auntUncleLabel(toGender)} of`;
    if (d0 === "parent" && d1 === "parent" && d2 === "parent") return `great-${grandchildLabel(fromGender)} of`;
    if (d0 === "child" && d1 === "child" && d2 === "child") return `great-${grandparentLabel(toGender)} of`;
    if (d0 === "parent" && d1 === "child" && d2 === "spouse") return `${siblingLabel(toGender)}-in-law of`;
    if (d0 === "parent" && d1 === "sibling" && d2 === "spouse") return `${nieceNephewLabel(fromGender)} by marriage of`;
    if (d0 === "parent" && d1 === "spouse" && d2 === "sibling") return `${nieceNephewLabel(fromGender)} by marriage of`;
    if (d0 === "child" && d1 === "sibling" && d2 === "spouse") return `${auntUncleLabel(toGender)} by marriage of`;
    if (d0 === "child" && d1 === "child" && d2 === "spouse") return `${grandchildLabel(fromGender)}-in-law of`;
    if (d0 === "parent" && d1 === "child" && d2 === "parent") return "1st cousin of";
  }

  if (hops.length === 4) {
    const [d0, d1, d2, d3] = dirs;
    if (d0 === "parent" && d1 === "parent" && d2 === "child" && d3 === "child") {
      return "1st cousin of";
    }
    if (d0 === "parent" && d1 === "parent" && d2 === "parent" && d3 === "child") {
      return `great-${auntUncleLabel(toGender)} of`;
    }
    if (d0 === "parent" && d1 === "parent" && d2 === "parent" && d3 === "parent") {
      return `2nd-great-${grandchildLabel(fromGender)} of`;
    }
  }

  const upCount = dirs.filter((d) => d === "parent").length;
  const downCount = dirs.filter((d) => d === "child").length;
  const spouseCount = dirs.filter((d) => d === "spouse").length;
  const siblingCount = dirs.filter((d) => d === "sibling").length;

  if (spouseCount === 0 && siblingCount === 0) {
    if (upCount > 0 && downCount === 0) {
      const prefix = upCount > 2 ? `${upCount - 1}x-great-` : upCount === 2 ? "great-" : "";
      return `${prefix}${grandchildLabel(fromGender)} of`;
    }
    if (downCount > 0 && upCount === 0) {
      const prefix = downCount > 2 ? `${downCount - 1}x-great-` : downCount === 2 ? "great-" : "";
      return `${prefix}${grandparentLabel(toGender)} of`;
    }
    if (upCount === downCount && upCount >= 2) {
      return `${ordinal(upCount - 1)} cousin of`;
    }
  }

  return `related (${hops.length} steps) to`;
}

export function formatPath(hops: Hop[], graph: Graph): string {
  if (hops.length === 0) return "";
  const lines: string[] = [];
  const firstName = graph.people.get(hops[0].from_id)?.display_name ?? hops[0].from_id;
  lines.push(firstName);
  for (const hop of hops) {
    const toName = graph.people.get(hop.to_id)?.display_name ?? hop.to_id;
    const fromGender = gender(graph, hop.from_id);
    let label: string;
    if (hop.direction === "parent") label = `↑ ${childLabel(fromGender)} of`;
    else if (hop.direction === "child") label = `↓ ${parentLabel(fromGender)} of`;
    else if (hop.direction === "spouse") label = `→ ${spouseLabel(fromGender)} of`;
    else label = `→ ${siblingLabel(fromGender)} of`;
    lines.push(`  ${label}`);
    lines.push(toName);
  }
  return lines.join("\n");
}
