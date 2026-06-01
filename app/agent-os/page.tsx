"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SessionCard } from "@/components/agent-os/session-card";
import { TokenMeter } from "@/components/agent-os/token-meter";
import { CumulativeChart } from "@/components/agent-os/cumulative-chart";
import { ToolCallFeed } from "@/components/agent-os/tool-call-feed";
import { ScheduledTasksWidget } from "@/components/agent-os/widgets/scheduled-tasks";
import { ObsidianLogsWidget } from "@/components/agent-os/widgets/obsidian-logs";
import { PolymarketWidget } from "@/components/agent-os/widgets/polymarket-bot";
import { GmailUnreadWidget } from "@/components/agent-os/widgets/gmail-unread";
import { HandoffBanner } from "@/components/agent-os/handoff-banner";
import { QuickActions } from "@/components/agent-os/quick-actions";
import { MentionRouter } from "@/components/agent-os/mention-router";
import { LiveTerminals } from "@/components/agent-os/live-terminals";
import { BoardView } from "@/components/agent-os/board-view";
import { ProjectsTracker } from "@/components/agent-os/projects-tracker";
import { StatusStrip } from "@/components/agent-os/status-strip";
import { AttentionQueue } from "@/components/agent-os/attention-queue";
import { CollisionAlert } from "@/components/agent-os/collision-alert";
import { CommandPalette } from "@/components/agent-os/command-palette";
import { useAttention } from "@/components/agent-os/use-attention";
import {
  useAgentOsStream,
  useTokenRollup,
} from "@/components/agent-os/use-agent-os-stream";
import {
  Sparkles,
  LayoutGrid,
  KanbanSquare,
  History,
  CalendarDays,
  Rocket,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "board";
const VIEW_STORAGE_KEY = "agent-os-view-mode";

export default function AgentOsPage() {
  const { sessions, feed, connected } = useAgentOsStream();
  const attention = useAttention(4000);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    return v === "board" ? "board" : "grid";
  });
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const rollup = useTokenRollup(30_000);

  const sorted = useMemo(() => {
    const group = (s: { status: string; awaitingInput: boolean }) => {
      if (s.awaitingInput) return -1;
      if (s.status === "active" || s.status === "running-tool") return 0;
      if (s.status === "idle") return 1;
      return 2;
    };
    return [...sessions].sort((a, b) => {
      const g = group(a) - group(b);
      if (g !== 0) return g;
      return a.startedAt - b.startedAt;
    });
  }, [sessions]);

  const focusSession = useCallback((id: string) => {
    const el = document.getElementById(`session-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ag-flash");
      setTimeout(() => el.classList.remove("ag-flash"), 700);
    }
  }, []);

  const [tmuxNames, setTmuxNames] = useState<string[]>([]);
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/tmux/list", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { sessions: Array<{ name: string }> };
        if (mounted) setTmuxNames(j.sessions.map((s) => s.name));
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = setInterval(load, 10_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);
  const knownAliases = useMemo(() => {
    const set = new Set<string>(tmuxNames);
    if (tmuxNames.length > 0) set.add("all");
    return Array.from(set);
  }, [tmuxNames]);

  const navLinks = [
    { href: "/agent-os/today", label: "Today", Icon: CalendarDays },
    { href: "/agent-os/jobs", label: "Jobs", Icon: Briefcase },
    { href: "/agent-os/projects", label: "Projects", Icon: Rocket },
    { href: "/agent-os/history", label: "History", Icon: History },
    { href: "/agent-os/workflows", label: "Workflows", Icon: Sparkles },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 p-3 lg:p-5">
      <CommandPalette sessions={sorted} onFocusSession={focusSession} />

      <StatusStrip
        sessions={sessions}
        rollup={rollup}
        attention={attention.items}
        connected={connected}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex items-center gap-1">
          {navLinks.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{ color: "var(--ag-text-mut)" }}
            >
              <n.Icon className="h-3.5 w-3.5" />
              {n.label}
            </Link>
          ))}
        </nav>
        <QuickActions />
      </div>

      <HandoffBanner sessions={sessions} />
      <CollisionAlert />

      <AttentionQueue
        items={attention.items}
        onDismiss={attention.dismiss}
        onFocus={focusSession}
        notifyGranted={attention.notifyGranted}
        onRequestNotify={attention.requestNotifyPermission}
      />

      <MentionRouter knownAliases={knownAliases} />

      <LiveTerminals />

      <TokenMeter rollup={rollup} />

      <CumulativeChart />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-3">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2
                className="text-[11px] font-medium uppercase tracking-[0.1em]"
                style={{ color: "var(--ag-text-dim)" }}
              >
                Sessions · {sorted.length}
              </h2>
              <div
                className="inline-flex rounded-md p-0.5 text-[10px]"
                style={{ background: "var(--ag-nested)" }}
              >
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors"
                  )}
                  style={
                    viewMode === "grid"
                      ? { background: "var(--ag-overlay)", color: "var(--ag-text)" }
                      : { color: "var(--ag-text-dim)" }
                  }
                >
                  <LayoutGrid className="h-3 w-3" />
                  Grid
                </button>
                <button
                  onClick={() => setViewMode("board")}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors"
                  style={
                    viewMode === "board"
                      ? { background: "var(--ag-overlay)", color: "var(--ag-text)" }
                      : { color: "var(--ag-text-dim)" }
                  }
                >
                  <KanbanSquare className="h-3 w-3" />
                  Board
                </button>
              </div>
            </div>
            {sorted.length === 0 ? (
              <div
                className="ag-surface p-10 text-center"
                style={{ color: "var(--ag-text-dim)" }}
              >
                <p className="text-sm font-medium">No active sessions</p>
                <p className="mt-1 text-xs">
                  Run <code className="ag-num">claude</code> in any project — it
                  appears here within seconds.
                </p>
              </div>
            ) : viewMode === "board" ? (
              <BoardView sessions={sorted} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sorted.map((s) => (
                  <div key={s.sessionId} id={`session-${s.sessionId}`}>
                    <SessionCard session={s} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <ToolCallFeed items={feed} />
        </div>

        <aside className="space-y-3">
          <ProjectsTracker compact />
          <PolymarketWidget />
          <ScheduledTasksWidget />
          <ObsidianLogsWidget />
          <GmailUnreadWidget />
        </aside>
      </div>
    </div>
  );
}
