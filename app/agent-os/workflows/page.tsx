"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Plus,
  Save,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PlaybookSession {
  tmuxName: string;
  cwd: string;
  initialPrompt: string;
  permissionMode?: string;
  model?: string;
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  sessions: PlaybookSession[];
  createdAt: number;
  updatedAt: number;
}

interface PlaybookRun {
  runId: string;
  playbookId: string;
  startedAt: number;
  completedAt: number | null;
  sessions: Array<{
    tmuxName: string;
    cwd: string;
    ok: boolean;
    error?: string;
    pid?: number;
  }>;
}

function fmtAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return Math.floor(diff / 1000) + "s ago";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return Math.floor(diff / 86_400_000) + "d ago";
}

const EMPTY_PLAYBOOK: Playbook = {
  id: "",
  name: "",
  description: "",
  sessions: [
    {
      tmuxName: "",
      cwd: "",
      initialPrompt: "",
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

export default function WorkflowsPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [runs, setRuns] = useState<PlaybookRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    playbookId: string;
    run: PlaybookRun;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [pbResp, runsResp] = await Promise.all([
        fetch("/api/agent-os/playbooks", { cache: "no-store" }),
        fetch("/api/agent-os/playbooks/runs", { cache: "no-store" }),
      ]);
      if (pbResp.ok) {
        const j = (await pbResp.json()) as { playbooks: Playbook[] };
        setPlaybooks(j.playbooks);
        if (!selectedId && j.playbooks.length > 0) {
          setSelectedId(j.playbooks[0].id);
        }
      }
      if (runsResp.ok) {
        const j = (await runsResp.json()) as { runs: PlaybookRun[] };
        setRuns(j.runs);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadAll();
    const t = setInterval(() => void loadAll(), 15_000);
    return () => clearInterval(t);
  }, [loadAll]);

  const selected = useMemo(
    () => playbooks.find((p) => p.id === selectedId) ?? null,
    [playbooks, selectedId]
  );

  async function runPlaybook(id: string) {
    setRunningId(id);
    setError(null);
    try {
      const r = await fetch(`/api/agent-os/playbooks/${id}/run`, {
        method: "POST",
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? `HTTP ${r.status}`);
      } else {
        setLastResult({ playbookId: id, run: j.run });
        await loadAll();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "run failed");
    } finally {
      setRunningId(null);
    }
  }

  async function deletePlaybook(id: string) {
    if (!confirm(`Delete playbook "${id}"?`)) return;
    setError(null);
    try {
      const r = await fetch(`/api/agent-os/playbooks/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `HTTP ${r.status}`);
      } else {
        if (selectedId === id) setSelectedId(null);
        await loadAll();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    }
  }

  async function savePlaybook(pb: Playbook) {
    setError(null);
    try {
      const r = await fetch(`/api/agent-os/playbooks/${pb.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pb),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? `HTTP ${r.status}`);
      } else {
        setEditing(null);
        setSelectedId(pb.id);
        await loadAll();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    }
  }

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
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h1 className="font-heading text-lg font-semibold tracking-tight">
            Workflows
          </h1>
          <span className="text-[11px] text-muted-foreground">
            {playbooks.length} playbook{playbooks.length === 1 ? "" : "s"}
          </span>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY_PLAYBOOK, id: "" })}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
        >
          <Plus className="h-3 w-3" />
          New playbook
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-rose-500" />
          <p className="flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Playbook list */}
        <aside className="space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : playbooks.length === 0 ? (
            <Card>
              <CardContent className="py-4 text-xs text-muted-foreground">
                No playbooks yet. Click &ldquo;New playbook&rdquo; to define
                one.
              </CardContent>
            </Card>
          ) : (
            playbooks.map((pb) => (
              <button
                key={pb.id}
                onClick={() => {
                  setSelectedId(pb.id);
                  setEditing(null);
                }}
                className={cn(
                  "w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50",
                  selectedId === pb.id && "ring-1 ring-foreground/30"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{pb.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {pb.sessions.length} sess
                  </span>
                </div>
                {pb.description && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                    {pb.description}
                  </p>
                )}
              </button>
            ))
          )}
        </aside>

        {/* Main */}
        <main className="space-y-4 min-w-0">
          {editing ? (
            <PlaybookEditor
              initial={editing}
              isNew={!editing.id}
              onCancel={() => setEditing(null)}
              onSave={savePlaybook}
            />
          ) : selected ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{selected.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditing({ ...selected })}
                      className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deletePlaybook(selected.id)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => runPlaybook(selected.id)}
                      disabled={runningId === selected.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90",
                        runningId === selected.id && "opacity-50"
                      )}
                    >
                      {runningId === selected.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      Run
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {selected.description && (
                  <p className="text-muted-foreground">{selected.description}</p>
                )}
                <p className="font-mono text-[10px] text-muted-foreground">
                  id: {selected.id} · updated {fmtAgo(selected.updatedAt)}
                </p>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Sessions ({selected.sessions.length})
                  </p>
                  {selected.sessions.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-border/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium">
                          {s.tmuxName}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {s.cwd.replace(/^\/Users\/[^/]+/, "~")}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">
                        {s.initialPrompt}
                      </p>
                    </div>
                  ))}
                </div>

                {lastResult && lastResult.playbookId === selected.id && (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px]">
                    <p className="font-medium">Last run:</p>
                    <ul className="mt-1 space-y-0.5 font-mono">
                      {lastResult.run.sessions.map((s, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2"
                        >
                          {s.ok ? (
                            <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                          ) : (
                            <AlertCircle className="h-3 w-3 flex-shrink-0 text-rose-500" />
                          )}
                          <span>{s.tmuxName}</span>
                          {s.ok ? (
                            <span className="text-muted-foreground">
                              pid {s.pid}
                            </span>
                          ) : (
                            <span className="text-rose-500">{s.error}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-xs text-muted-foreground">
                Select a playbook from the left, or create a new one.
              </CardContent>
            </Card>
          )}

          {runs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent runs</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-[11px]">
                  {runs.slice(0, 10).map((r) => {
                    const okCount = r.sessions.filter((s) => s.ok).length;
                    return (
                      <li
                        key={r.runId}
                        className="flex items-center gap-2 font-mono"
                      >
                        <span className="text-muted-foreground tabular-nums">
                          {fmtAgo(r.startedAt)}
                        </span>
                        <span className="flex-1 truncate">{r.playbookId}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px]",
                            okCount === r.sessions.length
                              ? "bg-emerald-500/10 text-emerald-500"
                              : okCount === 0
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-amber-500/10 text-amber-500"
                          )}
                        >
                          {okCount}/{r.sessions.length} ok
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function PlaybookEditor({
  initial,
  isNew,
  onCancel,
  onSave,
}: {
  initial: Playbook;
  isNew: boolean;
  onCancel: () => void;
  onSave: (pb: Playbook) => void;
}) {
  const [pb, setPb] = useState<Playbook>(initial);

  const updateSession = (idx: number, patch: Partial<PlaybookSession>) => {
    setPb({
      ...pb,
      sessions: pb.sessions.map((s, i) =>
        i === idx ? { ...s, ...patch } : s
      ),
    });
  };

  const addSession = () => {
    setPb({
      ...pb,
      sessions: [
        ...pb.sessions,
        { tmuxName: "", cwd: "", initialPrompt: "" },
      ],
    });
  };

  const removeSession = (idx: number) => {
    setPb({
      ...pb,
      sessions: pb.sessions.filter((_, i) => i !== idx),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{isNew ? "New playbook" : `Edit: ${initial.name}`}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(pb)}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90"
            >
              <Save className="h-3 w-3" />
              Save
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr]">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              ID
            </label>
            <input
              type="text"
              value={pb.id}
              onChange={(e) =>
                setPb({ ...pb, id: e.target.value.toLowerCase() })
              }
              disabled={!isNew}
              placeholder="morning-standup"
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-xs disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Name
            </label>
            <input
              type="text"
              value={pb.name}
              onChange={(e) => setPb({ ...pb, name: e.target.value })}
              placeholder="Morning standup"
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Description
          </label>
          <input
            type="text"
            value={pb.description}
            onChange={(e) => setPb({ ...pb, description: e.target.value })}
            placeholder="One-line summary of what this playbook does"
            className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Sessions ({pb.sessions.length})
            </label>
            <button
              onClick={addSession}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] hover:bg-muted"
            >
              <Plus className="h-3 w-3" />
              Add session
            </button>
          </div>

          {pb.sessions.map((s, i) => (
            <div
              key={i}
              className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">
                  Session {i + 1}
                </span>
                {pb.sessions.length > 1 && (
                  <button
                    onClick={() => removeSession(i)}
                    className="text-rose-500 hover:bg-rose-500/10 rounded p-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
                <div>
                  <label className="text-[10px] text-muted-foreground">
                    tmux name
                  </label>
                  <input
                    type="text"
                    value={s.tmuxName}
                    onChange={(e) =>
                      updateSession(i, { tmuxName: e.target.value })
                    }
                    placeholder="ml"
                    className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">
                    cwd (absolute path)
                  </label>
                  <input
                    type="text"
                    value={s.cwd}
                    onChange={(e) => updateSession(i, { cwd: e.target.value })}
                    placeholder="/Users/adityasahni/Desktop/Claudecode/maplerewards"
                    className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">
                  Initial prompt
                </label>
                <textarea
                  rows={3}
                  value={s.initialPrompt}
                  onChange={(e) =>
                    updateSession(i, { initialPrompt: e.target.value })
                  }
                  placeholder="What should claude do first when this session starts?"
                  className="mt-0.5 w-full resize-y rounded-md border border-border bg-background px-2 py-1 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
