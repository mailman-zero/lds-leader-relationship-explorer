import { loadRawData } from "./loader.ts";
import { buildGraph } from "./builder.ts";
import type { Graph } from "./types.ts";

export async function loadGraph(): Promise<Graph> {
  const { people, relationships, positions, temples } = await loadRawData();
  return buildGraph(people, relationships, positions, temples);
}

export { findPath, getAllPaths, getNeighbors } from "./traversal.ts";
export { getSnapshot, getTimelineEvents, getChangeDates, getLeadersAtDate, getPersonTimeline } from "./timeline.ts";
export { deriveLabel, formatPath } from "./labeler.ts";
export type * from "./types.ts";
