import { useEffect, useMemo } from "react";
import type { Graph, Snapshot } from "../graph/types";
import { getAllPaths } from "../graph/traversal";
import { deriveLabel, formatPath } from "../graph/labeler";
import { Card } from "./Card";
import { Portrait } from "./Portrait";
import { useBiography } from "../hooks/useBiography";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[m - 1]} ${d}, ${y}`;
}

function formatFlexDate(s: string | null | undefined): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDate(s);
  return s;
}

function positionLabel(code: string): string {
  if (code === "church-president") return "President of the Church";
  if (code === "fp-first-counselor") return "First Counselor";
  if (code === "fp-second-counselor") return "Second Counselor";
  if (code === "fp-counselor") return "Counselor";
  if (code === "q12-president") return "President of the Twelve";
  if (code === "q12-member") return "Member";
  return code;
}

interface DetailProps {
  personId: string;
  graph: Graph;
  snapshot: Snapshot;
  onClose: () => void;
  onSwitch: (id: string) => void;
}

export function Detail({ personId, graph, snapshot, onClose, onSwitch }: DetailProps) {
  const person = graph.people.get(personId);
  const bio = useBiography(personId);

  const allActive = [
    snapshot.president,
    snapshot.first_presidency.first_counselor,
    snapshot.first_presidency.second_counselor,
    ...snapshot.first_presidency.additional_counselors,
    ...snapshot.quorum_of_twelve,
  ].filter(Boolean);

  const myPosition = allActive.find(p => p?.person_id === personId);
  const mainGroup = myPosition?.position_code.startsWith("fp") || myPosition?.position_code === "church-president"
    ? "First Presidency"
    : myPosition?.position_code.startsWith("q12")
    ? "Quorum of the Twelve Apostles"
    : null;
  const mainRole = myPosition ? positionLabel(myPosition.position_code) : null;

  const currentLeaderIds = new Set(
    allActive.filter(Boolean).map(p => p!.person_id)
  );

  const familyPaths = useMemo(() => {
    const allPaths = getAllPaths(graph, personId, { maxDepth: 20, leadersOnly: true });
    const result: { personId: string; label: string; pathText: string }[] = [];
    for (const [targetId, pathResult] of allPaths) {
      if (targetId === personId) continue;
      const label = deriveLabel(pathResult.hops, graph);
      const pathText = formatPath(pathResult.hops, graph);
      result.push({ personId: targetId, label, pathText });
    }
    result.sort((a, b) => {
      const aLen = allPaths.get(a.personId)?.path_length ?? 99;
      const bLen = allPaths.get(b.personId)?.path_length ?? 99;
      return aLen - bLen || a.label.localeCompare(b.label);
    });
    return result;
  }, [personId, graph]);

  const currentRelated = familyPaths.filter(r => currentLeaderIds.has(r.personId));
  const historicalRelated = familyPaths.filter(r => !currentLeaderIds.has(r.personId) && graph.people.get(r.personId)?.is_leader);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const hasRelations = currentRelated.length > 0 || historicalRelated.length > 0;

  // Use bio stats if available, fall back to people.json fields
  const displayBorn = formatFlexDate(bio?.born ?? person?.birth_date);
  const displayBornPlace = bio?.birth_place ?? person?.birth_place ?? null;
  const displayDied = formatFlexDate(bio?.died ?? person?.death_date);
  const displayDiedPlace = bio?.death_place ?? person?.death_place ?? null;

  // Split life_summary on double-newline so multi-paragraph prose renders properly
  const lifeParagraphs = bio?.life_summary
    ? bio.life_summary.split(/\n\n+/).filter(Boolean)
    : [];

  return (
    <div className="detail-veil" role="dialog" aria-modal="true">
      <button className="back" onClick={onClose} aria-label="Return to chart" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>

      <div className="detail">

        {/* ── Hero: portrait left, bio info right ── */}
        <div className="hero-split" key={personId}>

          <div className="hero-portrait">
            <Portrait name={person?.display_name} photo={person?.photo} />
          </div>

          <div className="hero-info">
            {mainGroup && <div className="hero-eyebrow">{mainGroup}</div>}
            <h1 className="hero-name">{person?.display_name}</h1>
            {mainRole && (
              <span className="pill">
                <b>{mainRole}</b>
                {mainGroup && <><span style={{ opacity: 0.55 }}>·</span>{mainGroup}</>}
                <span style={{ opacity: 0.55 }}>·</span>
                {formatDate(snapshot.date)}
              </span>
            )}

            {/* Stats */}
            <dl className="bio-stats">
              {displayBorn && (
                <div className="bio-stat">
                  <dt>Born</dt>
                  <dd>{displayBorn}{displayBornPlace && <> · {displayBornPlace}</>}</dd>
                </div>
              )}
              {displayDied && (
                <div className="bio-stat">
                  <dt>Died</dt>
                  <dd>{displayDied}{displayDiedPlace && <> · {displayDiedPlace}</>}</dd>
                </div>
              )}
              {bio?.burial_place && (
                <div className="bio-stat">
                  <dt>Burial</dt>
                  <dd>
                    {bio.find_a_grave_url
                      ? <a href={bio.find_a_grave_url} target="_blank" rel="noopener noreferrer">{bio.burial_place}</a>
                      : bio.burial_place}
                  </dd>
                </div>
              )}
              {bio?.spouses && bio.spouses.length > 0 && bio.spouses.map((s, i) => (
                <div className="bio-stat" key={i}>
                  <dt>{i === 0 ? (bio.spouses.length === 1 ? "Spouse" : "Spouses") : ""}</dt>
                  <dd>
                    {s.name}
                    {s.marriage_date && <> (m. {s.marriage_date})</>}
                    {s.marriage_end_date && <>, d. {s.marriage_end_date}</>}
                  </dd>
                </div>
              ))}
              {bio?.mission && (
                <div className="bio-stat">
                  <dt>Mission</dt>
                  <dd>{bio.mission.location} · {bio.mission.years}</dd>
                </div>
              )}
            </dl>

            {/* Life outside the Church */}
            {lifeParagraphs.length > 0 && (
              <div className="bio-prose">
                <div className="bio-prose-label">Life</div>
                {lifeParagraphs.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}

            {/* Church service */}
            {bio?.church_summary && (
              <div className="bio-prose">
                <div className="bio-prose-label">Church Service</div>
                <p>{bio.church_summary}</p>
              </div>
            )}

            {/* Teaching emphasis chips */}
            {bio?.teaching_emphasis && bio.teaching_emphasis.length > 0 && (
              <div className="bio-chips">
                {bio.teaching_emphasis.map((t, i) => (
                  <span className="bio-chip" key={i}>{t}</span>
                ))}
              </div>
            )}

            {/* Temples dedicated */}
            {bio?.temples_dedicated && bio.temples_dedicated.length > 0 && (
              <div className="bio-prose">
                <div className="bio-prose-label">Temples Dedicated</div>
                <ul className="bio-temple-list">
                  {bio.temples_dedicated.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ── Family relationships ── */}
        <div className="relation-intro">
          <span className="rule" />
          <span className="label">Family relationships</span>
          <span className="rule" />
        </div>

        {!hasRelations && (
          <div style={{ color: "var(--muted)", marginTop: 24, fontFamily: "var(--mono)", fontSize: 13, letterSpacing: "0.06em" }}>
            No known family relationships to other leaders in the dataset.
          </div>
        )}

        {currentRelated.length > 0 && (
          <div className="relation-section">
            <h3>Current leaders</h3>
            <div className="rs-asof">as of {formatDate(snapshot.date)}</div>
            <div className="rs-sub">
              {currentRelated.length} {currentRelated.length === 1 ? "connection" : "connections"} · hover to see the path
            </div>
            <div className="relation-grid">
              {currentRelated.map(r => {
                const rel = graph.people.get(r.personId);
                return (
                  <Card
                    key={r.personId}
                    name={rel?.display_name}
                    photo={rel?.photo}
                    role={r.label}
                    tooltip={{ label: r.label, text: r.pathText }}
                    onClick={() => onSwitch(r.personId)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {historicalRelated.length > 0 && (
          <div className="relation-section">
            <h3>Historical leaders</h3>
            <div className="rs-sub">
              {historicalRelated.length} {historicalRelated.length === 1 ? "connection" : "connections"} · hover to see the path
            </div>
            <div className="relation-grid">
              {historicalRelated.map(r => {
                const rel = graph.people.get(r.personId);
                return (
                  <Card
                    key={r.personId}
                    name={rel?.display_name}
                    photo={rel?.photo}
                    role={r.label}
                    tooltip={{ label: r.label, text: r.pathText }}
                    onClick={() => onSwitch(r.personId)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
