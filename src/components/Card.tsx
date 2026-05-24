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

export function Card({ name, photo, role, vacancy, onClick, tooltip, className = "" }: CardProps) {
  if (vacancy) {
    return (
      <div className={`card vacancy ${className}`}>
        <Portrait vacancy />
        <div className="role">{role || "Seat"}</div>
        <div className="name">Awaiting call</div>
      </div>
    );
  }

  return (
    <button
      className={`card tooltip-host ${className}`}
      onClick={onClick}
      type="button"
    >
      <Portrait name={name} photo={photo} />
      {role && <div className="role">{role}</div>}
      <div className="name">{name}</div>
      {tooltip && (
        <div className="tooltip" role="tooltip" style={{ whiteSpace: "pre-line" }}>
          <span className="tt-label">{tooltip.label}</span>
          {tooltip.text}
        </div>
      )}
    </button>
  );
}
