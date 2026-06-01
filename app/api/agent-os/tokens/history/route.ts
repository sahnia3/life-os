import { NextRequest, NextResponse } from "next/server";
import { getDb, getHistoricalDailyTotals } from "@/lib/agent-os/db";
import { getWatcher } from "@/lib/agent-os/watcher";
import { projectNameForCwd } from "@/lib/agent-os/sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Trigger watcher so backfill is current
  getWatcher();

  const days = Math.max(
    1,
    Math.min(60, parseInt(req.nextUrl.searchParams.get("days") ?? "7", 10))
  );

  const rows = getHistoricalDailyTotals(days);

  // Build a wide table: { day, project_A_total, project_B_total, ... }
  const projectsByDay = new Map<string, Map<string, number>>();
  const allProjects = new Set<string>();
  for (const r of rows) {
    const project = r.cwd ? projectNameForCwd(r.cwd) : "(unknown)";
    allProjects.add(project);
    if (!projectsByDay.has(r.day)) projectsByDay.set(r.day, new Map());
    projectsByDay
      .get(r.day)!
      .set(project, (projectsByDay.get(r.day)!.get(project) ?? 0) + r.effective_total);
  }

  const series = Array.from(projectsByDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, totals]) => {
      const point: Record<string, number | string> = { day };
      let dayTotal = 0;
      for (const p of allProjects) {
        const v = totals.get(p) ?? 0;
        point[p] = v;
        dayTotal += v;
      }
      point.__total = dayTotal;
      return point;
    });

  // p95 of recent daily totals to inform burndown cap estimate
  const allTotals = series.map((s) => s.__total as number).sort((a, b) => a - b);
  const p95Idx = Math.floor(allTotals.length * 0.95);
  const p95Daily = allTotals[p95Idx] ?? 0;

  // Compute 7-day window totals from raw events for additional context
  const db = getDb();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const grand = db
    .prepare(
      `SELECT
        COALESCE(SUM(input), 0) AS input,
        COALESCE(SUM(output), 0) AS output,
        COALESCE(SUM(cache_create), 0) AS cache_create,
        COALESCE(SUM(cache_read), 0) AS cache_read,
        COUNT(*) AS events
       FROM token_events WHERE ts >= ?`
    )
    .get(since) as {
    input: number;
    output: number;
    cache_create: number;
    cache_read: number;
    events: number;
  };

  return NextResponse.json({
    days,
    projects: Array.from(allProjects),
    series,
    p95Daily,
    grand,
  });
}
