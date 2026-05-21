export interface Source {
  url: string;
  accessed: string;
  notes?: string;
}

export interface Person {
  id: string;
  display_name: string;
  full_name: string;
  birth_date: string;
  birth_place?: string;
  death_date: string | null;
  death_place?: string | null;
  gender: "M" | "F" | "X";
  is_leader: boolean;
  familysearch_id?: string | null;
  photo?: string | null;
  notes?: string;
  sources: Source[];
}

export type RelationshipType = "parent-child" | "spouse" | "sibling";
export type SubtypeBiological = "biological" | "adoptive" | "step";
export type SubtypeSibling = "full" | "half";

export interface ParentChildRelationship {
  id: string;
  type: "parent-child";
  parent_id: string;
  child_id: string;
  subtype: SubtypeBiological;
  notes?: string;
  sources: Source[];
}

export interface SpouseRelationship {
  id: string;
  type: "spouse";
  person_a_id: string;
  person_b_id: string;
  marriage_date?: string;
  marriage_end_date?: string | null;
  marriage_end_reason?: "death" | "divorce" | "annulment";
  sealed?: boolean;
  notes?: string;
  sources: Source[];
}

export interface SiblingRelationship {
  id: string;
  type: "sibling";
  person_a_id: string;
  person_b_id: string;
  subtype: SubtypeSibling;
  notes?: string;
  sources: Source[];
}

export type Relationship = ParentChildRelationship | SpouseRelationship | SiblingRelationship;

export type PositionCode =
  | "church-president"
  | "fp-first-counselor"
  | "fp-second-counselor"
  | "fp-counselor"
  | "q12-president"
  | "q12-member"
  | "presiding-bishop"
  | "presiding-patriarch";

export type EndReason =
  | "death"
  | "released"
  | "became-president"
  | "fp-dissolved"
  | "excommunicated"
  | "emeritus"
  | "resigned"
  | "called-to-fp";

export interface LeadershipPosition {
  id: string;
  person_id: string;
  position: string;
  position_code: PositionCode;
  ordination_date: string;
  release_date: string | null;
  end_reason: EndReason | null;
  seniority_date: string;
  seniority_tiebreak: number;
  notes?: string;
  sources: Source[];
}

export type EdgeDirection = "parent" | "child" | "spouse" | "sibling";

export interface GraphEdge {
  to_id: string;
  direction: EdgeDirection;
  relationship: Relationship;
}

export interface GraphNode {
  person: Person;
  edges: GraphEdge[];
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  people: Map<string, Person>;
  relationships: Relationship[];
  positions: LeadershipPosition[];
}

export interface Hop {
  from_id: string;
  to_id: string;
  direction: EdgeDirection;
  relationship: Relationship;
}

export interface PathResult {
  from_id: string;
  to_id: string;
  path: string[];
  hops: Hop[];
  path_length: number;
  summary_label: string;
}

export interface TimelineEvent {
  date: string;
  type: EndReason | "called";
  person_id: string;
  position_code: PositionCode;
}

export interface Snapshot {
  date: string;
  president: LeadershipPosition | undefined;
  first_presidency: {
    president: LeadershipPosition | undefined;
    first_counselor: LeadershipPosition | undefined;
    second_counselor: LeadershipPosition | undefined;
    additional_counselors: LeadershipPosition[];
  };
  quorum_of_twelve: LeadershipPosition[];
}
