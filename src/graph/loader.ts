import { z } from "zod";
import type { Person, Relationship, LeadershipPosition, Temple } from "./types.ts";

const SourceSchema = z.object({
  url: z.string(),
  accessed: z.string(),
  notes: z.string().optional(),
});

const PersonSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  full_name: z.string(),
  birth_date: z.string(),
  birth_place: z.string().nullable().optional(),
  death_date: z.string().nullable(),
  death_place: z.string().nullable().optional(),
  gender: z.enum(["M", "F", "X"]),
  is_leader: z.boolean(),
  familysearch_id: z.string().nullable().optional(),
  photo: z.string().nullable().optional(),
  notes: z.string().optional(),
  sources: z.array(SourceSchema),
});

const ParentChildSchema = z.object({
  id: z.string(),
  type: z.literal("parent-child"),
  parent_id: z.string(),
  child_id: z.string(),
  subtype: z.enum(["biological", "adoptive", "step"]).optional(),
  notes: z.string().optional(),
  sources: z.array(SourceSchema),
});

const SpouseSchema = z.object({
  id: z.string(),
  type: z.literal("spouse"),
  person_a_id: z.string(),
  person_b_id: z.string(),
  marriage_date: z.string().optional(),
  marriage_end_date: z.string().nullable().optional(),
  marriage_end_reason: z.enum(["death", "divorce", "annulment"]).optional(),
  sealed: z.boolean().optional(),
  notes: z.string().optional(),
  sources: z.array(SourceSchema),
});

const SiblingSchema = z.object({
  id: z.string(),
  type: z.literal("sibling"),
  person_a_id: z.string(),
  person_b_id: z.string(),
  subtype: z.enum(["full", "half"]),
  notes: z.string().optional(),
  sources: z.array(SourceSchema),
});

const RelationshipSchema = z.discriminatedUnion("type", [
  ParentChildSchema,
  SpouseSchema,
  SiblingSchema,
]);

const PositionSchema = z.object({
  id: z.string(),
  person_id: z.string(),
  position: z.string(),
  position_code: z.enum([
    "church-president",
    "fp-first-counselor",
    "fp-second-counselor",
    "fp-counselor",
    "q12-president",
    "q12-member",
    "presiding-bishop",
    "presiding-patriarch",
  ]),
  ordination_date: z.string(),
  release_date: z.string().nullable(),
  end_reason: z
    .enum([
      "death",
      "released",
      "became-president",
      "fp-dissolved",
      "excommunicated",
      "emeritus",
      "resigned",
      "called-to-fp",
    ])
    .nullable(),
  seniority_date: z.string(),
  seniority_tiebreak: z.number(),
  notes: z.string().optional(),
  sources: z.array(SourceSchema),
});

const TempleSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string().nullable().optional(),
  dedication_date: z.string(),
  dedicated_by: z.string().nullable(),
  type: z.enum(["dedication", "rededication"]),
  sources: z.array(SourceSchema).optional(),
});

export async function loadRawData(): Promise<{
  people: Person[];
  relationships: Relationship[];
  positions: LeadershipPosition[];
  temples: Temple[];
}> {
  const [peopleRes, relsRes, positionsRes, templesRes] = await Promise.all([
    fetch(import.meta.env.BASE_URL + "data/people.json"),
    fetch(import.meta.env.BASE_URL + "data/relationships.json"),
    fetch(import.meta.env.BASE_URL + "data/leadership_positions.json"),
    fetch(import.meta.env.BASE_URL + "data/temples.json"),
  ]);

  const [rawPeople, rawRels, rawPositions] = await Promise.all([
    peopleRes.json(),
    relsRes.json(),
    positionsRes.json(),
  ]);
  // temples.json may not yet exist in older deployments — degrade to empty array.
  const rawTemples = templesRes.ok ? await templesRes.json() : [];

  const people = z.array(PersonSchema).parse(rawPeople) as Person[];
  const relationships = z.array(RelationshipSchema).parse(rawRels) as Relationship[];
  const positions = z.array(PositionSchema).parse(rawPositions) as LeadershipPosition[];
  const temples = z.array(TempleSchema).parse(rawTemples) as Temple[];

  return { people, relationships, positions, temples };
}
