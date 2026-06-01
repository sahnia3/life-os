"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TerminalSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TerminalPanel } from "./terminal-panel";

interface TmuxSession {
  name: string;
  created: number;
  attached: boolean;
  panes: number;
  paneCmd: string | null;
  panePath: string | null;
  pid: number | null;
}

function fmtAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return Math.floor(diff / 1000) + "s ago";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return Math.floor(diff / 86_400_000) + "d ago";
}

export function LiveTerminals() {
  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const [openName, setOpenName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/tmux/list", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { sessions: TmuxSession[] };
        if (mounted) setSessions(j.sessions);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 5_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  if (loading && sessions.length === 0) return null;
  if (sessions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TerminalSquare className="h-3.5 w-3.5 text-emerald-500" />
          Live terminals
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            {sessions.length} tmux session{sessions.length === 1 ? "" : "s"} ·
            click to embed
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {sessions.map((s) => (
            <button
              key={s.name}
              onClick={() =>
                setOpenName((cur) => (cur === s.name ? null : s.name))
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted",
                openName === s.name && "bg-muted ring-1 ring-foreground/30"
              )}
              title={`@${s.name}: ${s.paneCmd ?? "—"} · ${s.panePath ?? ""}`}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  s.attached ? "bg-emerald-500" : "bg-muted-foreground/50"
                )}
              />
              <span className="font-mono">@{s.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {s.paneCmd ?? "—"} · {fmtAgo(s.created)}
              </span>
            </button>
          ))}
          {openName && (
            <button
              onClick={() => setOpenName(null)}
              className="ml-1 inline-flex items-center gap-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              close
            </button>
          )}
        </div>

        {openName && (
          <TerminalPanel
            tmuxName={openName}
            onClose={() => setOpenName(null)}
            height={420}
          />
        )}
      </CardContent>
    </Card>
  );
}
