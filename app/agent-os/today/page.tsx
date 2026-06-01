"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  CalendarDays,
  Sparkles,
  Folder,
  Wrench,
  FileText,
  Target,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProjectTodayRow {
  projectName: string;
  cwd: string | null;
  sessions: number;
  effective: number;
  cacheRead: number;
  events: number;
  firstActivityAt: number;
  lastActivityAt: number;
  topTools: Array<{ name: string; count: number }>;
  topFiles: Array<{ path: string; toolName: string; count: number }>;
  lastUserText: string | null;
  lastAssistantText: string | null;
  anchors: string[];
  digests: string[];
  narrative: string;
}

interface TodayResponse {
  date: string;
  totals: {
    sessions: number;
    effective: number;
    cacheRead: number;
    events: number;
    projects: number;
  };
  projects: ProjectTodayRow[];
  heatmap: Array<{ day: string; effective: number; events: number }>;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}
function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function shortPath(p: string): string {
  return p.split("/").slice(-2).join("/");
}

function Heatmap({
  cells,
}: {
  cells: Array<{ day: string; effective: number; events: number }>;
}) {
  const max = Math.max(1, ...cells.map((c) => c.effective));
  return (
    <div className="flex items-end gap-0.5">
      {cells.map((c, i) => {
        const pct = c.effective / max;
        const cls =
          c.effective === 0
            ? "bg-muted"
            : pct < 0.25
            ? "bg-emerald-500/30"
            : pct < 0.5
            ? "bg-emerald-500/55"
            : pct < 0.75
            ? "bg-emerald-500/75"
            : "bg-emerald-500";
        const isToday = i === cells.length - 1;
        return (
          <div
            key={c.day}
            className={cn(
              "h-6 w-4 rounded-sm",
              cls,
              isToday && "ring-1 ring-foreground/40"
            )}
            title={`${c.day}: ${fmt(c.effective)} tokens · ${c.events} events`}
          />
        );
      })}
    </div>
  );
}

export default function TodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/today", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as TodayResponse;
        if (mounted) setData(j);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/agent-os"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Agent OS
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <CalendarDays className="h-4 w-4 text-emerald-500" />
          <h1 className="font-heading text-lg font-semibold tracking-tight">
            Today
          </h1>
          {data && (
            <span className="text-[11px] text-muted-foreground">
              {data.date}
            </span>
          )}
        </div>
      </header>

      {loading && !data ? (
        <Card>
          <CardContent className="py-10 text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="h-3 w-3 animate-spin" /> Aggregating today&apos;s
            sessions…
          </CardContent>
        </Card>
      ) : !data ? null : (
        <>
          <Card>
            <CardContent className="py-3">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Sessions
                  </p>
                  <p className="font-mono text-2xl font-semibold">
                    {data.totals.sessions}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Projects
                  </p>
                  <p className="font-mono text-2xl font-semibold">
                    {data.totals.projects}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Events
                  </p>
                  <p className="font-mono text-2xl font-semibold">
                    {data.totals.events.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Effective tokens
                  </p>
                  <p className="font-mono text-2xl font-semibold">
                    {fmt(data.totals.effective)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Cache reads
                  </p>
                  <p className="font-mono text-2xl font-semibold">
                    {fmt(data.totals.cacheRead)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Last 14 days
                </p>
                <Heatmap cells={data.heatmap} />
              </div>
            </CardContent>
          </Card>

          {data.projects.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-xs text-muted-foreground">
                No sessions ran today yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.projects.map((p) => (
                <Card key={p.projectName}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono">{p.projectName}</span>
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {p.sessions} session{p.sessions === 1 ? "" : "s"} ·{" "}
                          {fmt(p.effective)} tokens · {p.events} events
                        </span>
                      </span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {fmtTime(p.firstActivityAt)} → {fmtTime(p.lastActivityAt)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0 text-violet-500" />
                      <p className="leading-snug">{p.narrative}</p>
                    </div>
                    {p.anchors.length > 0 && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1">
                        <Target className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" />
                        <div className="flex-1 space-y-0.5">
                          {p.anchors.slice(0, 3).map((a, i) => (
                            <p
                              key={i}
                              className="text-[11px] text-amber-700 dark:text-amber-300"
                            >
                              {a}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          <Wrench className="inline h-3 w-3" /> Top tools
                        </p>
                        <ul className="mt-0.5 space-y-0 font-mono text-[11px]">
                          {p.topTools.length === 0 ? (
                            <li className="text-muted-foreground">
                              No tool calls
                            </li>
                          ) : (
                            p.topTools.map((t) => (
                              <li
                                key={t.name}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="truncate">{t.name}</span>
                                <span className="text-muted-foreground">
                                  ×{t.count}
                                </span>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          <FileText className="inline h-3 w-3" /> Files touched
                        </p>
                        <ul className="mt-0.5 space-y-0 font-mono text-[11px] max-h-[120px] overflow-y-auto">
                          {p.topFiles.length === 0 ? (
                            <li className="text-muted-foreground">
                              No file edits
                            </li>
                          ) : (
                            p.topFiles.map((f, i) => (
                              <li
                                key={i}
                                className="flex items-center justify-between gap-2"
                                title={f.path}
                              >
                                <span className="truncate">
                                  {shortPath(f.path)}
                                </span>
                                <span className="text-muted-foreground text-[10px]">
                                  {f.toolName}
                                </span>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
