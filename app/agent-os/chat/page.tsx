"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Loader2,
  Send,
  Terminal,
  TerminalSquare,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TmuxSession {
  name: string;
  created: number;
  attached: boolean;
  windows: number;
  panes: number;
  paneCmd: string | null;
  pid: number | null;
}

interface ListResp {
  installed: boolean;
  path: string | null;
  sessionCount: number;
  sessions: TmuxSession[];
}

interface CaptureResp {
  target: string;
  content: string;
  ts: number;
}

function fmtAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return Math.floor(diff / 1000) + "s ago";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return Math.floor(diff / 86_400_000) + "d ago";
}

function SnippetBlock({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-auto rounded-md bg-muted/60 px-3 py-2 font-mono text-[11px] leading-relaxed">
        {snippet}
      </pre>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* ignore */
          }
        }}
        className="absolute top-1 right-1 rounded-md bg-background/80 p-1 text-muted-foreground hover:bg-background"
        title="Copy"
      >
        <Copy className="h-3 w-3" />
      </button>
      {copied && (
        <span className="absolute top-1 right-8 text-[10px] text-emerald-500">
          copied!
        </span>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [listResp, setListResp] = useState<ListResp | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [capture, setCapture] = useState<CaptureResp | null>(null);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLPreElement | null>(null);
  const stickToBottomRef = useRef(true);

  // Poll session list every 5s
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/tmux/list", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = (await r.json()) as ListResp;
        if (!mounted) return;
        setListResp(j);
        if (!selected && j.sessions.length > 0) {
          setSelected(j.sessions[0].name);
        }
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = setInterval(load, 5_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [selected]);

  // Poll capture for selected session every 1.5s
  useEffect(() => {
    if (!selected) return;
    let mounted = true;
    setCaptureLoading(true);
    async function load() {
      try {
        const r = await fetch(
          `/api/agent-os/tmux/capture?target=${encodeURIComponent(selected!)}&lines=400`,
          { cache: "no-store" }
        );
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          if (mounted) setError(j.error ?? `HTTP ${r.status}`);
          return;
        }
        const j = (await r.json()) as CaptureResp;
        if (mounted) {
          setCapture(j);
          setError(null);
        }
      } catch (e) {
        if (mounted)
          setError(e instanceof Error ? e.message : "capture failed");
      } finally {
        if (mounted) setCaptureLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 1_500);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [selected]);

  // Auto-scroll on new content
  useEffect(() => {
    if (stickToBottomRef.current && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [capture]);

  const onScroll = useCallback(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = dist < 50;
  }, []);

  const onSend = useCallback(async () => {
    if (!selected || !input.trim()) return;
    setSending(true);
    try {
      const r = await fetch("/api/agent-os/tmux/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: selected, text: input, withEnter: true }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `HTTP ${r.status}`);
      } else {
        setInput("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "send failed");
    } finally {
      setSending(false);
    }
  }, [selected, input]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void onSend();
      }
    },
    [onSend]
  );

  const selectedSession = useMemo(
    () => listResp?.sessions.find((s) => s.name === selected),
    [listResp, selected]
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-screen">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <Link
            href="/agent-os"
            className="inline-flex items-center gap-1 rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <TerminalSquare className="h-4 w-4" />
          <h1 className="font-heading text-sm font-semibold">Session chat</h1>
          {listResp?.installed && (
            <span className="text-[10px] text-muted-foreground">
              {listResp.sessions.length} tmux session
              {listResp.sessions.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {selectedSession && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {selectedSession.paneCmd ?? "?"} · pid {selectedSession.pid} ·{" "}
            {fmtAgo(selectedSession.created)}
          </span>
        )}
      </header>

      {listResp && !listResp.installed && (
        <div className="m-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                tmux not installed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="text-muted-foreground">
                The chat view sends keystrokes to claude sessions running inside
                tmux. Install once, then wrap each claude session with{" "}
                <code>tmux</code> to enable browser-based input.
              </p>
              <SnippetBlock snippet={`brew install tmux`} />
              <p className="text-muted-foreground">
                After install, start any claude session like this — keep using
                the terminal as normal, and the chat view will appear here:
              </p>
              <SnippetBlock
                snippet={`tmux new -d -s mr 'cd ~/Desktop/Claudecode/maplerewards && claude-os'
tmux attach -t mr   # use the terminal as you normally would
# or just start the session attached:
tmux new -s mr 'cd ~/Desktop/Claudecode/maplerewards && claude-os'`}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {listResp?.installed && listResp.sessions.length === 0 && (
        <div className="m-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                No tmux sessions running
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="text-muted-foreground">
                Start each claude session inside tmux. The dashboard will pick
                them up automatically. None of your currently-running terminal
                sessions are affected — this is purely additive.
              </p>
              <SnippetBlock
                snippet={`# Replace 'mr' with a short name (e.g. ml, life, poly)
# Replace the path with the project dir
tmux new -s mr -d 'cd ~/Desktop/Claudecode/maplerewards && claude-os'

# Attach from your terminal when you want to interact directly:
tmux attach -t mr

# Detach (sessions keep running):
# Press Ctrl-b then d`}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {listResp?.installed && listResp.sessions.length > 0 && (
        <div className="flex flex-1 min-h-0">
          {/* Tab bar */}
          <nav className="w-48 flex-shrink-0 overflow-y-auto border-r border-border">
            {listResp.sessions.map((s) => (
              <button
                key={s.name}
                onClick={() => setSelected(s.name)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left text-xs hover:bg-muted/50",
                  selected === s.name && "bg-muted"
                )}
              >
                <div className="flex w-full items-center gap-1.5">
                  <Terminal className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono font-medium">
                    {s.name}
                  </span>
                  {s.attached && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </div>
                <p className="truncate text-[10px] text-muted-foreground">
                  {s.paneCmd ?? "—"} · {s.panes} pane{s.panes === 1 ? "" : "s"}
                </p>
              </button>
            ))}
          </nav>

          {/* Main pane */}
          <div className="flex min-w-0 flex-1 flex-col">
            <pre
              ref={transcriptRef}
              onScroll={onScroll}
              className="flex-1 overflow-auto whitespace-pre-wrap bg-black px-3 py-2 font-mono text-[11px] leading-relaxed text-emerald-200/90"
            >
              {captureLoading && !capture ? (
                <span className="text-muted-foreground">
                  <Loader2 className="inline h-3 w-3 animate-spin" /> Capturing
                  pane...
                </span>
              ) : capture ? (
                capture.content
              ) : (
                <span className="text-muted-foreground">
                  Select a session on the left.
                </span>
              )}
            </pre>

            {error && (
              <div className="border-t border-border bg-rose-500/10 px-3 py-1 text-[11px] text-rose-500">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void onSend();
              }}
              className="flex items-end gap-2 border-t border-border bg-card p-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={
                  selected
                    ? "Type a prompt — Enter to send, Shift+Enter for newline"
                    : "Pick a session first"
                }
                rows={2}
                disabled={!selected || sending}
                className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 font-mono text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/30"
              />
              <button
                type="submit"
                disabled={!selected || !input.trim() || sending}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background",
                  (!selected || !input.trim() || sending) && "opacity-40"
                )}
              >
                {sending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Send
                <span className="text-[10px] text-background/60">⏎</span>
              </button>
            </form>

            <p className="border-t border-border bg-muted/30 px-3 py-1 text-[10px] text-muted-foreground">
              Sent via <code>tmux send-keys</code> — same as typing into the
              terminal. Attach with{" "}
              <code className="font-mono">
                tmux attach -t {selected ?? "&lt;name&gt;"}
              </code>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
