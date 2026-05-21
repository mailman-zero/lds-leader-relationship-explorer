import { useState } from "react";
import type { EventNote } from "../data/eventNotes";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[m - 1]} ${d}, ${y}`;
}

function shortDate(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[m - 1]} ${y}`;
}

interface TimelinePickerProps {
  dates: string[];
  currentDate: string;
  getNoteFor: (date: string) => EventNote;
  onSelect: (date: string) => void;
}

export function TimelinePicker({ dates, currentDate, getNoteFor, onSelect }: TimelinePickerProps) {
  const [open, setOpen] = useState(false);

  const index = dates.indexOf(currentDate);
  const note = getNoteFor(currentDate);
  const atStart = index === 0;
  const atEnd = index === dates.length - 1;

  const first = new Date(dates[0]).getTime();
  const last = new Date(dates[dates.length - 1]).getTime();
  const span = Math.max(1, last - first);

  return (
    <div>
      <div className="picker">
        <button
          className="nav"
          aria-label="Previous event"
          aria-hidden={atStart ? "true" : undefined}
          onClick={() => !atStart && onSelect(dates[index - 1])}
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          className={`date-button ${open ? "open" : ""}`}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          type="button"
        >
          <span>{formatDate(currentDate)}</span>
          {note.hypothetical && <span className="sub">scheduled</span>}
          <span className="caret">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>

        <button
          className="nav"
          aria-label="Next event"
          aria-hidden={atEnd ? "true" : undefined}
          onClick={() => !atEnd && onSelect(dates[index + 1])}
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="timeline" role="region" aria-label="Timeline of changes">
          <div className="tl-meta">
            <span className="lbl">Changes to the First Presidency &amp; Quorum of the Twelve</span>
            <span className="count">{dates.length} events · {dates[0].split("-")[0]}–{dates[dates.length-1].split("-")[0]}</span>
          </div>

          <div className="tl-rule">
            {dates.flatMap((date) => {
              const pct = ((new Date(date).getTime() - first) / span) * 100;
              const evNote = getNoteFor(date);
              return [
                <button
                  key={`dot-${date}`}
                  className={`tl-dot ${date === currentDate ? "current" : ""} ${evNote.hypothetical ? "hypothetical" : ""}`}
                  style={{ left: `${pct}%` }}
                  onClick={() => { onSelect(date); setOpen(false); }}
                  aria-label={`${formatDate(date)}: ${evNote.title}`}
                  type="button"
                />,
                <div
                  key={`tip-${date}`}
                  className="tl-tooltip"
                  style={{ left: `${pct}%` }}
                >
                  <span className="d">{formatDate(date)}</span>
                  {evNote.title}
                </div>,
              ];
            })}
          </div>

          <div className="tl-axis">
            <span>{shortDate(dates[0])}</span>
            <span>{shortDate(dates[dates.length - 1])}</span>
          </div>
        </div>
      )}

      <div className={`event-note ${note.hypothetical ? "hypothetical" : ""}`}>
        <span className="ev-title">{note.title}</span>
        {note.note}
      </div>
    </div>
  );
}
