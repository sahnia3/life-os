"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

export interface Funnel {
  tracked: number;
  scored: number;
  surfaced: number;
  applied: number;
  replied: number;
  interviewing: number;
  rejected: number;
  ghosted: number;
}

function useCountUp(value: number, ms = 500): number {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    function tick(t: number) {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(a + (b - a) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    }
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      from.current = value;
    };
  }, [value, ms]);
  return display;
}

const STAGES: { key: keyof Funnel; label: string; color: string; filter: string | null }[] = [
  { key: "tracked", label: "Tracked", color: "var(--ag-text)", filter: null },
  { key: "scored", label: "Scored", color: "var(--ag-text-mut)", filter: "scored" },
  { key: "surfaced", label: "Surfaced", color: "var(--ag-blue)", filter: "surfaced" },
  { key: "applied", label: "Applied", color: "var(--ag-violet)", filter: "applied" },
  { key: "interviewing", label: "Interviewing", color: "var(--ag-green)", filter: "interviewing" },
];

function Segment({
  label,
  value,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const n = useCountUp(value);
  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-md px-2 py-1 text-left transition-colors hover:bg-[var(--ag-overlay)]"
      style={active ? { background: "var(--ag-overlay)" } : undefined}
    >
      <span
        className="text-[9px] uppercase tracking-[0.1em]"
        style={{ color: "var(--ag-text-dim)" }}
      >
        {label}
      </span>
      <span
        className="ag-num ag-roll text-base font-semibold leading-none"
        style={{ color: active ? "var(--ag-text)" : color }}
      >
        {n}
      </span>
    </button>
  );
}

export function JobFunnel({
  funnel,
  avgFit,
  strongCount,
  activeFilter,
  onFilter,
}: {
  funnel: Funnel;
  avgFit: number | null;
  strongCount: number;
  activeFilter: string | null;
  onFilter: (state: string | null) => void;
}) {
  return (
    <div className="ag-surface flex flex-wrap items-center gap-x-1 gap-y-2 px-3 py-2.5">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <Segment
            label={s.label}
            value={funnel[s.key] ?? 0}
            color={s.color}
            active={activeFilter === s.filter}
            onClick={() => onFilter(s.filter)}
          />
          {i < STAGES.length - 1 && (
            <ChevronRight
              className="mx-0.5 h-3 w-3 flex-shrink-0"
              style={{ color: "var(--ag-text-dim)" }}
            />
          )}
        </div>
      ))}

      <div className="ml-auto flex items-center gap-4 pl-3">
        <div className="flex flex-col">
          <span
            className="text-[9px] uppercase tracking-[0.1em]"
            style={{ color: "var(--ag-text-dim)" }}
          >
            Avg fit
          </span>
          <span
            className="ag-num text-base font-semibold leading-none"
            style={{ color: "var(--ag-text-2)" }}
          >
            {avgFit != null ? avgFit.toFixed(1) : "—"}
          </span>
        </div>
        <div className="flex flex-col">
          <span
            className="text-[9px] uppercase tracking-[0.1em]"
            style={{ color: "var(--ag-text-dim)" }}
          >
            ≥ 9.0
          </span>
          <span
            className="ag-num text-base font-semibold leading-none"
            style={{ color: "var(--ag-green)" }}
          >
            {strongCount}
          </span>
        </div>
      </div>
    </div>
  );
}
