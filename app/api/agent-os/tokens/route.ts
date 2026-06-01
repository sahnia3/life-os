import { NextRequest, NextResponse } from "next/server";
import { rollupTokens } from "@/lib/agent-os/db";
import { getWatcher } from "@/lib/agent-os/watcher";
import { projectNameForCwd } from "@/lib/agent-os/sessions";
import type { TokenRollup } from "@/lib/agent-os/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseWindow(s: string | null): number {
  if (!s) return 5 * 60 * 60 * 1000;
  const m = /^(\d+)(s|m|h|d)$/.exec(s);
  if (!m) return 5 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const u = m[2];
  const mul = u === "s" ? 1000 : u === "m" ? 60_000 : u === "h" ? 3_600_000 : 86_400_000;
  return n * mul;
}

export async function GET(req: NextRequest) {
  // Ensure watcher initialized so historical backfill is available
  getWatcher();

  const windowMs = parseWindow(req.nextUrl.searchParams.get("window"));
  const rollup = rollupTokens(windowMs);

  const totals = {
    input: rollup.totals.input || 0,
    output: rollup.totals.output || 0,
    cacheRead: rollup.totals.cache_read || 0,
    cacheCreate: rollup.totals.cache_create || 0,
    effectiveTotal:
      (rollup.totals.input || 0) +
      (rollup.totals.output || 0) +
      (rollup.totals.cache_create || 0),
  };

  const bySession: TokenRollup["bySession"] = {};
  for (const r of rollup.bySession) {
    bySession[r.session_id] = {
      input: r.input,
      output: r.output,
      cacheRead: r.cache_read,
      cacheCreate: r.cache_create,
      projectName: r.cwd ? projectNameForCwd(r.cwd) : "(unknown)",
      cwd: r.cwd ?? "",
    };
  }

  const response: TokenRollup = {
    windowMs,
    windowStartedAt: rollup.totals.windowStart,
    totals,
    bySession,
    buckets: rollup.buckets,
    warning:
      "Local estimate. Anthropic's exact 5-hour rate-limit window is not exposed to consumers.",
  };

  return NextResponse.json(response);
}
