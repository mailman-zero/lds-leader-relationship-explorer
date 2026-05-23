import { useState, useEffect } from "react";
import type { Biography } from "../graph/types";

const cache = new Map<string, Biography | null>();
const inflight = new Map<string, Promise<Biography | null>>();

function fetchBio(personId: string): Promise<Biography | null> {
  if (inflight.has(personId)) return inflight.get(personId)!;
  const p = fetch(import.meta.env.BASE_URL + `data/bios/${personId}.json`)
    .then((r) => {
      if (!r.ok) return null;
      return r.json() as Promise<Biography>;
    })
    .catch(() => null)
    .then((bio) => {
      cache.set(personId, bio);
      inflight.delete(personId);
      return bio;
    });
  inflight.set(personId, p);
  return p;
}

export function useBiography(personId: string | null): Biography | null {
  const [bio, setBio] = useState<Biography | null>(() =>
    personId && cache.has(personId) ? cache.get(personId)! : null
  );

  useEffect(() => {
    if (!personId) return;
    if (cache.has(personId)) {
      setBio(cache.get(personId)!);
      return;
    }
    fetchBio(personId).then(setBio);
  }, [personId]);

  return bio;
}
