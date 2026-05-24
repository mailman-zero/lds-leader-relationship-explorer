import { useEffect } from "react";
import type { Graph, PhotoCredit, PhotoLicense } from "../graph/types.ts";

interface CreditsProps {
  graph: Graph;
  anchor?: string;
}

interface Row {
  personId: string;
  displayName: string;
  birthDate: string;
  photo: PhotoCredit;
}

const LICENSE_ORDER: PhotoLicense[] = [
  "public-domain",
  "cc-zero",
  "cc-by",
  "cc-by-sa",
  "permission-granted",
  "fair-use",
  "unknown",
  "non-free",
];

const LICENSE_LABEL: Record<PhotoLicense, string> = {
  "public-domain": "Public Domain",
  "cc-zero": "CC0 (Public Domain Dedication)",
  "cc-by": "CC BY (Attribution)",
  "cc-by-sa": "CC BY-SA (Attribution-ShareAlike)",
  "permission-granted": "Permission Granted",
  "fair-use": "Fair Use",
  "unknown": "Unknown — pending audit",
  "non-free": "Non-Free — slated for removal",
};

const LICENSE_DESCRIPTION: Record<PhotoLicense, string> = {
  "public-domain":
    "No copyright restrictions. Either pre-1929 publication (US PD-expired) or author deceased over 100 years.",
  "cc-zero":
    "Released by rights-holder into the public domain via CC0.",
  "cc-by":
    "Free to reuse with attribution to the rights-holder.",
  "cc-by-sa":
    "Free to reuse with attribution; derivative works must use the same license.",
  "permission-granted":
    "The rights-holder explicitly permits this specific use (e.g. Church Newsroom media-library terms).",
  "fair-use":
    "Low-resolution image used under fair-use principles for identification/education.",
  "unknown":
    "Origin and license have not yet been verified. Listed here for transparency while research is in progress.",
  "non-free":
    "Confirmed not redistributable. These entries indicate images that should be removed; they may not have an actual file in this build.",
};

function resolveSrc(src: string): string {
  return src.startsWith("/") ? import.meta.env.BASE_URL + src.slice(1) : src;
}

export function Credits({ graph, anchor }: CreditsProps) {
  useEffect(() => {
    if (!anchor) return;
    const tryScroll = () => {
      const el = document.getElementById(`credit-${anchor}`);
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    };
    requestAnimationFrame(tryScroll);
    // Retry after thumbnails likely loaded so the anchor row hasn't drifted.
    const t = setTimeout(tryScroll, 300);
    return () => clearTimeout(t);
  }, [anchor]);

  const rows: Row[] = [];
  for (const p of graph.people.values()) {
    if (!p.photo) continue;
    rows.push({
      personId: p.id,
      displayName: p.display_name,
      birthDate: p.birth_date,
      photo: p.photo,
    });
  }
  rows.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const grouped = new Map<PhotoLicense, Row[]>();
  for (const r of rows) {
    const arr = grouped.get(r.photo.license) ?? [];
    arr.push(r);
    grouped.set(r.photo.license, arr);
  }

  return (
    <main className="credits-page">
      <header className="credits-head">
        <p>
          Every portrait shown in this site is listed below with its license
          status, the rights-holder where known, and a link to the source.
          This page exists so that anyone using or forking this project can
          see exactly what each image's terms are.
        </p>
        <p>
          The audit is an ongoing effort. Images marked{" "}
          <em>unknown</em> have not yet been traced to a verified source —
          they are shown here for transparency, not as an endorsement that
          they are free to redistribute. Images marked <em>non-free</em>{" "}
          have been confirmed as copyrighted by a third party and are
          slated for removal from this build.
        </p>
      </header>

      {LICENSE_ORDER.map((license) => {
        const entries = grouped.get(license);
        if (!entries || entries.length === 0) return null;
        return (
          <section key={license} className="credits-section">
            <h2 className={`credits-section-head license-${license}`}>
              {LICENSE_LABEL[license]} <span className="count">({entries.length})</span>
            </h2>
            <p className="credits-section-desc">{LICENSE_DESCRIPTION[license]}</p>
            <ul className="credits-list">
              {entries.map((r) => (
                <li
                  key={r.personId}
                  id={`credit-${r.personId}`}
                  className="credits-row"
                >
                  <div className="credits-thumb">
                    <img
                      src={resolveSrc(r.photo.src)}
                      alt={r.displayName}
                      loading="lazy"
                    />
                  </div>
                  <div className="credits-meta">
                    <div className="credits-name">
                      <a href={`#/visualizer/person/${r.personId}`}>
                        {r.displayName}
                      </a>{" "}
                      <span className="credits-years">(b. {r.birthDate.slice(0, 4)})</span>
                    </div>
                    {r.photo.credit && (
                      <div className="credits-credit">{r.photo.credit}</div>
                    )}
                    {r.photo.rights_holder && (
                      <div className="credits-holder">
                        Rights holder: {r.photo.rights_holder}
                      </div>
                    )}
                    {r.photo.notes && (
                      <div className="credits-notes">{r.photo.notes}</div>
                    )}
                    <div className="credits-links">
                      {r.photo.source_url && (
                        <a
                          href={r.photo.source_url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Source
                        </a>
                      )}
                      {r.photo.license_url && (
                        <a
                          href={r.photo.license_url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          License
                        </a>
                      )}
                      <span className="credits-accessed">
                        accessed {r.photo.accessed}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
