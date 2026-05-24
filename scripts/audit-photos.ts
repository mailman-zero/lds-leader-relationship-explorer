// Walk public/photos/, extract whatever copyright info the OS `file`
// command surfaces (EXIF copyright, EXIF description), match each image
// to a person in people.json, and emit data/photo-audit.json — a
// worksheet for filling in license metadata by hand.
//
// Run: node --experimental-strip-types scripts/audit-photos.ts

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const photosDir = join(rootDir, "public", "photos");
const peoplePath = join(rootDir, "data", "people.json");
const outPath = join(rootDir, "data", "photo-audit.json");

type RawPhoto = string | { src: string };
interface Person {
  id: string;
  display_name: string;
  birth_date: string;
  is_leader: boolean;
  photo?: RawPhoto | null;
}

function photoSrc(p: RawPhoto | null | undefined): string | null {
  if (!p) return null;
  return typeof p === "string" ? p : p.src;
}

function fileOutput(path: string): string {
  try {
    return execFileSync("file", ["-b", path], { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function extractField(fileLine: string, key: string): string | null {
  // `file` formats EXIF as "key=value, key=value]" — match up to next ", " or "]"
  const m = fileLine.match(new RegExp(`${key}=([^,\\]]*)`));
  if (!m) return null;
  const v = m[1].trim();
  return v.length ? v : null;
}

function extractDimensions(fileLine: string): { width: number; height: number } | null {
  // matches "..., 500x625" or "..., 500 x 625"
  const m = fileLine.match(/(\d{2,5})\s*x\s*(\d{2,5})/);
  if (!m) return null;
  return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
}

const people: Person[] = JSON.parse(readFileSync(peoplePath, "utf-8"));
const photoToPerson = new Map<string, Person>();
for (const p of people) {
  const src = photoSrc(p.photo);
  if (src) {
    photoToPerson.set(basename(src), p);
  }
}

const files = readdirSync(photosDir).filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));

interface AuditRow {
  filename: string;
  person_id: string | null;
  display_name: string | null;
  birth_date: string | null;
  is_leader: boolean;
  size_bytes: number;
  mtime: string;
  width: number | null;
  height: number | null;
  exif_copyright: string | null;
  exif_description: string | null;
  exif_software: string | null;
  file_output: string;
  current_photo: RawPhoto | null;
}

const images: AuditRow[] = [];
for (const f of files.sort()) {
  const fp = join(photosDir, f);
  const st = statSync(fp);
  const out = fileOutput(fp);
  const dims = extractDimensions(out);
  const person = photoToPerson.get(f) ?? null;
  images.push({
    filename: f,
    person_id: person?.id ?? null,
    display_name: person?.display_name ?? null,
    birth_date: person?.birth_date ?? null,
    is_leader: person?.is_leader ?? false,
    size_bytes: st.size,
    mtime: st.mtime.toISOString(),
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    exif_copyright: extractField(out, "copyright"),
    exif_description: extractField(out, "description"),
    exif_software: extractField(out, "software"),
    file_output: out,
    current_photo: person?.photo ?? null,
  });
}

const orphan_files = images
  .filter((r) => r.person_id === null)
  .map((r) => r.filename);

const missing_leaders = people
  .filter((p) => p.is_leader && !photoSrc(p.photo))
  .map((p) => ({ id: p.id, display_name: p.display_name, birth_date: p.birth_date }));

const exif_copyright_hits = images
  .filter((r) => r.exif_copyright)
  .map((r) => ({ filename: r.filename, person_id: r.person_id, exif_copyright: r.exif_copyright }));

const exif_description_hits = images
  .filter((r) => r.exif_description && r.exif_description.trim().length > 0)
  .map((r) => ({
    filename: r.filename,
    person_id: r.person_id,
    exif_description: r.exif_description,
  }));

const report = {
  generated_at: new Date().toISOString(),
  photos_dir: "public/photos",
  total_images: images.length,
  total_leaders: people.filter((p) => p.is_leader).length,
  leaders_with_photo: people.filter((p) => p.is_leader && photoSrc(p.photo)).length,
  leaders_missing_photo: missing_leaders.length,
  orphan_files,
  missing_leaders,
  exif_copyright_hits,
  exif_description_hits,
  images,
};

writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf-8");

console.log(`Wrote ${outPath}`);
console.log(`  Total images:           ${report.total_images}`);
console.log(`  Leaders with photo:     ${report.leaders_with_photo}`);
console.log(`  Leaders missing photo:  ${report.leaders_missing_photo}`);
console.log(`  Orphan files:           ${report.orphan_files.length}`);
console.log(`  EXIF copyright hits:    ${report.exif_copyright_hits.length}`);
console.log(`  EXIF description hits:  ${report.exif_description_hits.length}`);

if (report.exif_copyright_hits.length > 0) {
  console.log(`\n  Files with EXIF copyright:`);
  for (const h of report.exif_copyright_hits) {
    console.log(`    ${h.filename}: ${h.exif_copyright}`);
  }
}
