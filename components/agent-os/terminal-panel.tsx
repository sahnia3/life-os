"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tmuxName: string;
  onClose?: () => void;
  height?: number;
}

const BRIDGE_BASE = "ws://localhost:3002/pty";

export function TerminalPanel({ tmuxName, onClose, height = 360 }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<unknown>(null);
  const fitRef = useRef<unknown>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "error">(
    "connecting"
  );
  const [err, setErr] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let mounted = true;
    let resizeObserver: ResizeObserver | null = null;

    async function setup() {
      try {
        // Dynamic imports so xterm.js doesn't run during SSR
        const { Terminal } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        // CSS for xterm
        await import("@xterm/xterm/css/xterm.css");

        if (!mounted || !wrapRef.current) return;

        const term = new Terminal({
          cursorBlink: true,
          fontFamily:
            "'SF Mono', 'JetBrains Mono', Menlo, Monaco, 'Liberation Mono', monospace",
          fontSize: 12,
          theme: {
            background: "#000000",
            foreground: "#d4d4d4",
            cursor: "#80ffea",
            cursorAccent: "#000000",
            selectionBackground: "#3b3b3b",
            black: "#000000",
            red: "#ff5555",
            green: "#50fa7b",
            yellow: "#f1fa8c",
            blue: "#bd93f9",
            magenta: "#ff79c6",
            cyan: "#8be9fd",
            white: "#bfbfbf",
            brightBlack: "#4d4d4d",
            brightRed: "#ff6e67",
            brightGreen: "#5af78e",
            brightYellow: "#f4f99d",
            brightBlue: "#caa9fa",
            brightMagenta: "#ff92d0",
            brightCyan: "#9aedfe",
            brightWhite: "#e6e6e6",
          },
          allowProposedApi: true,
          scrollback: 5000,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(wrapRef.current);
        fit.fit();
        termRef.current = term;
        fitRef.current = fit;

        const { cols, rows } = term;
        const ws = new WebSocket(
          `${BRIDGE_BASE}?target=${encodeURIComponent(tmuxName)}&cols=${cols}&rows=${rows}`
        );
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mounted) return;
          setStatus("open");
          term.focus();
        };
        ws.onmessage = (e) => {
          if (typeof e.data === "string") {
            term.write(e.data);
          } else if (e.data instanceof ArrayBuffer) {
            term.write(new Uint8Array(e.data));
          }
        };
        ws.onerror = () => {
          if (!mounted) return;
          setErr("Bridge unreachable. Is `npm run pty-bridge` running?");
          setStatus("error");
        };
        ws.onclose = () => {
          if (!mounted) return;
          setStatus("closed");
        };

        term.onData((data) => {
          if (ws.readyState === ws.OPEN) ws.send(data);
        });
        term.onResize(({ cols: c, rows: r }) => {
          if (ws.readyState === ws.OPEN) {
            ws.send("\x00" + JSON.stringify({ type: "resize", cols: c, rows: r }));
          }
        });

        // Fit on container resize
        if (wrapRef.current) {
          resizeObserver = new ResizeObserver(() => {
            try {
              fit.fit();
            } catch {
              /* ignore */
            }
          });
          resizeObserver.observe(wrapRef.current);
        }
      } catch (e) {
        if (mounted) {
          setErr(e instanceof Error ? e.message : "init failed");
          setStatus("error");
        }
      }
    }

    void setup();

    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      try {
        const term = termRef.current as { dispose?: () => void } | null;
        term?.dispose?.();
      } catch {
        /* ignore */
      }
    };
  }, [tmuxName]);

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-black overflow-hidden",
        fullscreen &&
          "fixed inset-4 z-50 shadow-2xl border-foreground/20"
      )}
      style={fullscreen ? undefined : { height }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border bg-card/80 px-3 py-1.5 text-[11px]">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              status === "open"
                ? "bg-emerald-500"
                : status === "connecting"
                ? "bg-amber-500 animate-pulse"
                : "bg-rose-500"
            )}
          />
          <span className="font-mono font-medium">@{tmuxName}</span>
          <span className="text-muted-foreground">
            {status === "open"
              ? "connected"
              : status === "connecting"
              ? "connecting…"
              : status === "closed"
              ? "disconnected"
              : "error"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              title="Close panel"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </header>

      {status === "connecting" && (
        <div className="absolute inset-x-0 top-8 flex items-center justify-center pointer-events-none">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-3 py-1 text-[10px] text-muted-foreground backdrop-blur">
            <Loader2 className="h-3 w-3 animate-spin" /> attaching to tmux…
          </span>
        </div>
      )}

      {err && (
        <div className="flex items-start gap-2 border-b border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-500">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <p className="flex-1">
            {err}
            <br />
            Start it with:{" "}
            <code className="font-mono">cd life-os && npm run pty-bridge</code>
          </p>
        </div>
      )}

      <div ref={wrapRef} className="flex-1 min-h-0" />

      <footer className="flex items-center gap-3 border-t border-border bg-card/80 px-3 py-1 text-[10px] text-muted-foreground">
        <span>
          Full keyboard: Shift+Tab cycles modes · Ctrl-b d detaches · scroll =
          history
        </span>
      </footer>
    </div>
  );
}
