import { useEffect, useMemo, useState } from "react";
import type { Graph, Snapshot } from "../graph/types";
import { getAllPaths } from "../graph/traversal";
import { deriveLabel, formatPath } from "../graph/labeler";
import { getPersonTimeline } from "../graph/timeline";
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

function shortDate(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[m - 1]} ${y}`;
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
  onNavigateToDate: (date: string) => void;
}

export function Detail({ personId, graph, snapshot, onClose, onSwitch, onNavigateToDate }: DetailProps) {
  const person = graph.people.get(personId);
  const bio = useBiography(personId);
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Close the timeline whenever the user switches to a different person.
  useEffect(() => { setTimelineOpen(false); }, [personId]);

  const personEvents = useMemo(() => getPersonTimeline(graph, personId), [graph, personId]);
  const personTemples = useMemo(
    () =>
      graph.temples
        .filter((t) => t.dedicated_by === personId)
        .sort((a, b) => a.dedication_date.localeCompare(b.dedication_date)),
    [graph, personId]
  );

  const allActive = [
    snapshot.president,
    snapshot.first_presidency.first_counselor,
    snapshot.first_presidency.second_counselor,
    ...snapshot.first_presidency.additional_counselors,
    ...snapshot.quorum_of_twelve,
  ].filter(Boolean);

  const myPosition = allActive.find(p => p?.person_id === personId);

  // For deceased/historical leaders the snapshot has no current position. Fall
  // back to their highest-ranking historical position so the pill still shows
  // and can toggle the per-person timeline.
  const POSITION_RANK: Record<string, number> = {
    "church-president": 6,
    "fp-first-counselor": 5,
    "fp-second-counselor": 4,
    "fp-counselor": 3,
    "q12-president": 2,
    "q12-member": 1,
  };
  const historicalBest = useMemo(() => {
    if (myPosition) return null;
    let best: { position_code: string; ordination_date: string } | null = null;
    for (const p of graph.positions) {
      if (p.person_id !== personId) continue;
      const rank = POSITION_RANK[p.position_code] ?? 0;
      if (!best || rank > (POSITION_RANK[best.position_code] ?? 0)) {
        best = { position_code: p.position_code, ordination_date: p.ordination_date };
      }
    }
    return best;
  }, [graph, personId, myPosition]);

  const displayedRoleCode = myPosition?.position_code ?? historicalBest?.position_code ?? null;
  const mainGroup = displayedRoleCode?.startsWith("fp") || displayedRoleCode === "church-president"
    ? "First Presidency"
    : displayedRoleCode?.startsWith("q12")
    ? "Quorum of the Twelve Apostles"
    : null;
  const mainRole = displayedRoleCode ? positionLabel(displayedRoleCode) : null;
  const pillDateLabel = myPosition ? formatDate(snapshot.date) : "Historical";

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
            {person?.photo && (
              <div className="hero-portrait-caption">
                <a href={`#/credits#${personId}`}>
                  {person.photo.license === "unknown"
                    ? "Source pending"
                    : person.photo.license === "public-domain"
                    ? "Public domain"
                    : person.photo.license === "non-free"
                    ? "Non-free"
                    : person.photo.license.toUpperCase()}
                </a>
              </div>
            )}
          </div>

          <div className="hero-info">
            {mainGroup && <div className="hero-eyebrow">{mainGroup}</div>}
            <h1 className="hero-name">{person?.display_name}</h1>
            {person?.disambiguator && (
              <div className="hero-disambiguator">{person.disambiguator}</div>
            )}
            {mainRole && personEvents.length > 0 && (
              <button
                type="button"
                className={`pill pill-toggle ${timelineOpen ? "open" : ""}`}
                aria-expanded={timelineOpen}
                aria-controls="person-timeline"
                onClick={() => setTimelineOpen((o) => !o)}
              >
                <b>{mainRole}</b>
                {mainGroup && <><span style={{ opacity: 0.55 }}>·</span>{mainGroup}</>}
                <span style={{ opacity: 0.55 }}>·</span>
                {pillDateLabel}
                <span className="caret" aria-hidden="true">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
            )}
            {mainRole && personEvents.length === 0 && (
              <span className="pill">
                <b>{mainRole}</b>
                {mainGroup && <><span style={{ opacity: 0.55 }}>·</span>{mainGroup}</>}
                <span style={{ opacity: 0.55 }}>·</span>
                {pillDateLabel}
              </span>
            )}

            {timelineOpen && personEvents.length > 0 && (() => {
              const first = new Date(personEvents[0].date).getTime();
              const last = new Date(personEvents[personEvents.length - 1].date).getTime();
              const span = Math.max(1, last - first);
              return (
                <div id="person-timeline" className="person-timeline" role="region" aria-label="Events for this person">
                  <div className="pt-meta">
                    <span className="lbl">Leadership events</span>
                    <span className="count">{personEvents.length} {personEvents.length === 1 ? "event" : "events"}</span>
                  </div>
                  <div className="pt-rule">
                    {personEvents.flatMap((ev) => {
                      const pct = personEvents.length === 1
                        ? 50
                        : ((new Date(ev.date).getTime() - first) / span) * 100;
                      return [
                        <button
                          key={`dot-${ev.date}-${ev.type}`}
                          type="button"
                          className={`tl-dot ${ev.hypothetical ? "hypothetical" : ""} ${ev.type === "death" ? "death" : ""}`}
                          style={{ left: `${pct}%` }}
                          onClick={() => onNavigateToDate(ev.navigate_date)}
                          aria-label={`${formatDate(ev.date)}: ${ev.label}`}
                        />,
                        <div
                          key={`tip-${ev.date}-${ev.type}`}
                          className="tl-tooltip"
                          style={{ left: `${pct}%` }}
                        >
                          <span className="d">{formatDate(ev.date)}</span>
                          {ev.label}
                        </div>,
                      ];
                    })}
                  </div>
                  <div className="tl-axis">
                    <span>{shortDate(personEvents[0].date)}</span>
                    {personEvents.length > 1 && <span>{shortDate(personEvents[personEvents.length - 1].date)}</span>}
                  </div>
                </div>
              );
            })()}

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
            {personTemples.length > 0 && (
              <div className="bio-prose">
                <div className="bio-prose-label">
                  Temples Dedicated
                  <span className="bio-prose-count">{personTemples.length}</span>
                </div>
                <div className="temple-grid">
                  {personTemples.map((t) => (
                    <div className="temple-card" key={t.id}>
                      <div className="name">{t.name}</div>
                      <div className="date">
                        {formatFlexDate(t.dedication_date)}
                        {t.type === "rededication" && <span className="tag">Rededication</span>}
                      </div>
                    </div>
                  ))}
                </div>
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
            <h3>Current Leaders</h3>
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
                    disambiguator={rel?.disambiguator}
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
            <h3>Historical Leaders</h3>
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
                    disambiguator={rel?.disambiguator}
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
