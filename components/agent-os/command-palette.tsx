"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import type { SessionMeta } from "@/lib/agent-os/types";
import {
  Terminal,
  CalendarDays,
  Rocket,
  History,
  Sparkles,
  Camera,
  ArrowRight,
} from "lucide-react";

export function CommandPalette({
  sessions,
  onFocusSession,
}: {
  sessions: SessionMeta[];
  onFocusSession: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // Single-key: 1–9 jump to session (when not typing in a field)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (sessions[idx]) {
          onFocusSession(sessions[idx].sessionId);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessions, onFocusSession]);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="w-full"
      overlayClassName="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
      contentClassName="agentos dark fixed left-1/2 top-[16vh] z-[201] w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-xl"
    >
      <div className="w-full overflow-hidden">
        <div className="px-3 pt-3">
          <Command.Input
            placeholder="Jump to a session, page, or action…"
            className="ag-num w-full px-2 py-2"
            style={{ fontFamily: "inherit" }}
          />
        </div>
        <div
          className="mx-3 mt-2 h-px"
          style={{ background: "var(--ag-border)" }}
        />
        <Command.List className="max-h-[52vh] overflow-y-auto p-2">
          <Command.Empty
            className="px-3 py-6 text-center text-xs"
            style={{ color: "var(--ag-text-dim)" }}
          >
            No matches.
          </Command.Empty>

          {sessions.length > 0 && (
            <Command.Group heading="Sessions">
              {sessions.map((s, i) => (
                <Command.Item
                  key={s.sessionId}
                  value={`session ${s.projectName} ${s.cwd} ${s.lastSummary}`}
                  onSelect={() => {
                    setOpen(false);
                    onFocusSession(s.sessionId);
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2"
                >
                  <Terminal
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--ag-text-mut)" }}
                  />
                  <span className="flex-1 truncate">{s.projectName}</span>
                  <span
                    className="truncate text-[10px]"
                    style={{ color: "var(--ag-text-dim)" }}
                  >
                    {s.lastSummary}
                  </span>
                  {i < 9 && <kbd>{i + 1}</kbd>}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group heading="Navigate">
            {[
              { label: "Overview", path: "/agent-os", Icon: Terminal },
              { label: "Today", path: "/agent-os/today", Icon: CalendarDays },
              { label: "Projects", path: "/agent-os/projects", Icon: Rocket },
              { label: "History", path: "/agent-os/history", Icon: History },
              {
                label: "Workflows",
                path: "/agent-os/workflows",
                Icon: Sparkles,
              },
            ].map((n) => (
              <Command.Item
                key={n.path}
                value={`go ${n.label}`}
                onSelect={() => go(n.path)}
                className="flex items-center gap-2.5 px-2.5 py-2"
              >
                <n.Icon
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--ag-text-mut)" }}
                />
                <span className="flex-1">{n.label}</span>
                <ArrowRight
                  className="h-3 w-3"
                  style={{ color: "var(--ag-text-dim)" }}
                />
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Actions">
            <Command.Item
              value="snapshot all sessions handoff"
              onSelect={async () => {
                setOpen(false);
                await fetch("/api/agent-os/snapshot-all", { method: "POST" });
              }}
              className="flex items-center gap-2.5 px-2.5 py-2"
            >
              <Camera
                className="h-3.5 w-3.5"
                style={{ color: "var(--ag-text-mut)" }}
              />
              <span className="flex-1">Snapshot all sessions</span>
            </Command.Item>
          </Command.Group>
        </Command.List>
        <div
          className="flex items-center gap-3 px-3 py-2 text-[10px]"
          style={{
            color: "var(--ag-text-dim)",
            borderTop: "1px solid var(--ag-border)",
          }}
        >
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> select
          </span>
          <span>
            <kbd>1–9</kbd> jump to session
          </span>
          <span className="ml-auto">
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
}
