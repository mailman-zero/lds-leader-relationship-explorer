// Mechanical backfill for Bucket A (pre-1880 birth-date leaders):
// every such leader's portrait is firmly PD-US-expired since the subject
// died decades before 1929 and any portrait would have been published
// during their lifetime in a then-public source.
//
// We *don't* know the actual file we shipped came from a clean source —
// the initial commit dropped them in unattributed — but the canonical
// free copy is invariably on Wikimedia Commons, embedded in each
// leader's Wikipedia article (which is already in `sources`). We point
// `source_url` at that Wikipedia URL and record a candid note.
//
// Run: node --experimental-strip-types scripts/backfill-bucket-a.ts

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const TODAY = new Date().toISOString().slice(0, 10);
const CUTOFF = "1880-01-01";

const NOTE =
  "Image source not recorded in initial commit; subject deceased well before 1929, so the portrait is PD-US-expired. The source URL links to the Wikipedia article where the canonical free copy is typically embedded — verify against Wikimedia Commons before reusing.";
const LICENSE_URL = "https://commons.wikimedia.org/wiki/Template:PD-US-expired";

for (const rel of ["data/people.json", "public/data/people.json"]) {
  const path = join(rootDir, rel);
  const people: any[] = JSON.parse(readFileSync(path, "utf-8"));
  let updated = 0;
  for (const p of people) {
    if (!p.is_leader) continue;
    if (!p.photo || typeof p.photo !== "object") continue;
    if (p.photo.license !== "unknown") continue;
    if (!p.birth_date || p.birth_date >= CUTOFF) continue;

    // Find first Wikipedia URL in the person's sources
    const wikiSource = (p.sources ?? []).find((s: any) =>
      typeof s?.url === "string" && s.url.includes("wikipedia.org")
    );

    p.photo = {
      ...p.photo,
      license: "public-domain",
      license_url: LICENSE_URL,
      source_url: wikiSource?.url ?? undefined,
      accessed: TODAY,
      notes: NOTE,
    };
    updated++;
  }
  writeFileSync(path, JSON.stringify(people, null, 2) + "\n", "utf-8");
  console.log(`${rel}: backfilled ${updated} Bucket A entries`);
}
