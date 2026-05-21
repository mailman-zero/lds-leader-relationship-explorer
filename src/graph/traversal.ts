import type { Graph, Hop, PathResult } from "./types";
import { deriveLabel } from "./labeler";

const DEFAULT_MAX_DEPTH = 12;

export function findPath(
  graph: Graph,
  fromId: string,
  toId: string,
  options: { maxDepth?: number } = {}
): PathResult | null {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  if (fromId === toId) {
    return {
      from_id: fromId,
      to_id: toId,
      path: [fromId],
      hops: [],
      path_length: 0,
      summary_label: "same person",
    };
  }

  if (!graph.nodes.has(fromId) || !graph.nodes.has(toId)) return null;

  type QueueItem = { id: string; hops: Hop[] };
  const queue: QueueItem[] = [{ id: fromId, hops: [] }];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const { id, hops } = queue.shift()!;
    if (hops.length >= maxDepth) continue;

    const node = graph.nodes.get(id);
    if (!node) continue;

    for (const edge of node.edges) {
      if (visited.has(edge.to_id)) continue;
      visited.add(edge.to_id);

      const newHop: Hop = {
        from_id: id,
        to_id: edge.to_id,
        direction: edge.direction,
        relationship: edge.relationship,
      };
      const newHops = [...hops, newHop];

      if (edge.to_id === toId) {
        const path = [fromId, ...newHops.map((h) => h.to_id)];
        return {
          from_id: fromId,
          to_id: toId,
          path,
          hops: newHops,
          path_length: newHops.length,
          summary_label: deriveLabel(newHops, graph),
        };
      }

      queue.push({ id: edge.to_id, hops: newHops });
    }
  }

  return null;
}

export function getAllPaths(
  graph: Graph,
  fromId: string,
  options: { maxDepth?: number; leadersOnly?: boolean } = {}
): Map<string, PathResult> {
  const results = new Map<string, PathResult>();
  const { maxDepth = DEFAULT_MAX_DEPTH, leadersOnly = true } = options;

  type QueueItem = { id: string; hops: Hop[] };
  const queue: QueueItem[] = [{ id: fromId, hops: [] }];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const { id, hops } = queue.shift()!;
    if (hops.length >= maxDepth) continue;

    const node = graph.nodes.get(id);
    if (!node) continue;

    for (const edge of node.edges) {
      if (visited.has(edge.to_id)) continue;
      visited.add(edge.to_id);

      const newHop: Hop = {
        from_id: id,
        to_id: edge.to_id,
        direction: edge.direction,
        relationship: edge.relationship,
      };
      const newHops = [...hops, newHop];
      const targetPerson = graph.people.get(edge.to_id);

      if (targetPerson && (!leadersOnly || targetPerson.is_leader) && edge.to_id !== fromId) {
        const path = [fromId, ...newHops.map((h) => h.to_id)];
        results.set(edge.to_id, {
          from_id: fromId,
          to_id: edge.to_id,
          path,
          hops: newHops,
          path_length: newHops.length,
          summary_label: deriveLabel(newHops, graph),
        });
      }

      queue.push({ id: edge.to_id, hops: newHops });
    }
  }

  return results;
}

export function getNeighbors(
  graph: Graph,
  personId: string,
  degree: 1 | 2 = 1
): { person_id: string; result: PathResult }[] {
  const results: { person_id: string; result: PathResult }[] = [];
  const paths = getAllPaths(graph, personId, { maxDepth: degree, leadersOnly: false });
  for (const [id, path] of paths) {
    results.push({ person_id: id, result: path });
  }
  return results;
}
