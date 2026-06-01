// Spawns the PTY-bridge sidecar if it's not already running.
// Call from any Node-runtime route handler. Idempotent.

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import net from "net";

declare global {
   
  var __agentOsBridge: { pid: number; startedAt: number } | undefined;
}

const BRIDGE_PORT = 3002;

function isPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 400);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    socket.connect(port, host);
  });
}

let starting = false;

export async function ensureBridge(): Promise<{ running: boolean; pid?: number }> {
  if (await isPortOpen(BRIDGE_PORT)) {
    return { running: true, pid: globalThis.__agentOsBridge?.pid };
  }
  if (starting) {
    return { running: false };
  }
  starting = true;
  try {
    const scriptPath = path.join(process.cwd(), "scripts", "pty-bridge.mjs");
    if (!fs.existsSync(scriptPath)) {
      console.warn("[agent-os] pty-bridge script not found:", scriptPath);
      return { running: false };
    }
    const proc = spawn(process.execPath, [scriptPath], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });
    proc.unref();
    globalThis.__agentOsBridge = {
      pid: proc.pid ?? -1,
      startedAt: Date.now(),
    };
    // Wait briefly for the port to come up
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 150));
      if (await isPortOpen(BRIDGE_PORT)) {
        return { running: true, pid: proc.pid };
      }
    }
    return { running: false, pid: proc.pid };
  } finally {
    starting = false;
  }
}
