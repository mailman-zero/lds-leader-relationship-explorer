import { useState, useEffect, useMemo } from "react";
import { useGraph } from "./hooks/useGraph";
import { getChangeDates, getSnapshot } from "./graph/timeline";
import { describeEvent } from "./utils/describeEvent";
import { TimelinePicker } from "./components/TimelinePicker";
import { MainView } from "./components/MainView";
import { Detail } from "./components/Detail";

function parseHash(hash: string): { date?: string; personId?: string } {
  const path = hash.replace(/^#/, "");
  const m = path.match(/^\/fp\/([^/]+)(?:\/person\/([^/]+))?$/);
  if (m) return { date: m[1], personId: m[2] };
  return {};
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
  const { date, personId } = useHashParams();
  const { graph, loading, error } = useGraph();

  const dates = useMemo(() => (graph ? getChangeDates(graph) : []), [graph]);

  useEffect(() => {
    if (dates.length > 0 && !date) {
      navigate("/fp/" + dates[dates.length - 1]);
    }
  }, [dates, date]);

  const resolvedDate = date ?? (dates.length ? dates[dates.length - 1] : null);

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

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <div className="eyebrow">The Church of Jesus Christ of Latter-day Saints</div>
          <h1>First Presidency <em>&amp;</em> Quorum of the Twelve Apostles</h1>
        </div>
        <TimelinePicker
          dates={dates}
          currentDate={resolvedDate}
          getNoteFor={getNoteFor}
          onSelect={(d) => navigate("/fp/" + d)}
        />
      </div>

      <MainView
        snapshot={snapshot}
        graph={graph}
        onSelect={(id) => navigate("/fp/" + resolvedDate + "/person/" + id)}
      />

      {personId && (
        <Detail
          personId={personId}
          graph={graph}
          snapshot={snapshot}
          onClose={() => navigate("/fp/" + resolvedDate)}
          onSwitch={(id) => navigate("/fp/" + resolvedDate + "/person/" + id)}
        />
      )}
    </>
  );
}
