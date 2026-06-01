"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "./status-pill";
import {
  Folder,
  Terminal,
  Wrench,
  Target,
  Sparkles,
  Pencil,
  Check,
  X,
  CircleHelp,
  TerminalSquare,
} from "lucide-react";
import { TerminalPanel } from "./terminal-panel";
import { HeartbeatDot } from "./heartbeat-dot";
import type { SessionMeta } from "@/lib/agent-os/types";
import { cn } from "@/lib/utils";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return Math.floor(diff / 1000) + "s ago";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return Math.floor(diff / 86_400_000) + "d ago";
}

function roleEmoji(role: string): string {
  switch (role) {
    case "builder": return "🔨";
    case "debugger": return "🐛";
    case "researcher": return "🔍";
    case "planner": return "📋";
    case "reviewer": return "🧪";
    case "operator": return "🚀";
    case "writer": return "✍️";
    case "chatter": return "💬";
    default: return "•";
  }
}
function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
function roleBgClass(role: string): string {
  switch (role) {
    case "builder": return "bg-amber-500/15";
    case "debugger": return "bg-rose-500/15";
    case "researcher": return "bg-sky-500/15";
    case "planner": return "bg-violet-500/15";
    case "reviewer": return "bg-emerald-500/15";
    case "operator": return "bg-orange-500/15";
    case "writer": return "bg-cyan-500/15";
    case "chatter": return "bg-slate-500/15";
    default: return "bg-muted";
  }
}
function roleTextClass(role: string): string {
  switch (role) {
    case "builder": return "text-amber-600 dark:text-amber-400";
    case "debugger": return "text-rose-600 dark:text-rose-400";
    case "researcher": return "text-sky-600 dark:text-sky-400";
    case "planner": return "text-violet-600 dark:text-violet-400";
    case "reviewer": return "text-emerald-600 dark:text-emerald-400";
    case "operator": return "text-orange-600 dark:text-orange-400";
    case "writer": return "text-cyan-600 dark:text-cyan-400";
    case "chatter": return "text-slate-600 dark:text-slate-400";
    default: return "text-muted-foreground";
  }
}

export function SessionCard({ session }: { session: SessionMeta }) {
  const [editingAnchor, setEditingAnchor] = useState(false);
  const [anchorDraft, setAnchorDraft] = useState(session.anchor ?? "");
  const [showTerminal, setShowTerminal] = useState(false);
  const [digestLocal, setDigestLocal] = useState<string | null>(session.digest);
  const [goalAlignmentLocal, setGoalAlignmentLocal] = useState<string | null>(
    session.goalAlignment
  );
  const [digestRefreshing, setDigestRefreshing] = useState(false);

  useEffect(() => {
    setDigestLocal(session.digest);
    setGoalAlignmentLocal(session.goalAlignment);
  }, [session.digest, session.goalAlignment]);

  useEffect(() => {
    setAnchorDraft(session.anchor ?? "");
  }, [session.anchor]);

  const effective =
    session.tokensThisWindow.input +
    session.tokensThisWindow.output +
    session.tokensThisWindow.cacheCreate;
  const ctx = session.contextPct ?? 0;
  const ctxColor =
    ctx >= 80
      ? "text-rose-500"
      : ctx >= 60
      ? "text-amber-500"
      : "text-emerald-500";

  async function saveAnchor() {
    const text = anchorDraft.trim();
    try {
      await fetch(`/api/agent-os/sessions/${session.sessionId}/anchor`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch {
      /* ignore */
    }
    setEditingAnchor(false);
  }

  async function refreshDigest() {
    if (digestRefreshing) return;
    setDigestRefreshing(true);
    try {
      const r = await fetch(
        `/api/agent-os/sessions/${session.sessionId}/digest?refresh=1`
      );
      if (r.ok) {
        const j = (await r.json()) as {
          digest: string;
          goalAlignment: string | null;
        };
        setDigestLocal(j.digest);
        setGoalAlignmentLocal(j.goalAlignment);
      }
    } catch {
      /* ignore */
    } finally {
      setDigestRefreshing(false);
    }
  }

  // Auto-classify on mount if no role assigned
  useEffect(() => {
    if (session.role) return;
    if (session.status === "stale") return;
    void fetch(`/api/agent-os/sessions/${session.sessionId}/classify`).catch(() => {
      /* ignore */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionId]);

  // Auto-fetch digest on mount if missing
  useEffect(() => {
    if (digestLocal || digestRefreshing) return;
    if (session.status === "stale") return;
    void refreshDigest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionId]);

  const awaitingMs = session.awaitingSince
    ? Date.now() - session.awaitingSince
    : 0;
  const showPulse = session.awaitingInput && awaitingMs > 30_000;

  const alignmentColor =
    goalAlignmentLocal === "drift"
      ? "text-amber-500"
      : goalAlignmentLocal === "on track"
      ? "text-emerald-500"
      : "text-muted-foreground";

  return (
    <Card
      size="sm"
      className={cn(
        "transition-opacity relative",
        session.status === "stale" && "opacity-60",
        showPulse && "ring-2 ring-amber-500/60 ring-offset-1 ring-offset-background"
      )}
    >
      {showPulse && (
        <span className="absolute -top-1 -right-1 inline-flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
      )}

      <CardHeader className="pb-1">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 min-w-0">
            {session.role ? (
              <span
                className={cn(
                  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-sm",
                  roleBgClass(session.role)
                )}
                title={`${roleLabel(session.role)}${session.roleFocus ? ` — ${session.roleFocus}` : ""}`}
              >
                {roleEmoji(session.role)}
              </span>
            ) : (
              <Folder className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            )}
            <span className="truncate font-mono text-xs font-medium">
              {session.projectName}
            </span>
            {session.tmuxName && (
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-px font-mono text-[9px] text-emerald-600 dark:text-emerald-400">
                @{session.tmuxName}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <HeartbeatDot lastEventAt={session.lastEventAt} />
            <StatusPill status={session.status} />
          </span>
        </CardTitle>
        {session.role && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("text-[10px] font-medium uppercase tracking-wide", roleTextClass(session.role))}>
              {roleLabel(session.role)}
            </span>
            {session.roleFocus && (
              <span className="text-[10px] text-muted-foreground truncate">
                · {session.roleFocus}
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {/* Anchor: pinned goal */}
        {editingAnchor ? (
          <div className="flex items-start gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
            <Target className="h-3 w-3 mt-1 flex-shrink-0 text-amber-500" />
            <input
              type="text"
              value={anchorDraft}
              onChange={(e) => setAnchorDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveAnchor();
                if (e.key === "Escape") {
                  setAnchorDraft(session.anchor ?? "");
                  setEditingAnchor(false);
                }
              }}
              maxLength={200}
              placeholder="What are you building in this session?"
              className="flex-1 bg-transparent text-[11px] focus:outline-none placeholder:text-muted-foreground/50"
              autoFocus
            />
            <button
              onClick={() => void saveAnchor()}
              className="text-emerald-500 hover:bg-emerald-500/10 rounded p-0.5"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                setAnchorDraft(session.anchor ?? "");
                setEditingAnchor(false);
              }}
              className="text-muted-foreground hover:bg-muted rounded p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : session.anchor ? (
          <button
            onClick={() => setEditingAnchor(true)}
            className="group/anchor flex w-full items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-left hover:border-amber-500/50"
            title="Click to edit goal"
          >
            <Target className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" />
            <span className="flex-1 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
              {session.anchor}
            </span>
            <Pencil className="h-3 w-3 flex-shrink-0 text-amber-500/0 group-hover/anchor:text-amber-500/80 transition-colors" />
          </button>
        ) : (
          <button
            onClick={() => setEditingAnchor(true)}
            className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-border/40 px-2 py-1 text-left text-[11px] text-muted-foreground/60 hover:border-border hover:text-muted-foreground"
          >
            <Target className="h-3 w-3" />
            <span>Set goal for this session…</span>
          </button>
        )}

        {/* AI digest */}
        <div className="flex items-start gap-1.5">
          <Sparkles
            className={cn(
              "h-3 w-3 mt-0.5 flex-shrink-0 text-violet-500",
              digestRefreshing && "animate-pulse"
            )}
          />
          <p
            className="flex-1 text-[11px] leading-snug min-h-[2.4em]"
            title={digestLocal ?? ""}
          >
            {digestLocal || (
              <span className="text-muted-foreground/60">
                {digestRefreshing ? "Generating digest…" : "No digest yet."}
              </span>
            )}
          </p>
          {goalAlignmentLocal && (
            <span
              className={cn("text-[9px] font-medium", alignmentColor)}
              title="Activity vs. goal alignment"
            >
              {goalAlignmentLocal === "on track" ? "✓" : goalAlignmentLocal === "drift" ? "↯" : "?"}
            </span>
          )}
        </div>

        {showPulse && (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">
            <CircleHelp className="h-3 w-3 flex-shrink-0" />
            <span>
              Awaiting your input ({Math.floor(awaitingMs / 60_000)}m)
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {session.lastTool && (
            <span className="inline-flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {session.lastTool}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Terminal className="h-3 w-3" />
            {formatRelative(session.lastEventAt)}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              5h window
            </p>
            <p className="font-mono text-sm font-semibold">
              {formatTokens(effective)}
            </p>
          </div>
          {session.contextPct !== null && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Context
              </p>
              <p className={cn("font-mono text-sm font-semibold", ctxColor)}>
                {session.contextPct.toFixed(0)}%
              </p>
            </div>
          )}
        </div>

        {session.cwd && (
          <p
            className="truncate font-mono text-[10px] text-muted-foreground/70"
            title={session.cwd}
          >
            {session.cwd.replace(/^\/Users\/[^/]+/, "~")}
          </p>
        )}

        {session.tmuxName && (
          <div className="border-t border-border/60 pt-2">
            {showTerminal ? (
              <div className="space-y-2">
                <TerminalPanel
                  tmuxName={session.tmuxName}
                  onClose={() => setShowTerminal(false)}
                  height={280}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowTerminal(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium hover:bg-muted"
                title={`Open the @${session.tmuxName} tmux pane right here. Full keyboard.`}
              >
                <TerminalSquare className="h-3 w-3" />
                Open terminal
                <span className="font-mono text-[10px] text-muted-foreground">
                  @{session.tmuxName}
                </span>
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
