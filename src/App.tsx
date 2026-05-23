import { useMemo, useEffect } from "react";
import { Routes, Route, useParams, useNavigate, Navigate } from "react-router-dom";
import { useGraph } from "./hooks/useGraph";
import { getChangeDates, getSnapshot } from "./graph/timeline";
import { describeEvent } from "./utils/describeEvent";
import { TimelinePicker } from "./components/TimelinePicker";
import { MainView } from "./components/MainView";
import { Detail } from "./components/Detail";

function RedirectToLatest() {
  const { graph, loading, error } = useGraph();
  const navigate = useNavigate();

  const dates = useMemo(() => (graph ? getChangeDates(graph) : []), [graph]);

  useEffect(() => {
    if (dates.length > 0) {
      navigate("/fp/" + dates[dates.length - 1], { replace: true });
    }
  }, [dates, navigate]);

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)" }}>
        {error}
      </div>
    );
  }

  if (loading || dates.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "var(--mono)", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  return null;
}

function AppShell() {
  const { date, personId } = useParams<{ date: string; personId?: string }>();
  const navigate = useNavigate();
  const { graph, loading, error } = useGraph();

  const dates = useMemo(() => (graph ? getChangeDates(graph) : []), [graph]);

  const resolvedDate = date ?? (dates.length ? dates[dates.length - 1] : null);

  const snapshot = useMemo(
    () => (graph && resolvedDate ? getSnapshot(graph, resolvedDate) : null),
    [graph, resolvedDate]
  );

  const getNoteFor = useMemo(
    () => (graph && dates.length
      ? (d: string) => describeEvent(graph, d, dates)
      : () => ({ title: "", note: "" })),
    [graph, dates]
  );

  const handleSelectDate = (d: string) => {
    navigate("/fp/" + d);
  };

  const handleSelectPerson = (id: string) => {
    navigate("/fp/" + resolvedDate + "/person/" + id);
  };

  const handleClosePerson = () => {
    navigate("/fp/" + resolvedDate);
  };

  const handleSwitchPerson = (id: string) => {
    navigate("/fp/" + resolvedDate + "/person/" + id);
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
        onSelect={handleSelectPerson}
      />

      {personId && (
        <Detail
          personId={personId}
          graph={graph}
          snapshot={snapshot}
          onClose={handleClosePerson}
          onSwitch={handleSwitchPerson}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectToLatest />} />
      <Route path="/fp/:date" element={<AppShell />} />
      <Route path="/fp/:date/person/:personId" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
