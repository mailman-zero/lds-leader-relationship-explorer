import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../data");

function load(file: string) {
  return JSON.parse(readFileSync(join(dataDir, file), "utf-8"));
}

const people: any[] = load("people.json");
const relationships: any[] = load("relationships.json");
const positions: any[] = load("leadership_positions.json");

let errors = 0;
let warnings = 0;

function error(msg: string) {
  console.error(`  ERROR: ${msg}`);
  errors++;
}

function warn(msg: string) {
  console.warn(`  WARN:  ${msg}`);
  warnings++;
}

function pass(msg: string) {
  console.log(`  OK:    ${msg}`);
}

// --- Check 1: No duplicate IDs ---
console.log("\n[1] Duplicate IDs");
const personIds = new Set<string>();
for (const p of people) {
  if (personIds.has(p.id)) error(`Duplicate person ID: ${p.id}`);
  else personIds.add(p.id);
}
const relIds = new Set<string>();
for (const r of relationships) {
  if (relIds.has(r.id)) error(`Duplicate relationship ID: ${r.id}`);
  else relIds.add(r.id);
}
const posIds = new Set<string>();
for (const p of positions) {
  if (posIds.has(p.id)) error(`Duplicate position ID: ${p.id}`);
  else posIds.add(p.id);
}
if (errors === 0) pass("No duplicate IDs");

// --- Check 2: All referenced person IDs resolve ---
console.log("\n[2] Referential integrity");
let refErrors = 0;
for (const r of relationships) {
  if (r.type === "parent-child") {
    if (!personIds.has(r.parent_id)) { error(`Relationship ${r.id}: unknown parent_id '${r.parent_id}'`); refErrors++; }
    if (!personIds.has(r.child_id)) { error(`Relationship ${r.id}: unknown child_id '${r.child_id}'`); refErrors++; }
  } else {
    if (!personIds.has(r.person_a_id)) { error(`Relationship ${r.id}: unknown person_a_id '${r.person_a_id}'`); refErrors++; }
    if (!personIds.has(r.person_b_id)) { error(`Relationship ${r.id}: unknown person_b_id '${r.person_b_id}'`); refErrors++; }
  }
}
for (const pos of positions) {
  if (!personIds.has(pos.person_id)) { error(`Position ${pos.id}: unknown person_id '${pos.person_id}'`); refErrors++; }
}
if (refErrors === 0) pass("All person ID references resolve");

// --- Check 3: Self-referential relationships ---
console.log("\n[3] Self-referential relationships");
let selfErrors = 0;
for (const r of relationships) {
  if (r.type === "parent-child" && r.parent_id === r.child_id) {
    error(`Relationship ${r.id}: person is own parent`); selfErrors++;
  }
  if ((r.type === "spouse" || r.type === "sibling") && r.person_a_id === r.person_b_id) {
    error(`Relationship ${r.id}: person is own ${r.type}`); selfErrors++;
  }
}
if (selfErrors === 0) pass("No self-referential relationships");

// --- Check 4: seniority_date consistent per person ---
console.log("\n[4] Seniority date consistency");
const seniority = new Map<string, string>();
let seniorityErrors = 0;
for (const pos of positions) {
  if (!["q12-member", "q12-president", "fp-first-counselor", "fp-second-counselor", "fp-counselor", "church-president"].includes(pos.position_code)) continue;
  const existing = seniority.get(pos.person_id);
  if (existing && existing !== pos.seniority_date) {
    error(`Person ${pos.person_id}: inconsistent seniority_date (${existing} vs ${pos.seniority_date})`);
    seniorityErrors++;
  } else {
    seniority.set(pos.person_id, pos.seniority_date);
  }
}
if (seniorityErrors === 0) pass("seniority_date consistent across all position records");

// --- Check 5: No overlapping active position records for same person+quorum ---
console.log("\n[5] Overlapping positions");
const fpCodes = new Set(["fp-first-counselor", "fp-second-counselor", "fp-counselor", "church-president"]);
const q12Codes = new Set(["q12-member", "q12-president"]);
let overlapErrors = 0;

function overlaps(a: any, b: any): boolean {
  const aEnd = a.release_date ?? "9999-99-99";
  const bEnd = b.release_date ?? "9999-99-99";
  // Strict < so same-day transitions (end date == next start date) are not flagged
  return a.ordination_date < bEnd && b.ordination_date < aEnd;
}

const byPerson = new Map<string, any[]>();
for (const pos of positions) {
  const arr = byPerson.get(pos.person_id) ?? [];
  arr.push(pos);
  byPerson.set(pos.person_id, arr);
}

for (const [personId, posList] of byPerson) {
  const fpPositions = posList.filter((p) => fpCodes.has(p.position_code));
  const q12Positions = posList.filter((p) => q12Codes.has(p.position_code));

  for (let i = 0; i < fpPositions.length; i++) {
    for (let j = i + 1; j < fpPositions.length; j++) {
      if (overlaps(fpPositions[i], fpPositions[j])) {
        error(`Person ${personId}: overlapping FP positions: ${fpPositions[i].id} and ${fpPositions[j].id}`);
        overlapErrors++;
      }
    }
  }
  // q12-member is a continuous lifetime span; q12-president overlays on top.
  // Allow q12-member ↔ q12-president overlap for the same person, but flag
  // duplicates within the same code.
  const q12MemberRecords = q12Positions.filter((p) => p.position_code === "q12-member");
  const q12PresidentRecords = q12Positions.filter((p) => p.position_code === "q12-president");
  for (let i = 0; i < q12MemberRecords.length; i++) {
    for (let j = i + 1; j < q12MemberRecords.length; j++) {
      if (overlaps(q12MemberRecords[i], q12MemberRecords[j])) {
        error(`Person ${personId}: overlapping q12-member positions: ${q12MemberRecords[i].id} and ${q12MemberRecords[j].id}`);
        overlapErrors++;
      }
    }
  }
  for (let i = 0; i < q12PresidentRecords.length; i++) {
    for (let j = i + 1; j < q12PresidentRecords.length; j++) {
      if (overlaps(q12PresidentRecords[i], q12PresidentRecords[j])) {
        error(`Person ${personId}: overlapping q12-president positions: ${q12PresidentRecords[i].id} and ${q12PresidentRecords[j].id}`);
        overlapErrors++;
      }
    }
  }
}
if (overlapErrors === 0) pass("No overlapping position records for same person+quorum");

// --- Check 6: Every relationship has sources ---
console.log("\n[6] Sources present");
let sourceErrors = 0;
for (const r of relationships) {
  if (!r.sources || r.sources.length === 0) { warn(`Relationship ${r.id}: no sources`); sourceErrors++; }
}
for (const pos of positions) {
  if (!pos.sources || pos.sources.length === 0) { warn(`Position ${pos.id}: no sources`); sourceErrors++; }
}
if (sourceErrors === 0) pass("All records have at least one source");

// --- Check 7: Every leader has at least one position ---
console.log("\n[7] Leaders have positions");
const leadersWithPositions = new Set(positions.map((p: any) => p.person_id));
let leaderErrors = 0;
for (const person of people) {
  if (person.is_leader && !leadersWithPositions.has(person.id)) {
    warn(`Leader ${person.id} (${person.display_name}) has no position records`);
    leaderErrors++;
  }
}
if (leaderErrors === 0) pass("All leaders have at least one position record");

// --- Check 8: Date format sanity ---
console.log("\n[8] Date format");
const ISO_PATTERN = /^\d{4}(-\d{2}(-\d{2})?)?$/;
let dateErrors = 0;
for (const pos of positions) {
  if (!ISO_PATTERN.test(pos.ordination_date)) {
    error(`Position ${pos.id}: invalid ordination_date '${pos.ordination_date}'`);
    dateErrors++;
  }
  if (pos.release_date && !ISO_PATTERN.test(pos.release_date)) {
    error(`Position ${pos.id}: invalid release_date '${pos.release_date}'`);
    dateErrors++;
  }
  if (pos.release_date && pos.ordination_date > pos.release_date) {
    error(`Position ${pos.id}: ordination_date is after release_date`);
    dateErrors++;
  }
}
if (dateErrors === 0) pass("All dates are valid ISO 8601");

// --- Summary ---
console.log("\n--- Summary ---");
console.log(`  People:        ${people.length}`);
console.log(`  Relationships: ${relationships.length}`);
console.log(`  Positions:     ${positions.length}`);
console.log(`  Errors:        ${errors}`);
console.log(`  Warnings:      ${warnings}`);

if (errors > 0) {
  console.error(`\n✗ Validation failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log(`\n✓ Validation passed${warnings > 0 ? ` (${warnings} warning(s))` : ""}.`);
}
