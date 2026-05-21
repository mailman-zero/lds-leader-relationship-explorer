import type { Graph, Snapshot } from "../graph/types";
import { Card } from "./Card";

function roleLabel(code: string): string {
  if (code === "church-president") return "President";
  if (code === "fp-first-counselor") return "First Counselor";
  if (code === "fp-second-counselor") return "Second Counselor";
  if (code === "fp-counselor") return "Counselor";
  if (code === "q12-president") return "President";
  return "";
}

interface MainViewProps {
  snapshot: Snapshot;
  graph: Graph;
  onSelect: (personId: string) => void;
}

export function MainView({ snapshot, graph, onSelect }: MainViewProps) {
  const { first_presidency: fp, quorum_of_twelve: q12 } = snapshot;
  const fpSlots = [
    { key: "first", pos: fp.first_counselor, fallbackRole: "First Counselor" },
    { key: "president", pos: fp.president, fallbackRole: "President" },
    { key: "second", pos: fp.second_counselor, fallbackRole: "Second Counselor" },
    ...fp.additional_counselors.map((pos, idx) => ({
      key: `additional-${idx}`,
      pos,
      fallbackRole: "Counselor",
    })),
  ];

  return (
    <div className="page snapshot" key={snapshot.date}>
      <section className="section">
        <header className="section-head">
          <h2>First Presidency</h2>
          <div className="sub">The presiding council of the Church</div>
        </header>

        <div className="fp-trio">
          {fpSlots.map(({ key, pos, fallbackRole }) => {
            const isCenter = key === "president";
            if (!pos) {
              return <Card key={`fp-${key}`} vacancy className={isCenter ? "center" : ""} role={fallbackRole} />;
            }
            const person = graph.people.get(pos.person_id);
            return (
              <Card
                key={`${pos.person_id}-${pos.position_code}`}
                name={person?.display_name}
                photo={person?.photo}
                role={roleLabel(pos.position_code)}
                className={isCenter ? "center" : ""}
                onClick={() => onSelect(pos.person_id)}
              />
            );
          })}
        </div>
      </section>

      <section className="section">
        <header className="section-head">
          <h2>Quorum of the Twelve Apostles</h2>
          <div className="sub">In order of seniority · {q12.length} of 12 seated</div>
        </header>

        <div className="q12-grid">
          {Array.from({ length: 12 }).map((_, i) => {
            const pos = q12[i];
            if (!pos) return <Card key={`q12-${i}`} vacancy role="Apostle" />;
            const person = graph.people.get(pos.person_id);
            return (
              <Card
                key={pos.person_id}
                name={person?.display_name}
                photo={person?.photo}
                onClick={() => onSelect(pos.person_id)}
              />
            );
          })}
        </div>
      </section>

      <div className="foot">
        Tap a portrait to explore family relationships
        <span className="dot">·</span>
        Use the timeline above to step through history
      </div>
    </div>
  );
}
