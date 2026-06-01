"use client";

import type { SessionMeta } from "@/lib/agent-os/types";
import { SessionCard } from "./session-card";
import { cn } from "@/lib/utils";

const COLUMNS: Array<{
  key: "awaiting" | "running-tool" | "active" | "idle" | "stale";
  label: string;
  match: (s: SessionMeta) => boolean;
  tint: string;
}> = [
  {
    key: "awaiting",
    label: "Awaiting input",
    match: (s) => s.awaitingInput,
    tint: "border-amber-500/40 bg-amber-500/5",
  },
  {
    key: "running-tool",
    label: "Running tool",
    match: (s) => !s.awaitingInput && s.status === "running-tool",
    tint: "border-orange-500/40 bg-orange-500/5",
  },
  {
    key: "active",
    label: "Active",
    match: (s) => !s.awaitingInput && s.status === "active",
    tint: "border-emerald-500/40 bg-emerald-500/5",
  },
  {
    key: "idle",
    label: "Idle",
    match: (s) => !s.awaitingInput && s.status === "idle",
    tint: "border-slate-500/40 bg-slate-500/5",
  },
  {
    key: "stale",
    label: "Stale",
    match: (s) => s.status === "stale",
    tint: "border-rose-500/30 bg-rose-500/5 opacity-70",
  },
];

export function BoardView({ sessions }: { sessions: SessionMeta[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
      {COLUMNS.map((col) => {
        const items = sessions.filter(col.match);
        return (
          <div
            key={col.key}
            className={cn(
              "rounded-lg border bg-card/30 p-2 min-h-[200px]",
              col.tint
            )}
          >
            <div className="flex items-center justify-between gap-1 px-1 pb-2 text-[10px] uppercase tracking-wider">
              <span className="font-medium text-muted-foreground">
                {col.label}
              </span>
              <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 font-mono">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="px-2 py-4 text-center text-[10px] text-muted-foreground/60">
                  —
                </p>
              ) : (
                items.map((s) => (
                  <SessionCard key={s.sessionId} session={s} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
