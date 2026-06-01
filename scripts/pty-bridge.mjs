#!/usr/bin/env node
// Sidecar WebSocket → PTY bridge for the Agent OS terminal embed.
// Listens on ws://localhost:3002/pty?target=<tmuxName>&cols=80&rows=24
// On connection: spawns `tmux attach -t <name>` in a PTY, pipes both directions.
// Detach with tmux's Ctrl-b d. Closing the socket also kills the PTY.

import { WebSocketServer } from "ws";
import { spawn } from "node-pty";
import { existsSync } from "fs";

const PORT = parseInt(process.env.PTY_BRIDGE_PORT || "3002", 10);
const TMUX_PATHS = [
  process.env.TMUX_BIN,
  "/opt/homebrew/bin/tmux",
  "/usr/local/bin/tmux",
  "/usr/bin/tmux",
].filter(Boolean);

function resolveTmux() {
  for (const p of TMUX_PATHS) {
    try {
      if (existsSync(p)) return p;
    } catch {
      /* skip */
    }
  }
  return "tmux"; // fall back to PATH
}

const TMUX = resolveTmux();

const wss = new WebSocketServer({
  port: PORT,
  // Only accept localhost connections — this is a personal-use bridge.
  verifyClient: (info) => {
    const origin = info.origin || "";
    const host = info.req.headers.host || "";
    return (
      host.startsWith("localhost:") ||
      host.startsWith("127.0.0.1:") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1")
    );
  },
});

console.log(`[pty-bridge] listening on ws://localhost:${PORT}/pty`);
console.log(`[pty-bridge] tmux binary: ${TMUX}`);

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const target = url.searchParams.get("target");
  const cols = Math.max(40, Math.min(400, parseInt(url.searchParams.get("cols") || "80", 10)));
  const rows = Math.max(10, Math.min(200, parseInt(url.searchParams.get("rows") || "24", 10)));

  if (!target || !/^[A-Za-z0-9_\-]{1,40}$/.test(target)) {
    ws.close(1008, "invalid target");
    return;
  }

  console.log(`[pty-bridge] open: target=${target} ${cols}x${rows}`);

  const pty = spawn(TMUX, ["attach", "-t", target], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: process.env.HOME,
    env: process.env,
  });

  let closed = false;
  function cleanup(reason) {
    if (closed) return;
    closed = true;
    try {
      pty.kill();
    } catch {
      /* skip */
    }
    try {
      ws.close();
    } catch {
      /* skip */
    }
    console.log(`[pty-bridge] close: target=${target} (${reason})`);
  }

  pty.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(data);
      } catch (e) {
        cleanup("send-error: " + e.message);
      }
    }
  });

  pty.onExit(({ exitCode }) => {
    cleanup(`pty exit ${exitCode}`);
  });

  ws.on("message", (msg) => {
    try {
      const str = msg.toString();
      // Control frames are prefixed with '\x00' for JSON resize commands
      if (str.startsWith("\x00{")) {
        try {
          const obj = JSON.parse(str.slice(1));
          if (obj.type === "resize" && obj.cols && obj.rows) {
            pty.resize(
              Math.max(40, Math.min(400, obj.cols)),
              Math.max(10, Math.min(200, obj.rows))
            );
          }
          return;
        } catch {
          /* fall through to raw write */
        }
      }
      pty.write(str);
    } catch (e) {
      cleanup("recv-error: " + e.message);
    }
  });

  ws.on("close", () => cleanup("ws closed"));
  ws.on("error", (e) => cleanup("ws error: " + e.message));
});

wss.on("error", (e) => {
  console.error("[pty-bridge] server error:", e);
});

process.on("SIGINT", () => {
  console.log("[pty-bridge] shutting down");
  wss.close();
  process.exit(0);
});
