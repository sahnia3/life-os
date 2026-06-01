"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AtSign,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DispatchResult {
  broadcast: boolean;
  dispatched: Array<{
    tmuxName: string;
    text: string;
    sessionId: string | null;
    projectName: string | null;
    ok: boolean;
    error?: string;
  }>;
}

export function MentionRouter({
  knownAliases,
}: {
  knownAliases: string[]; // tmux names + @all
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<DispatchResult | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIdx, setSuggestIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Build autocomplete suggestions based on current "@..." token
  const { suggestions, replaceStart, replaceEnd } = useMemo(() => {
    const cursor = textareaRef.current?.selectionStart ?? input.length;
    const upToCursor = input.slice(0, cursor);
    const m = /@([A-Za-z0-9_\-]*)$/.exec(upToCursor);
    if (!m) return { suggestions: [] as string[], replaceStart: -1, replaceEnd: -1 };
    const fragment = m[1].toLowerCase();
    const matches = knownAliases
      .filter((a) => a.toLowerCase().startsWith(fragment))
      .slice(0, 6);
    return {
      suggestions: matches,
      replaceStart: cursor - fragment.length - 1, // include the @
      replaceEnd: cursor,
    };
  }, [input, knownAliases]);

  useEffect(() => {
    setSuggestOpen(suggestions.length > 0);
    setSuggestIdx(0);
  }, [suggestions]);

  function applySuggestion(alias: string) {
    if (replaceStart < 0) return;
    const before = input.slice(0, replaceStart);
    const after = input.slice(replaceEnd);
    const next = `${before}@${alias} ${after.trimStart()}`;
    setInput(next);
    // place cursor after the inserted token
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + alias.length + 2; // @alias_
        textareaRef.current.selectionStart = pos;
        textareaRef.current.selectionEnd = pos;
        textareaRef.current.focus();
      }
    }, 0);
    setSuggestOpen(false);
  }

  async function send() {
    if (!input.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/agent-os/router", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? `HTTP ${r.status}`);
      } else {
        setLast(j);
        setInput("");
        setTimeout(() => setLast(null), 8000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "send failed");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestIdx((i) => Math.min(suggestions.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        if (suggestions[suggestIdx]) {
          e.preventDefault();
          applySuggestion(suggestions[suggestIdx]);
          return;
        }
      }
      if (e.key === "Escape") {
        setSuggestOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const tmuxAliases = knownAliases.filter((a) => a !== "all");
  const tmuxCount = tmuxAliases.length;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AtSign className="h-4 w-4 text-foreground/80" />
          <h2 className="font-heading text-sm font-semibold">Type to talk to your terminals</h2>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Sends keystrokes to a tmux session — same as typing into the terminal
        </span>
      </div>

      <div className="relative">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-2 focus-within:ring-1 focus-within:ring-foreground/30">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={
              tmuxCount === 0
                ? "Wrap a claude session in tmux to enable routing (see hint below)"
                : `Type @ to pick a target. Example: @${tmuxAliases[0]} status?  ·  @all broadcasts.`
            }
            disabled={tmuxCount === 0 || sending}
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || tmuxCount === 0 || sending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90",
              (!input.trim() || tmuxCount === 0 || sending) && "opacity-40"
            )}
          >
            {sending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Send
          </button>
        </div>

        {suggestOpen && (
          <div className="absolute left-0 z-50 mt-1 w-64 rounded-md border border-border bg-card shadow-lg">
            <ul className="max-h-48 overflow-y-auto py-1">
              {suggestions.map((s, i) => (
                <li
                  key={s}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(s);
                  }}
                  onMouseEnter={() => setSuggestIdx(i)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 text-xs cursor-pointer",
                    i === suggestIdx && "bg-muted"
                  )}
                >
                  {s === "all" ? (
                    <Megaphone className="h-3 w-3 text-amber-500" />
                  ) : (
                    <AtSign className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="font-mono">@{s}</span>
                  {s === "all" && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      broadcast
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {tmuxCount === 0 ? (
        <p className="text-[11px] text-muted-foreground leading-snug">
          No tmux sessions detected. To route from here, wrap a claude session
          like this:
          {" "}
          <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
            tmux new -s mr &apos;cd ~/project &amp;&amp; claude-os&apos;
          </code>
          . Then it appears here as <code className="font-mono text-[10px]">@mr</code>.
        </p>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="text-muted-foreground">Available targets:</span>
          {tmuxAliases.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setInput((s) => (s.startsWith("@") ? s : `@${a} ${s}`));
                textareaRef.current?.focus();
              }}
              className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-px font-mono hover:bg-accent"
            >
              <AtSign className="h-2.5 w-2.5" />
              {a}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setInput((s) => (s.startsWith("@") ? s : `@all ${s}`));
              textareaRef.current?.focus();
            }}
            className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-px font-mono text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
          >
            <Megaphone className="h-2.5 w-2.5" />
            all
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-500">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {last && (
        <div className="space-y-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px]">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">
            Dispatched{last.broadcast ? " (broadcast)" : ""}:
          </p>
          <ul className="font-mono">
            {last.dispatched.map((d, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {d.ok ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-rose-500" />
                )}
                <span>@{d.tmuxName}</span>
                {!d.ok && <span className="text-rose-500">— {d.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
