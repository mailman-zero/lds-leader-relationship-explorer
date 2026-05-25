import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Portrait } from "./Portrait";
import type { PhotoCredit } from "../graph/types.ts";

interface TooltipData {
  label: string;
  text: string;
}

interface CardProps {
  name?: string;
  photo?: PhotoCredit | null;
  role?: string;
  vacancy?: boolean;
  onClick?: () => void;
  tooltip?: TooltipData;
  className?: string;
}

type Placement = "right" | "left" | "above" | "below";

export function Card({ name, photo, role, vacancy, onClick, tooltip, className = "" }: CardProps) {
  const hostRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [placement, setPlacement] = useState<Placement>("right");
  const [coords, setCoords] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!visible || !hostRef.current || !tooltipRef.current) return;
    const hostRect = hostRef.current.getBoundingClientRect();
    const tw = tooltipRef.current.offsetWidth;
    const th = tooltipRef.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;
    const pad = 16;

    let next: Placement;
    if (vw - hostRect.right >= tw + pad) next = "right";
    else if (hostRect.left >= tw + pad) next = "left";
    else if (hostRect.top >= th + pad) next = "above";
    else next = "below";

    let left: number;
    let top: number;
    if (next === "right") {
      left = hostRect.right + gap;
      top = hostRect.top + hostRect.height / 2 - th / 2;
    } else if (next === "left") {
      left = hostRect.left - gap - tw;
      top = hostRect.top + hostRect.height / 2 - th / 2;
    } else if (next === "above") {
      left = hostRect.left + hostRect.width / 2 - tw / 2;
      top = hostRect.top - gap - th;
    } else {
      left = hostRect.left + hostRect.width / 2 - tw / 2;
      top = hostRect.bottom + gap;
    }

    left = Math.min(Math.max(left, 8), vw - tw - 8);
    top = Math.min(Math.max(top, 8), vh - th - 8);

    setPlacement(next);
    setCoords({ left, top });
  }, [visible, tooltip?.text]);

  if (vacancy) {
    return (
      <div className={`card vacancy ${className}`}>
        <Portrait vacancy />
        <div className="role">{role || "Seat"}</div>
        <div className="name">Awaiting call</div>
      </div>
    );
  }

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  const tooltipStyle: CSSProperties = {
    whiteSpace: "pre-line",
    left: `${coords.left}px`,
    top: `${coords.top}px`,
  };

  return (
    <>
      <button
        ref={hostRef}
        className={`card tooltip-host ${className}`}
        onClick={onClick}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        type="button"
      >
        <Portrait name={name} photo={photo} />
        {role && <div className="role">{role}</div>}
        <div className="name">{name}</div>
      </button>
      {tooltip && visible && createPortal(
        <div
          ref={tooltipRef}
          className={`tooltip tooltip-${placement}`}
          role="tooltip"
          style={tooltipStyle}
        >
          <span className="tt-label">{tooltip.label}</span>
          {tooltip.text}
        </div>,
        document.body,
      )}
    </>
  );
}
