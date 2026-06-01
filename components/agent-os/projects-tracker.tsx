"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Rocket, Calendar, AlertTriangle, Plus, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProjectStats {
  id: string;
  name: string;
  cwd: string;
  targetDate: string | null;
  statusNote: string;
  progressPct: number;
  source: "manual" | "milestones" | "sessions" | "none";
  daysUntilTarget: number | null;
  overdue: boolean;
  sessionsLast7d: number;
  commitsLast7d: number;
  effectiveTokensLast7d: number;
}

function barColor(pct: number, overdue: boolean): string {
  if (overdue && pct < 100) return "bg-rose-500";
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-sky-500";
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function ProjectsTracker({ compact = false }: { compact?: boolean }) {
  const [projects, setProjects] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/projects", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { projects: ProjectStats[] };
        if (mounted) setProjects(j.projects);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  if (loading && projects.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Rocket className="h-3.5 w-3.5 text-orange-500" />
          Projects
          <span className="ml-auto inline-flex items-center gap-1">
            <Link
              href="/agent-os/projects"
              className="rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-medium hover:bg-muted"
            >
              {projects.length === 0 ? (
                <>
                  <Plus className="inline h-2.5 w-2.5" /> Add a project
                </>
              ) : (
                <>
                  Manage <ChevronRight className="inline h-2.5 w-2.5" />
                </>
              )}
            </Link>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add a project to track progress toward a target date. Progress comes
            from a manual %, a PLAN.md checklist (— [x]), or recent session
            velocity.
          </p>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono font-medium truncate">{p.name}</span>
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    {p.source === "manual"
                      ? "manual"
                      : p.source === "milestones"
                      ? "PLAN.md"
                      : p.source === "sessions"
                      ? "velocity"
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-shrink-0">
                  {p.targetDate && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5",
                        p.overdue && "text-rose-500",
                        !p.overdue &&
                          p.daysUntilTarget !== null &&
                          p.daysUntilTarget <= 3 &&
                          "text-amber-500"
                      )}
                    >
                      {p.overdue ? (
                        <AlertTriangle className="h-2.5 w-2.5" />
                      ) : (
                        <Calendar className="h-2.5 w-2.5" />
                      )}
                      {p.overdue
                        ? `overdue ${-p.daysUntilTarget!}d`
                        : p.daysUntilTarget !== null && p.daysUntilTarget >= 0
                        ? `${p.daysUntilTarget}d to ${p.targetDate}`
                        : p.targetDate}
                    </span>
                  )}
                  <span className="font-mono font-semibold">
                    {Math.round(p.progressPct)}%
                  </span>
                </div>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full transition-[width]",
                    barColor(p.progressPct, p.overdue)
                  )}
                  style={{ width: `${Math.min(100, p.progressPct)}%` }}
                />
              </div>
              {!compact && (p.statusNote || p.sessionsLast7d > 0) && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {p.statusNote && <span>{p.statusNote} · </span>}
                  {p.sessionsLast7d > 0 && (
                    <>
                      {p.sessionsLast7d} session
                      {p.sessionsLast7d === 1 ? "" : "s"} · {p.commitsLast7d}{" "}
                      commit{p.commitsLast7d === 1 ? "" : "s"} ·{" "}
                      {fmt(p.effectiveTokensLast7d)} tokens (7d)
                    </>
                  )}
                </p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
