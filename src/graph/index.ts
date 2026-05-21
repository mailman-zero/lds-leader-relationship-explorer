import { loadRawData } from "./loader.ts";
import { buildGraph } from "./builder.ts";
import type { Graph } from "./types.ts";

export async function loadGraph(): Promise<Graph> {
  const { people, relationships, positions } = await loadRawData();
  return buildGraph(people, relationships, positions);
}

export { findPath, getAllPaths, getNeighbors } from "./traversal.ts";
export { getSnapshot, getTimelineEvents, getChangeDates, getLeadersAtDate } from "./timeline.ts";
export { deriveLabel, formatPath } from "./labeler.ts";
export type * from "./types.ts";
