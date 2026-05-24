import { useState, useEffect, useMemo } from "react";
import { useGraph } from "./hooks/useGraph";
import { getChangeDates, getSnapshot } from "./graph/timeline";
import { describeEvent } from "./utils/describeEvent";
import { TimelinePicker } from "./components/TimelinePicker";
import { MainView } from "./components/MainView";
import { Detail } from "./components/Detail";
import { RelationshipVisualizer } from "./components/RelationshipVisualizer";

type ParsedHash =
  | { view: "leaders"; date?: string; personId?: string }
  | { view: "visualizer"; personId?: string };

function parseHash(hash: string): ParsedHash {
  const path = hash.replace(/^#/, "");
  const viz = path.match(/^\/visualizer(?:\/person\/([^/]+))?$/);
  if (viz) return { view: "visualizer", personId: viz[1] };
  const leaders = path.match(/^\/fp\/([^/]+)(?:\/person\/([^/]+))?$/);
  if (leaders) return { view: "leaders", date: leaders[1], personId: leaders[2] };
  return { view: "leaders" };
}

function useHashParams() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return parseHash(hash);
}

function navigate(path: string) {
  window.location.hash = path;
}

export default function App() {
  const parsed = useHashParams();
  const { graph, loading, error } = useGraph();

  const dates = useMemo(() => (graph ? getChangeDates(graph) : []), [graph]);

  useEffect(() => {
    if (parsed.view !== "leaders") return;
    if (dates.length > 0 && !parsed.date) {
      navigate("/fp/" + dates[dates.length - 1]);
    }
  }, [dates, parsed]);

  const latestDate = dates.length ? dates[dates.length - 1] : null;
  const resolvedDate =
    parsed.view === "leaders" ? parsed.date ?? latestDate : latestDate;

  const snapshot = useMemo(
    () => (graph && resolvedDate ? getSnapshot(graph, resolvedDate) : null),
    [graph, resolvedDate]
  );

  const getNoteFor = useMemo(
    () =>
      graph && dates.length
        ? (d: string) => describeEvent(graph, d, dates)
        : () => ({ title: "", note: "" }),
    [graph, dates]
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "var(--mono)", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  if (error || !graph || !snapshot || !resolvedDate) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)" }}>
        {error ?? "Failed to load data."}
      </div>
    );
  }

  const isVisualizer = parsed.view === "visualizer";

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <div className="eyebrow">The Church of Jesus Christ of Latter-day Saints</div>
          <h1>
            {isVisualizer ? (
              <>Relationship <em>Visualizer</em></>
            ) : (
              <>First Presidency <em>&amp;</em> Quorum of the Twelve Apostles</>
            )}
          </h1>
        </div>
        {isVisualizer ? (
          <div className="viz-topbar-slot">
            <button
              type="button"
              className="viz-close"
              aria-label="Close visualizer"
              onClick={() => navigate("/fp/" + resolvedDate)}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="leaders-topbar-slot">
            <TimelinePicker
              dates={dates}
              currentDate={resolvedDate}
              getNoteFor={getNoteFor}
              onSelect={(d) => navigate("/fp/" + d)}
            />
          </div>
        )}
      </div>

      {isVisualizer ? (
        <RelationshipVisualizer
          graph={graph}
          onSelect={(id) => navigate("/visualizer/person/" + id)}
        />
      ) : (
        <MainView
          snapshot={snapshot}
          graph={graph}
          onSelect={(id) => navigate("/fp/" + resolvedDate + "/person/" + id)}
        />
      )}

      {parsed.personId && (
        <Detail
          personId={parsed.personId}
          graph={graph}
          snapshot={snapshot}
          onClose={() =>
            navigate(isVisualizer ? "/visualizer" : "/fp/" + resolvedDate)
          }
          onSwitch={(id) =>
            navigate(
              isVisualizer
                ? "/visualizer/person/" + id
                : "/fp/" + resolvedDate + "/person/" + id
            )
          }
          onNavigateToDate={(d) => navigate("/fp/" + d)}
        />
      )}

      {/* Pill outside .topbar (backdrop-filter traps position:fixed descendants).
          On desktop it floats fixed top-right; on mobile it sits in document
          flow at the very bottom of the page so it doesn't cover content. */}
      {!isVisualizer && (
        <button
          type="button"
          className="viz-pill"
          onClick={() => navigate("/visualizer")}
        >
          <span className="viz-pill__icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="12" height="12">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="8" cy="2.5" r="1.3" fill="currentColor" />
              <circle cx="13" cy="8" r="1.3" fill="currentColor" />
              <circle cx="8" cy="13.5" r="1.3" fill="currentColor" />
              <circle cx="3" cy="8" r="1.3" fill="currentColor" />
            </svg>
          </span>
          Relationship Visualizer
        </button>
      )}
    </>
  );
}
