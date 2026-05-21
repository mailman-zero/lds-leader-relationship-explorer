import { loadRawData } from "./loader";
import { buildGraph } from "./builder";
import type { Graph } from "./types";

export async function loadGraph(): Promise<Graph> {
  const { people, relationships, positions } = await loadRawData();
  return buildGraph(people, relationships, positions);
}

export { findPath, getAllPaths, getNeighbors } from "./traversal";
export { getSnapshot, getTimelineEvents, getChangeDates, getLeadersAtDate } from "./timeline";
export { deriveLabel, formatPath } from "./labeler";
export type * from "./types";
