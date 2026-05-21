import type {
  Graph,
  GraphNode,
  Person,
  Relationship,
  LeadershipPosition,
} from "./types.ts";

export function buildGraph(
  people: Person[],
  relationships: Relationship[],
  positions: LeadershipPosition[]
): Graph {
  const nodes = new Map<string, GraphNode>();
  const peopleMap = new Map<string, Person>();

  for (const person of people) {
    peopleMap.set(person.id, person);
    nodes.set(person.id, { person, edges: [] });
  }

  for (const rel of relationships) {
    if (rel.type === "parent-child") {
      const parentNode = nodes.get(rel.parent_id);
      const childNode = nodes.get(rel.child_id);
      if (parentNode && childNode) {
        parentNode.edges.push({ to_id: rel.child_id, direction: "child", relationship: rel });
        childNode.edges.push({ to_id: rel.parent_id, direction: "parent", relationship: rel });
      }
    } else if (rel.type === "spouse") {
      const nodeA = nodes.get(rel.person_a_id);
      const nodeB = nodes.get(rel.person_b_id);
      if (nodeA && nodeB) {
        nodeA.edges.push({ to_id: rel.person_b_id, direction: "spouse", relationship: rel });
        nodeB.edges.push({ to_id: rel.person_a_id, direction: "spouse", relationship: rel });
      }
    } else if (rel.type === "sibling") {
      const nodeA = nodes.get(rel.person_a_id);
      const nodeB = nodes.get(rel.person_b_id);
      if (nodeA && nodeB) {
        nodeA.edges.push({ to_id: rel.person_b_id, direction: "sibling", relationship: rel });
        nodeB.edges.push({ to_id: rel.person_a_id, direction: "sibling", relationship: rel });
      }
    }
  }

  return { nodes, people: peopleMap, relationships, positions };
}
