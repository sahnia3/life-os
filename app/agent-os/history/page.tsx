"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Calendar,
  Folder,
  Filter,
  History,
  FileText,
  Wrench,
  Sparkles,
  Target,
  Loader2,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HistoryRow {
  sessionId: string;
  cwd: string | null;
  projectName: string;
  startedAt: number;
  lastEventAt: number;
  durationMs: number;
  eventCount: number;
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
  effectiveTotal: number;
  model: string | null;
  anchor: string | null;
  digest: string | null;
  role: string | null;
  roleFocus: string | null;
  jsonlPath: string | null;
}

interface HistoryDetail {
  meta: HistoryRow;
  files: Array<{ path: string; toolName: string; count: number }>;
  tools: Array<{ name: string; count: number }>;
  events: Array<{
    ts: number;
    kind: string;
    summary: string;
    toolName: string | null;
  }>;
  totalLinesScanned: number;
}

const ROLES = [
  "builder",
  "debugger",
  "researcher",
  "planner",
  "reviewer",
  "operator",
  "writer",
  "chatter",
];

const DATE_PRESETS: Array<{ label: string; days: number }> = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "All time", days: 0 },
];

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}
function fmtDateShort(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "yesterday";
  const diff = today.getTime() - ts;
  if (diff < 7 * 86400000)
    return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
function fmtDateFull(ts: number): string {
  return new Date(ts).toLocaleString();
}
function fmtDuration(ms: number): string {
  if (ms < 60_000) return Math.floor(ms / 1000) + "s";
  if (ms < 3_600_000) return Math.floor(ms / 60_000) + "m";
  if (ms < 86_400_000)
    return (
      Math.floor(ms / 3_600_000) +
      "h " +
      Math.floor((ms % 3_600_000) / 60_000) +
      "m"
    );
  return Math.floor(ms / 86_400_000) + "d";
}
function roleEmoji(role: string | null): string {
  switch (role) {
    case "builder":
      return "🔨";
    case "debugger":
      return "🐛";
    case "researcher":
      return "🔍";
    case "planner":
      return "📋";
    case "reviewer":
      return "🧪";
    case "operator":
      return "🚀";
    case "writer":
      return "✍️";
    case "chatter":
      return "💬";
    default:
      return "•";
  }
}

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recapText, setRecapText] = useState<string | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapCopied, setRecapCopied] = useState(false);

  // Filters
  const [q, setQ] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [daysFilter, setDaysFilter] = useState<number>(0); // 0 = all time
  const [hasAnchorFilter, setHasAnchorFilter] = useState(false);

  const sinceMs = useMemo(
    () => (daysFilter > 0 ? Date.now() - daysFilter * 86_400_000 : undefined),
    [daysFilter]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (projectFilter) params.set("project", projectFilter);
      if (roleFilter) params.set("role", roleFilter);
      if (sinceMs) params.set("since", String(sinceMs));
      if (hasAnchorFilter) params.set("hasAnchor", "1");
      params.set("limit", "200");
      const r = await fetch(`/api/agent-os/history?${params.toString()}`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const j = (await r.json()) as {
        rows: HistoryRow[];
        total: number;
        projects: string[];
      };
      setRows(j.rows);
      setTotal(j.total);
      setProjects(j.projects);
    } finally {
      setLoading(false);
    }
  }, [q, projectFilter, roleFilter, sinceMs, hasAnchorFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (sid: string) => {
    setDetailLoading(true);
    setDetail(null);
    setRecapText(null);
    try {
      const r = await fetch(`/api/agent-os/history/${sid}`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const j = (await r.json()) as HistoryDetail;
      setDetail(j);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function genRecap(sid: string) {
    setRecapLoading(true);
    setRecapText(null);
    try {
      const r = await fetch(`/api/agent-os/handoff/${sid}/preview`, {
        cache: "no-store",
      });
      if (!r.ok) {
        setRecapText("(failed to generate recap)");
        return;
      }
      const j = (await r.json()) as { recap?: string };
      setRecapText(j.recap ?? "(no recap)");
    } finally {
      setRecapLoading(false);
    }
  }

  async function copyRecap() {
    if (!recapText) return;
    try {
      await navigator.clipboard.writeText(recapText);
      setRecapCopied(true);
      setTimeout(() => setRecapCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const selected = rows.find((r) => r.sessionId === selectedId);

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
          <History className="h-4 w-4" />
          <h1 className="font-heading text-lg font-semibold tracking-tight">
            Session history
          </h1>
          <span className="text-[11px] text-muted-foreground">
            {total} session{total === 1 ? "" : "s"}
          </span>
        </div>
        <button
          onClick={() => void loadList()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Refresh
        </button>
      </header>

      <Card>
        <CardContent className="py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search projects, anchors, digests, paths…"
                className="w-full rounded-md border border-border bg-background pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30"
              />
            </div>
            <div className="flex items-center gap-1">
              <Folder className="h-3 w-3 text-muted-foreground" />
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">All roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleEmoji(r)} {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-[10px]">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setDaysFilter(p.days)}
                  className={cn(
                    "rounded px-2 py-1 font-medium",
                    daysFilter === p.days
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs cursor-pointer hover:bg-muted">
              <input
                type="checkbox"
                checked={hasAnchorFilter}
                onChange={(e) => setHasAnchorFilter(e.target.checked)}
                className="h-3 w-3"
              />
              <Target className="h-3 w-3 text-amber-500" />
              Has goal
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        {/* Sidebar list */}
        <aside className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {loading && rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">Loading…</p>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-xs text-muted-foreground">
                No sessions match these filters.
              </CardContent>
            </Card>
          ) : (
            rows.map((r) => (
              <button
                key={r.sessionId}
                onClick={() => setSelectedId(r.sessionId)}
                className={cn(
                  "w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50",
                  selectedId === r.sessionId &&
                    "ring-1 ring-foreground/40 bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base flex-shrink-0">
                      {roleEmoji(r.role)}
                    </span>
                    <span className="truncate font-mono font-medium">
                      {r.projectName}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {fmtDateShort(r.lastEventAt)}
                  </span>
                </div>
                {r.anchor && (
                  <p className="mt-1 line-clamp-1 text-[11px] text-amber-600 dark:text-amber-400">
                    🎯 {r.anchor}
                  </p>
                )}
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground leading-snug">
                  {r.digest ?? r.roleFocus ?? "(no digest yet)"}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-mono">{fmtTokens(r.effectiveTotal)}</span>
                  <span>·</span>
                  <span>{r.eventCount} events</span>
                  <span>·</span>
                  <span>{fmtDuration(r.durationMs)}</span>
                </div>
              </button>
            ))
          )}
        </aside>

        {/* Detail pane */}
        <main className="space-y-4 min-w-0">
          {!selectedId ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Pick a session on the left to see its anchor, digest, top files
                & tools, and generate a full recap on demand.
              </CardContent>
            </Card>
          ) : detailLoading || !detail || !selected ? (
            <Card>
              <CardContent className="py-12 text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading session…
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="text-base">
                        {roleEmoji(detail.meta.role)}
                      </span>
                      <span className="font-mono">{detail.meta.projectName}</span>
                      {detail.meta.role && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          · {detail.meta.role}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {fmtDateFull(detail.meta.startedAt)} —{" "}
                      {fmtDateFull(detail.meta.lastEventAt)} ·{" "}
                      {fmtDuration(detail.meta.durationMs)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {detail.meta.anchor && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
                      <Target className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" />
                      <span className="text-amber-700 dark:text-amber-300">
                        {detail.meta.anchor}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0 text-violet-500" />
                    <p className="flex-1 leading-snug">
                      {detail.meta.digest ?? (
                        <span className="text-muted-foreground">
                          (no digest)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border/60 pt-2 text-[10px]">
                    <div>
                      <p className="uppercase tracking-wide text-muted-foreground">
                        Effective
                      </p>
                      <p className="font-mono text-xs font-semibold">
                        {fmtTokens(detail.meta.effectiveTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-wide text-muted-foreground">
                        Cache reads
                      </p>
                      <p className="font-mono text-xs font-semibold">
                        {fmtTokens(detail.meta.cacheRead)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-wide text-muted-foreground">
                        Events
                      </p>
                      <p className="font-mono text-xs font-semibold">
                        {detail.meta.eventCount}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-wide text-muted-foreground">
                        Model
                      </p>
                      <p className="font-mono text-xs font-semibold">
                        {detail.meta.model ?? "—"}
                      </p>
                    </div>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    cwd: {detail.meta.cwd ?? "(unknown)"}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    session id: {detail.meta.sessionId}
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Wrench className="h-3 w-3 text-amber-500" />
                      Tools used
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detail.tools.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No tool calls.
                      </p>
                    ) : (
                      <ul className="space-y-0.5 font-mono text-[11px]">
                        {detail.tools.slice(0, 8).map((t) => (
                          <li
                            key={t.name}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{t.name}</span>
                            <span className="text-muted-foreground">
                              ×{t.count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <FileText className="h-3 w-3 text-sky-500" />
                      Files touched
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detail.files.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No file edits detected.
                      </p>
                    ) : (
                      <ul className="space-y-0.5 font-mono text-[11px] max-h-[160px] overflow-y-auto">
                        {detail.files.slice(0, 12).map((f, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between gap-2"
                            title={f.path}
                          >
                            <span className="truncate">{f.path}</span>
                            <span className="text-muted-foreground text-[10px]">
                              {f.toolName}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-emerald-500" />
                      Generate full recap
                    </span>
                    <div className="flex items-center gap-2">
                      {recapText && (
                        <button
                          onClick={copyRecap}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
                        >
                          {recapCopied ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {recapCopied ? "copied" : "copy"}
                        </button>
                      )}
                      <button
                        onClick={() => void genRecap(detail.meta.sessionId)}
                        disabled={recapLoading}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90",
                          recapLoading && "opacity-50"
                        )}
                      >
                        {recapLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {recapText ? "Regenerate" : "Generate"}
                      </button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recapLoading ? (
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Building
                      recap from {detail.totalLinesScanned} JSONL lines…
                    </p>
                  ) : recapText ? (
                    <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-mono text-[11px] leading-relaxed max-h-[440px]">
                      {recapText}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Click Generate to produce a full handoff-style recap (Last
                      ask, last reply, shell commands, files touched, token
                      usage) by replaying the JSONL transcript.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Recent events ({detail.events.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.events.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No events captured.
                    </p>
                  ) : (
                    <ul className="space-y-1 font-mono text-[11px] max-h-[280px] overflow-y-auto">
                      {detail.events
                        .slice()
                        .reverse()
                        .map((e, i) => (
                          <li
                            key={i}
                            className="grid grid-cols-[auto_auto_1fr] gap-2 items-baseline"
                          >
                            <span className="text-muted-foreground tabular-nums">
                              {new Date(e.ts).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                            <span
                              className={cn(
                                "rounded px-1 text-[9px] uppercase",
                                e.kind === "user"
                                  ? "bg-sky-500/10 text-sky-500"
                                  : e.kind === "assistant"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-amber-500/10 text-amber-500"
                              )}
                            >
                              {e.toolName ?? e.kind}
                            </span>
                            <span className="truncate">{e.summary}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
