import { useMemo, useState } from "react";
import type { Graph, Person } from "../graph/types";
import {
  collectLeaders,
  computeAngles,
  computeThicknessTiers,
  type LeaderEntry,
  type CirclePoint,
  type ThicknessTier,
} from "../utils/circleLayout";

interface RelationshipVisualizerProps {
  graph: Graph;
  onSelect: (personId: string) => void;
}

const VB = 1000;
const CENTER = VB / 2;
const RING_RADIUS = 440;
const PORTRAIT_W = 26;
const PORTRAIT_H = 34;
const HIGHLIGHT_COLOR = "#4397F8";

const TIER_WIDTHS: Record<ThicknessTier, number> = {
  1: 2.4,
  2: 1.8,
  3: 1.3,
  4: 0.9,
  5: 0.45,
};

function initialsOf(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
}

function resolvePhoto(photo: string | null | undefined): string | null {
  if (!photo) return null;
  return photo.startsWith("/")
    ? import.meta.env.BASE_URL + photo.slice(1)
    : photo;
}

interface NodeProps {
  leader: LeaderEntry;
  person: Person;
  point: CirclePoint;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

function VizNode({ leader, person, point, hovered, onHover, onSelect }: NodeProps) {
  const photoSrc = resolvePhoto(person.photo);
  const initials = initialsOf(person.display_name);
  const officeUpper = leader.highestOffice.toUpperCase();

  return (
    <g
      className={"viz-node" + (hovered ? " viz-node--hovered" : "")}
      transform={`translate(${point.x} ${point.y})`}
      onMouseEnter={() => onHover(leader.personId)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(leader.personId)}
    >
      <rect
        className="viz-hit"
        x={-PORTRAIT_W / 2 - 1}
        y={-PORTRAIT_H / 2 - 1}
        width={PORTRAIT_W + 2}
        height={PORTRAIT_H + 2}
        rx={2}
      />
      <g className="viz-node-inner">
        {photoSrc ? (
          <>
            <rect
              className="viz-portrait-frame"
              x={-PORTRAIT_W / 2}
              y={-PORTRAIT_H / 2}
              width={PORTRAIT_W}
              height={PORTRAIT_H}
              rx={1.5}
            />
            <image
              href={photoSrc}
              x={-PORTRAIT_W / 2}
              y={-PORTRAIT_H / 2}
              width={PORTRAIT_W}
              height={PORTRAIT_H}
              preserveAspectRatio="xMidYMin slice"
              clipPath="url(#viz-portrait-clip)"
            />
          </>
        ) : (
          <>
            <rect
              className="viz-portrait-initial-bg"
              x={-PORTRAIT_W / 2}
              y={-PORTRAIT_H / 2}
              width={PORTRAIT_W}
              height={PORTRAIT_H}
              rx={1.5}
            />
            <text
              className="viz-portrait-initial-text"
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
            >
              {initials}
            </text>
          </>
        )}

        <g className="viz-label" transform={`translate(0 ${PORTRAIT_H / 2 + 3})`}>
          <rect
            className="viz-label-bg"
            x={-32}
            y={0}
            width={64}
            height={11}
            rx={1.2}
          />
          <text
            className="viz-label-name"
            x={0}
            y={4.5}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {person.display_name}
          </text>
          <text
            className="viz-label-office"
            x={0}
            y={8.7}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {officeUpper}
          </text>
        </g>
      </g>
    </g>
  );
}

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

  // Base path layer is memoized once; hover does NOT re-render it.
  const basePaths = useMemo(() => {
    return edges.map((e) => {
      const pa = points.get(e.a);
      const pb = points.get(e.b);
      if (!pa || !pb) return null;
      return (
        <path
          key={e.key}
          d={`M ${pa.x} ${pa.y} Q ${CENTER} ${CENTER} ${pb.x} ${pb.y}`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={TIER_WIDTHS[e.tier]}
          strokeLinecap="round"
          opacity={0.18}
        />
      );
    });
  }, [edges, points]);

  // Only the hover-layer (~ up to ~100 paths) re-renders on hover.
  const hoverPaths = useMemo(() => {
    if (!hoveredId) return null;
    const matches: Edge[] = [];
    for (const e of edges) {
      if (e.a === hoveredId || e.b === hoveredId) matches.push(e);
    }
    return matches.map((e) => {
      const pa = points.get(e.a);
      const pb = points.get(e.b);
      if (!pa || !pb) return null;
      return (
        <path
          key={e.key}
          d={`M ${pa.x} ${pa.y} Q ${CENTER} ${CENTER} ${pb.x} ${pb.y}`}
          fill="none"
          stroke={HIGHLIGHT_COLOR}
          strokeWidth={TIER_WIDTHS[e.tier] + 0.6}
          strokeLinecap="round"
          opacity={1}
          filter="url(#viz-glow)"
        />
      );
    });
  }, [edges, points, hoveredId]);

  // SVG paint order is document order. Move the hovered node to the end so it renders on top.
  const orderedLeaders = useMemo(() => {
    if (!hoveredId) return leaders;
    const idx = leaders.findIndex((l) => l.personId === hoveredId);
    if (idx < 0) return leaders;
    const copy = leaders.slice();
    const [removed] = copy.splice(idx, 1);
    copy.push(removed);
    return copy;
  }, [leaders, hoveredId]);

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
            <clipPath id="viz-portrait-clip">
              <rect
                x={-PORTRAIT_W / 2}
                y={-PORTRAIT_H / 2}
                width={PORTRAIT_W}
                height={PORTRAIT_H}
                rx={1.5}
              />
            </clipPath>
            <filter id="viz-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g className="viz-lines viz-lines--base">{basePaths}</g>
          <g className="viz-lines viz-lines--hover">{hoverPaths}</g>

          <g className="viz-portraits">
            {orderedLeaders.map((leader) => {
              const p = points.get(leader.personId);
              if (!p) return null;
              const person = graph.people.get(leader.personId);
              if (!person) return null;
              return (
                <VizNode
                  key={leader.personId}
                  leader={leader}
                  person={person}
                  point={p}
                  hovered={hoveredId === leader.personId}
                  onHover={setHoveredId}
                  onSelect={onSelect}
                />
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
