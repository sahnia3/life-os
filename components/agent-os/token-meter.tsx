"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Info, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TokenRollup } from "@/lib/agent-os/types";

const WINDOW_MS = 5 * 60 * 60 * 1000;

interface RateLimitWindow {
  usedPercentage: number;
  resetsAt: number;
}
interface RateLimitSnapshot {
  fiveHour: RateLimitWindow | null;
  sevenDay: RateLimitWindow | null;
  capturedAt: number;
  sourceSessionId: string;
  model: string | null;
  cwd: string | null;
  stale: boolean;
  ageMs: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function fmtAgo(ts: number, now: number): string {
  const diff = now - ts;
  if (diff < 60_000) return Math.floor(diff / 1000) + "s ago";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  return Math.floor(diff / 3_600_000) + "h ago";
}

function computeBurnRate(
  rollup: TokenRollup | null,
  windowElapsedMs: number
): { perHour: number } {
  if (!rollup) return { perHour: 0 };
  const total = rollup.totals.effectiveTotal;
  const hours = Math.max(0.01, windowElapsedMs / 3_600_000);
  return { perHour: total / hours };
}

function useRateLimit(): RateLimitSnapshot | null {
  const [snap, setSnap] = useState<RateLimitSnapshot | null>(null);
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/ratelimit", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { snapshot: RateLimitSnapshot | null };
        if (mounted) setSnap(j.snapshot);
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = setInterval(load, 5_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);
  return snap;
}

function barColorFor(pct: number): string {
  return pct >= 80
    ? "bg-rose-500"
    : pct >= 50
    ? "bg-amber-500"
    : "bg-emerald-500";
}

export function TokenMeter({ rollup }: { rollup: TokenRollup | null }) {
  const [now, setNow] = useState<number>(() => Date.now());
  const snap = useRateLimit();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const total = rollup?.totals.effectiveTotal ?? 0;

  // Window timing — use Claude's authoritative resets_at when we have it
  const fiveHourResetMs = snap?.fiveHour?.resetsAt ?? null;
  const sevenDayResetMs = snap?.sevenDay?.resetsAt ?? null;
  const timeLeftFiveMs = fiveHourResetMs ? fiveHourResetMs - now : null;
  const timeLeftSevenMs = sevenDayResetMs ? sevenDayResetMs - now : null;
  // Fallback: derive window-start from rollup
  const fallbackWindowStart = rollup?.windowStartedAt ?? now - WINDOW_MS;
  const fallbackTimeLeft = fallbackWindowStart + WINDOW_MS - now;

  const burn = computeBurnRate(
    rollup,
    fiveHourResetMs
      ? WINDOW_MS - (timeLeftFiveMs ?? 0)
      : now - fallbackWindowStart
  );

  const fiveHourPct = snap?.fiveHour?.usedPercentage ?? null;
  const sevenDayPct = snap?.sevenDay?.usedPercentage ?? null;

  const fivePctNum = fiveHourPct ?? 0;
  const barWidth = fiveHourPct ?? 0;

  const bySession = rollup
    ? Object.entries(rollup.bySession).sort(
        (a, b) =>
          b[1].input +
          b[1].output +
          b[1].cacheCreate -
          (a[1].input + a[1].output + a[1].cacheCreate)
      )
    : [];

  const hasRealData = snap !== null && snap.fiveHour !== null;

  return (
    <Card>
      <CardContent className="space-y-3 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="font-heading text-sm font-medium">5-hour window</h2>
            {timeLeftFiveMs !== null && timeLeftFiveMs > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                resets in {formatDuration(timeLeftFiveMs)}
              </span>
            ) : timeLeftFiveMs !== null && timeLeftFiveMs <= 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-500">
                window reset
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {formatDuration(fallbackTimeLeft)} (est.)
              </span>
            )}
            {hasRealData && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500">
                <CheckCircle2 className="h-2.5 w-2.5" />
                live from Claude
              </span>
            )}
            {snap?.stale && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-500">
                <AlertTriangle className="h-2.5 w-2.5" />
                stale — {fmtAgo(snap.capturedAt, now)}
              </span>
            )}
          </div>
          <div className="text-right">
            {fiveHourPct !== null ? (
              <>
                <p className="font-mono text-2xl font-semibold leading-none">
                  {fiveHourPct.toFixed(0)}
                  <span className="text-sm text-muted-foreground">%</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatTokens(total)} sent locally
                </p>
              </>
            ) : (
              <>
                <p className="font-mono text-lg font-semibold leading-none">
                  {formatTokens(total)}
                  <span className="text-xs text-muted-foreground"> sent</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  waiting for first statusline refresh…
                </p>
              </>
            )}
          </div>
        </div>

        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full transition-[width]",
              fiveHourPct !== null ? barColorFor(fivePctNum) : "bg-sky-500/50"
            )}
            style={{ width: `${barWidth}%` }}
          />
          {fiveHourPct === null && (
            <div className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-wider text-muted-foreground/80">
              awaiting statusline data
            </div>
          )}
        </div>

        {/* 7-day window — shows under 5h bar when present */}
        {sevenDayPct !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="uppercase tracking-wider text-muted-foreground">
                7-day window
              </span>
              <span className="font-mono">
                <span
                  className={cn(
                    "font-semibold",
                    sevenDayPct >= 80
                      ? "text-rose-500"
                      : sevenDayPct >= 50
                      ? "text-amber-500"
                      : "text-emerald-500"
                  )}
                >
                  {sevenDayPct.toFixed(0)}%
                </span>
                {timeLeftSevenMs !== null && timeLeftSevenMs > 0 && (
                  <span className="ml-1.5 text-muted-foreground">
                    · resets in {formatDuration(timeLeftSevenMs)}
                  </span>
                )}
              </span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full transition-[width]", barColorFor(sevenDayPct))}
                style={{ width: `${sevenDayPct}%` }}
              />
            </div>
          </div>
        )}

        {bySession.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {bySession.slice(0, 6).map(([sid, b]) => {
              const t = b.input + b.output + b.cacheCreate;
              return (
                <span key={sid} className="inline-flex items-center gap-1">
                  <span className="font-mono text-muted-foreground">
                    {b.projectName}
                  </span>
                  <span className="font-mono font-medium">{formatTokens(t)}</span>
                </span>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 border-t border-border/60 pt-2 text-[10px]">
          <div>
            <p className="uppercase tracking-wide text-muted-foreground">
              Local volume (sent)
            </p>
            <p className="font-mono text-xs font-semibold">
              {formatTokens(total)}
            </p>
            <p className="text-muted-foreground">
              + {formatTokens(rollup?.totals.cacheRead ?? 0)} cache hits
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-muted-foreground">
              Burn rate
            </p>
            <p className="font-mono text-xs font-semibold">
              {formatTokens(burn.perHour)}/hr
            </p>
            <p className="text-muted-foreground">
              {fiveHourPct !== null && burn.perHour > 0
                ? `≈ ${formatTokens(burn.perHour * 5)}/window`
                : "—"}
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-muted-foreground">
              Quota source
            </p>
            <p className="font-mono text-xs font-semibold">
              {hasRealData ? "Claude statusline" : "—"}
            </p>
            <p className="text-muted-foreground">
              {snap
                ? `${fmtAgo(snap.capturedAt, now)} via ${snap.sourceSessionId.slice(0, 8)}…`
                : "no data yet"}
            </p>
          </div>
        </div>

        {!hasRealData && (
          <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            Trigger any session&apos;s statusline refresh (type a character in
            Claude CLI) to populate real quota data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
