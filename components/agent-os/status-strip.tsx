"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionMeta, TokenRollup, AttentionItem } from "@/lib/agent-os/types";

interface RateSnap {
  fiveHour: { usedPercentage: number; resetsAt: number } | null;
  sevenDay: { usedPercentage: number } | null;
}

function useCountUp(value: number, ms = 400): number {
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

function Stat({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: number;
  color?: string;
  suffix?: string;
}) {
  const n = useCountUp(value);
  return (
    <div className="flex flex-col">
      <span
        className="text-[9px] uppercase tracking-[0.1em]"
        style={{ color: "var(--ag-text-dim)" }}
      >
        {label}
      </span>
      <span
        className="ag-num ag-roll text-base font-semibold leading-none"
        style={{ color: color ?? "var(--ag-text)" }}
      >
        {n}
        {suffix && (
          <span
            className="ml-0.5 text-[10px]"
            style={{ color: "var(--ag-text-dim)" }}
          >
            {suffix}
          </span>
        )}
      </span>
    </div>
  );
}

export function StatusStrip({
  sessions,
  rollup,
  attention,
  connected,
}: {
  sessions: SessionMeta[];
  rollup: TokenRollup | null;
  attention: AttentionItem[];
  connected: boolean;
}) {
  const [rate, setRate] = useState<RateSnap | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/ratelimit", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = (await r.json()) as { snapshot: RateSnap | null };
        if (mounted) setRate(j.snapshot);
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = setInterval(load, 5000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const live = sessions.filter((s) => s.status !== "stale");
  const working = live.filter(
    (s) => s.status === "active" || s.status === "running-tool"
  ).length;
  const idle = live.filter((s) => s.status === "idle").length;
  const waiting = attention.filter(
    (a) => a.reason === "idle_prompt" || a.reason === "permission_prompt"
  ).length;
  const errored = attention.filter((a) => a.reason === "error").length;

  const burn =
    rollup && rollup.windowStartedAt
      ? rollup.totals.effectiveTotal /
        Math.max(0.05, (now - rollup.windowStartedAt) / 3_600_000)
      : 0;
  const burnM = +(burn / 1_000_000).toFixed(1);

  const fivePct = rate?.fiveHour?.usedPercentage ?? null;
  const resetMs = rate?.fiveHour?.resetsAt ? rate.fiveHour.resetsAt - now : null;
  const resetTxt =
    resetMs && resetMs > 0
      ? `${Math.floor(resetMs / 3_600_000)}h ${Math.floor(
          (resetMs % 3_600_000) / 60_000
        )}m`
      : null;

  return (
    <div className="ag-surface flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className="ag-dot ag-dot--live"
          style={{
            background: connected ? "var(--ag-green)" : "var(--ag-red)",
          }}
        />
        <span className="ag-h text-sm">Agent&nbsp;OS</span>
      </div>
      <div className="h-7 w-px" style={{ background: "var(--ag-divider)" }} />
      <Stat label="Working" value={working} color="var(--ag-green)" />
      <Stat label="Waiting" value={waiting} color="var(--ag-yellow)" />
      <Stat label="Errored" value={errored} color="var(--ag-red)" />
      <Stat label="Idle" value={idle} color="var(--ag-text-mut)" />
      <Stat label="Sessions" value={live.length} />
      <div className="h-7 w-px" style={{ background: "var(--ag-divider)" }} />
      <div className="flex flex-col">
        <span
          className="text-[9px] uppercase tracking-[0.1em]"
          style={{ color: "var(--ag-text-dim)" }}
        >
          5h window
        </span>
        <span
          className="ag-num text-base font-semibold leading-none"
          style={{
            color:
              fivePct === null
                ? "var(--ag-text-dim)"
                : fivePct >= 80
                ? "var(--ag-red)"
                : fivePct >= 50
                ? "var(--ag-yellow)"
                : "var(--ag-green)",
          }}
        >
          {fivePct === null ? "—" : `${Math.round(fivePct)}%`}
          {resetTxt && (
            <span
              className="ml-1 text-[10px]"
              style={{ color: "var(--ag-text-dim)" }}
            >
              ·{resetTxt}
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-col">
        <span
          className="text-[9px] uppercase tracking-[0.1em]"
          style={{ color: "var(--ag-text-dim)" }}
        >
          Burn
        </span>
        <span
          className="ag-num text-base font-semibold leading-none"
          style={{ color: "var(--ag-text-2)" }}
        >
          {burnM}
          <span
            className="ml-0.5 text-[10px]"
            style={{ color: "var(--ag-text-dim)" }}
          >
            M/h
          </span>
        </span>
      </div>
      <kbd className="ml-auto hidden sm:inline-flex">⌘K</kbd>
    </div>
  );
}
