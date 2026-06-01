"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BellRing,
  X,
  ArrowRight,
} from "lucide-react";
import type { AttentionItem } from "@/lib/agent-os/types";

const REASON_META: Record<
  AttentionItem["reason"],
  { label: string; color: string; Icon: typeof ShieldAlert }
> = {
  permission_prompt: {
    label: "Needs permission",
    color: "var(--ag-yellow)",
    Icon: ShieldAlert,
  },
  error: { label: "Errored", color: "var(--ag-red)", Icon: AlertTriangle },
  idle_prompt: { label: "Waiting on you", color: "var(--ag-blue)", Icon: Clock },
  finished: {
    label: "Finished",
    color: "var(--ag-green)",
    Icon: CheckCircle2,
  },
};

function ago(ts: number, now: number): string {
  const d = Math.max(0, now - ts);
  if (d < 60_000) return `${Math.floor(d / 1000)}s`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
  return `${Math.floor(d / 3_600_000)}h`;
}

export function AttentionQueue({
  items,
  onDismiss,
  onFocus,
  notifyGranted,
  onRequestNotify,
}: {
  items: AttentionItem[];
  onDismiss: (sessionId: string) => void;
  onFocus: (sessionId: string) => void;
  notifyGranted: boolean;
  onRequestNotify: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const urgent = items.filter(
    (i) => i.reason === "permission_prompt" || i.reason === "error"
  ).length;

  return (
    <div
      className={`ag-surface p-3 ${urgent > 0 ? "ag-attn" : ""}`}
      style={
        urgent > 0
          ? undefined
          : { boxShadow: "inset 0 0 0 1px var(--ag-border)" }
      }
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BellRing
            className="h-4 w-4"
            style={{ color: urgent > 0 ? "var(--ag-red)" : "var(--ag-text-mut)" }}
          />
          <h2 className="ag-h text-sm">Who needs me</h2>
          {items.length > 0 && (
            <span
              className="ag-num rounded-full px-1.5 py-0.5 text-[10px]"
              style={{
                background: urgent > 0 ? "rgba(243,139,168,0.14)" : "var(--ag-nested)",
                color: urgent > 0 ? "var(--ag-red)" : "var(--ag-text-mut)",
              }}
            >
              {items.length}
            </span>
          )}
        </div>
        {!notifyGranted && (
          <button
            onClick={onRequestNotify}
            className="ag-num rounded-md px-2 py-1 text-[10px] transition-colors"
            style={{
              background: "var(--ag-nested)",
              color: "var(--ag-text-mut)",
            }}
          >
            Enable desktop alerts
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div
          className="flex items-center gap-2 rounded-md px-3 py-4 text-xs"
          style={{ color: "var(--ag-text-dim)" }}
        >
          <CheckCircle2
            className="h-4 w-4"
            style={{ color: "var(--ag-green)" }}
          />
          All sessions are heads-down. Nothing is blocked on you.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => {
            const m = REASON_META[it.reason];
            return (
              <li
                key={`${it.sessionId}-${it.reason}`}
                className="ag-surface-2 ag-rowin group flex items-center gap-3 px-3 py-2"
              >
                <m.Icon
                  className="h-4 w-4 flex-none"
                  style={{ color: m.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="truncate text-[13px] font-medium"
                      style={{ color: "var(--ag-text)" }}
                    >
                      {it.projectName}
                    </span>
                    <span
                      className="ag-num text-[10px] uppercase tracking-wide"
                      style={{ color: m.color }}
                    >
                      {m.label}
                    </span>
                    <span
                      className="ag-num ml-auto text-[10px]"
                      style={{ color: "var(--ag-text-dim)" }}
                    >
                      {ago(it.since, now)} ago
                    </span>
                  </div>
                  <p
                    className="truncate text-[11px]"
                    style={{ color: "var(--ag-text-mut)" }}
                    title={it.message}
                  >
                    {it.message}
                  </p>
                </div>
                <button
                  onClick={() => onFocus(it.sessionId)}
                  className="flex-none rounded-md px-2 py-1 text-[10px] font-medium opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    background: "var(--ag-overlay)",
                    color: "var(--ag-text-2)",
                  }}
                  title="Jump to session"
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onDismiss(it.sessionId)}
                  className="flex-none rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: "var(--ag-text-dim)" }}
                  title="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
