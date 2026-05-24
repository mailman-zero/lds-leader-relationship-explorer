// One-shot migration: convert each Person.photo from a string
// ("/photos/foo.jpg") to a PhotoCredit object. License is left as
// "unknown" — to be filled in by the audit follow-up. After this runs
// once, scripts/validate-data.ts check [11] takes over.
//
// Run: node --experimental-strip-types scripts/migrate-photo-shape.ts

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const TODAY = new Date().toISOString().slice(0, 10);

for (const rel of ["data/people.json", "public/data/people.json"]) {
  const path = join(rootDir, rel);
  const raw = readFileSync(path, "utf-8");
  const people: any[] = JSON.parse(raw);
  let migrated = 0;
  for (const p of people) {
    if (typeof p.photo === "string") {
      p.photo = {
        src: p.photo,
        license: "unknown",
        accessed: TODAY,
      };
      migrated++;
    }
  }
  writeFileSync(path, JSON.stringify(people, null, 2) + "\n", "utf-8");
  console.log(`${rel}: migrated ${migrated} photo entries`);
}
