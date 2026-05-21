import { useMemo } from "react";
import { useGraph } from "./hooks/useGraph";
import { getChangeDates, getSnapshot } from "./graph/timeline";
import { describeEvent } from "./utils/describeEvent";
import { TimelinePicker } from "./components/TimelinePicker";
import { MainView } from "./components/MainView";
import { Detail } from "./components/Detail";
import { useState } from "react";

export default function App() {
  const { graph, loading, error } = useGraph();
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const dates = useMemo(() => (graph ? getChangeDates(graph) : []), [graph]);

  // Default to latest date once graph loads
  const resolvedDate = currentDate ?? (dates.length ? dates[dates.length - 1] : null);

  const snapshot = useMemo(
    () => (graph && resolvedDate ? getSnapshot(graph, resolvedDate) : null),
    [graph, resolvedDate]
  );

  const getNoteFor = useMemo(
    () => (graph && dates.length
      ? (date: string) => describeEvent(graph, date, dates)
      : () => ({ title: "", note: "" })),
    [graph, dates]
  );

  const handleSelectDate = (date: string) => {
    setSelectedPersonId(null);
    setCurrentDate(date);
  };

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
          onSelect={handleSelectDate}
        />
      </div>

      <MainView
        snapshot={snapshot}
        graph={graph}
        onSelect={setSelectedPersonId}
      />

      {selectedPersonId && (
        <Detail
          personId={selectedPersonId}
          graph={graph}
          snapshot={snapshot}
          onClose={() => setSelectedPersonId(null)}
          onSwitch={(id) => setSelectedPersonId(id)}
        />
      )}
    </>
  );
}
