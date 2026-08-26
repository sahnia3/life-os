"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Rocket,
  Plus,
  Save,
  Trash2,
  Calendar,
  AlertTriangle,
  FileText,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProjectStats {
  id: string;
  name: string;
  cwd: string;
  targetDate: string | null;
  manualPct: number | null;
  statusNote: string;
  progressPct: number;
  source: "manual" | "milestones" | "sessions" | "none";
  daysUntilTarget: number | null;
  overdue: boolean;
  sessionsLast7d: number;
  effectiveTokensLast7d: number;
  commitsLast7d: number;
  lastActivityAt: number | null;
  planFiles: Array<{ path: string; mtimeMs: number }>;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function barColor(pct: number, overdue: boolean): string {
  if (overdue && pct < 100) return "bg-rose-500";
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-sky-500";
}

function fmtAge(ms: number): string {
  const d = new Date(ms);
  const diff = Date.now() - ms;
  if (diff < 86_400_000)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString();
}

const EMPTY: Partial<ProjectStats> = {
  id: "",
  name: "",
  cwd: "",
  targetDate: null,
  manualPct: null,
  statusNote: "",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ProjectStats> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/agent-os/projects", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { projects: ProjectStats[] };
      setProjects(j.projects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(p: Partial<ProjectStats>) {
    setError(null);
    const r = await fetch(`/api/agent-os/projects/${p.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? `HTTP ${r.status}`);
      return;
    }
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(`Delete project "${id}"?`)) return;
    setError(null);
    const r = await fetch(`/api/agent-os/projects/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? `HTTP ${r.status}`);
      return;
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 lg:p-6">
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
          <Rocket className="h-4 w-4 text-orange-500" />
          <h1 className="font-heading text-lg font-semibold tracking-tight">
            Projects
          </h1>
          <span className="text-[11px] text-muted-foreground">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </span>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
        >
          <Plus className="h-3 w-3" />
          New project
        </button>
      </header>

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-500">
          {error}
        </div>
      )}

      {editing && <Editor initial={editing} onCancel={() => setEditing(null)} onSave={save} />}

      {loading && projects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-xs text-muted-foreground">
            No projects tracked yet. Click <strong>New project</strong> above to
            add one. Progress comes from a manual %, a <code>PLAN.md</code>{" "}
            checklist <code>- [x]</code>, or recent session velocity.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span className="font-mono font-medium">{p.name}</span>
                    <span className="text-[10px] font-normal text-muted-foreground truncate">
                      {p.cwd.replace(/^\/Users\/[^/]+/, "~")}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditing(p)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void remove(p.id)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    <span className="font-mono font-semibold text-foreground text-base">
                      {Math.round(p.progressPct)}%
                    </span>{" "}
                    · source:{" "}
                    {p.source === "manual"
                      ? "manual"
                      : p.source === "milestones"
                      ? "PLAN.md checklist"
                      : p.source === "sessions"
                      ? "session velocity"
                      : "no source"}
                  </span>
                  {p.targetDate && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        p.overdue && "text-rose-500"
                      )}
                    >
                      {p.overdue ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <Calendar className="h-3 w-3" />
                      )}
                      {p.overdue
                        ? `overdue ${-(p.daysUntilTarget ?? 0)} day${-(p.daysUntilTarget ?? 0) === 1 ? "" : "s"}`
                        : p.daysUntilTarget !== null && p.daysUntilTarget >= 0
                        ? `${p.daysUntilTarget} day${p.daysUntilTarget === 1 ? "" : "s"} to ${p.targetDate}`
                        : p.targetDate}
                    </span>
                  )}
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-[width]",
                      barColor(p.progressPct, p.overdue)
                    )}
                    style={{ width: `${Math.min(100, p.progressPct)}%` }}
                  />
                </div>
                {p.statusNote && (
                  <p className="text-[11px] text-muted-foreground">
                    {p.statusNote}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-3 border-t border-border/60 pt-2 text-[10px]">
                  <div>
                    <p className="uppercase tracking-wide text-muted-foreground">
                      Sessions (7d)
                    </p>
                    <p className="font-mono text-xs font-semibold">
                      {p.sessionsLast7d}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-muted-foreground">
                      Commits (7d)
                    </p>
                    <p className="font-mono text-xs font-semibold">
                      {p.commitsLast7d}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-muted-foreground">
                      Tokens (7d)
                    </p>
                    <p className="font-mono text-xs font-semibold">
                      {fmt(p.effectiveTokensLast7d)}
                    </p>
                  </div>
                </div>
                {p.planFiles.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      <FileText className="inline h-3 w-3" /> Plans & reports
                    </p>
                    <ul className="space-y-0 font-mono text-[11px] max-h-[100px] overflow-y-auto">
                      {p.planFiles.map((f, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between gap-2"
                          title={f.path}
                        >
                          <span className="truncate">{f.path}</span>
                          <span className="text-muted-foreground text-[10px]">
                            {fmtAge(f.mtimeMs)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Editor({
  initial,
  onCancel,
  onSave,
}: {
  initial: Partial<ProjectStats>;
  onCancel: () => void;
  onSave: (p: Partial<ProjectStats>) => void;
}) {
  const [p, setP] = useState<Partial<ProjectStats>>(initial);
  const isNew = !initial.id;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{isNew ? "New project" : `Edit ${initial.name}`}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCancel}
              className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(p)}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90"
            >
              <Save className="h-3 w-3" />
              Save
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr]">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              ID
            </label>
            <input
              type="text"
              value={p.id ?? ""}
              onChange={(e) => setP({ ...p, id: e.target.value.toLowerCase() })}
              disabled={!isNew}
              placeholder="maplerewards"
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-xs disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Display name
            </label>
            <input
              type="text"
              value={p.name ?? ""}
              onChange={(e) => setP({ ...p, name: e.target.value })}
              placeholder="MapleRewards"
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Working directory (absolute path)
          </label>
          <input
            type="text"
            value={p.cwd ?? ""}
            onChange={(e) => setP({ ...p, cwd: e.target.value })}
            placeholder="/Users/adityasahni/Desktop/Claudecode/maplerewards"
            className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Target date (optional)
            </label>
            <input
              type="date"
              value={p.targetDate ?? ""}
              onChange={(e) =>
                setP({ ...p, targetDate: e.target.value || null })
              }
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Manual % (optional — overrides auto)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={p.manualPct ?? ""}
              onChange={(e) =>
                setP({
                  ...p,
                  manualPct: e.target.value === "" ? null : parseInt(e.target.value, 10),
                })
              }
              placeholder="auto"
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Status note
          </label>
          <input
            type="text"
            value={p.statusNote ?? ""}
            onChange={(e) => setP({ ...p, statusNote: e.target.value })}
            placeholder="Currently blocked on Stripe webhook configuration"
            className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          If you leave Manual % empty, we&apos;ll compute progress from a{" "}
          <code>PLAN.md</code> / <code>ROADMAP.md</code> / <code>TODO.md</code>{" "}
          checklist (counts <code>- [x]</code> vs <code>- [ ]</code>), falling
          back to session velocity if none exists.
        </p>
      </CardContent>
    </Card>
  );
}
