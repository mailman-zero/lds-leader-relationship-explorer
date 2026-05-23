import { useMemo, useState } from "react";
import type { Graph } from "../graph/types";
import { Portrait } from "./Portrait";
import {
  collectLeaders,
  computeAngles,
  computeThicknessTiers,
  type ThicknessTier,
} from "../utils/circleLayout";

interface RelationshipVisualizerProps {
  graph: Graph;
  onSelect: (personId: string) => void;
}

const VB = 1000;
const CENTER = VB / 2;
const RING_RADIUS = 390;
const PORTRAIT_W = 36;
const PORTRAIT_H = 48;

const TIER_WIDTHS: Record<ThicknessTier, number> = {
  1: 2.4,
  2: 1.8,
  3: 1.3,
  4: 0.9,
  5: 0.45,
};

export function RelationshipVisualizer({ graph, onSelect }: RelationshipVisualizerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const leaders = useMemo(() => collectLeaders(graph), [graph]);
  const leaderIds = useMemo(() => leaders.map((l) => l.personId), [leaders]);

  const points = useMemo(
    () => computeAngles(leaderIds, CENTER, CENTER, RING_RADIUS),
    [leaderIds]
  );

  const tiers = useMemo(
    () => computeThicknessTiers(graph, leaderIds),
    [graph, leaderIds]
  );

  type Edge = { a: string; b: string; tier: ThicknessTier; key: string };
  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const [key, tier] of tiers) {
      const [a, b] = key.split("|");
      out.push({ a, b, tier, key });
    }
    out.sort((x, y) => y.tier - x.tier);
    return out;
  }, [tiers]);

  const baseEdges: Edge[] = [];
  const hoverEdges: Edge[] = [];
  if (hoveredId) {
    for (const e of edges) {
      if (e.a === hoveredId || e.b === hoveredId) hoverEdges.push(e);
      else baseEdges.push(e);
    }
  }

  function renderPath(edge: Edge, highlighted: boolean) {
    const pa = points.get(edge.a);
    const pb = points.get(edge.b);
    if (!pa || !pb) return null;
    const d = `M ${pa.x},${pa.y} Q ${CENTER},${CENTER} ${pb.x},${pb.y}`;
    return (
      <path
        key={edge.key}
        d={d}
        fill="none"
        stroke={highlighted ? "var(--accent-deep)" : "var(--accent)"}
        strokeWidth={TIER_WIDTHS[edge.tier]}
        strokeLinecap="round"
        opacity={highlighted ? 1 : 0.18}
        filter={highlighted ? "url(#viz-glow)" : undefined}
      />
    );
  }

  return (
    <div className="visualizer-page">
      <div className="visualizer-frame">
        <svg
          className="visualizer-svg"
          viewBox={`0 0 ${VB} ${VB}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Relationship visualizer"
        >
          <defs>
            <filter id="viz-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g className="viz-lines viz-lines--base">
            {(hoveredId ? baseEdges : edges).map((e) => renderPath(e, false))}
          </g>
          <g className="viz-lines viz-lines--hover">
            {hoverEdges.map((e) => renderPath(e, true))}
          </g>

          <g className="viz-portraits">
            {leaders.map((leader) => {
              const p = points.get(leader.personId);
              if (!p) return null;
              const person = graph.people.get(leader.personId);
              if (!person) return null;
              const isHovered = hoveredId === leader.personId;
              return (
                <foreignObject
                  key={leader.personId}
                  x={p.x - PORTRAIT_W / 2}
                  y={p.y - PORTRAIT_H / 2}
                  width={PORTRAIT_W}
                  height={PORTRAIT_H + 80}
                  className={
                    "viz-node" + (isHovered ? " viz-node--hovered" : "")
                  }
                  style={{ overflow: "visible" }}
                >
                  <div
                    className="circle-portrait-wrap"
                    onMouseEnter={() => setHoveredId(leader.personId)}
                    onMouseLeave={() =>
                      setHoveredId((cur) =>
                        cur === leader.personId ? null : cur
                      )
                    }
                    onClick={() => onSelect(leader.personId)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="circle-portrait">
                      <Portrait
                        name={person.display_name}
                        photo={person.photo}
                      />
                    </div>
                    <div className="circle-label">
                      <div className="circle-label__name">
                        {person.display_name}
                      </div>
                      <div className="circle-label__office">
                        {leader.highestOffice}
                      </div>
                    </div>
                  </div>
                </foreignObject>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
