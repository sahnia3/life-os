import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import fs from "fs";

const TMUX_PATHS = [
  process.env.TMUX_BIN,
  "/opt/homebrew/bin/tmux",
  "/usr/local/bin/tmux",
  "/usr/bin/tmux",
].filter(Boolean) as string[];

let _resolvedTmux: string | null | undefined = undefined;

export function resolveTmux(): string | null {
  if (_resolvedTmux !== undefined) return _resolvedTmux;
  for (const p of TMUX_PATHS) {
    try {
      if (fs.existsSync(p)) {
        _resolvedTmux = p;
        return p;
      }
    } catch {
      /* skip */
    }
  }
  // Fall back to PATH lookup
  try {
    const path = execFileSync("which", ["tmux"], { encoding: "utf8" }).trim();
    if (path) {
      _resolvedTmux = path;
      return path;
    }
  } catch {
    /* skip */
  }
  _resolvedTmux = null;
  return null;
}

const execFileAsync = promisify(execFile);

export interface TmuxSession {
  name: string;
  created: number;
  attached: boolean;
  windows: number;
  panes: number;
  paneCmd: string | null;
  pid: number | null;
  panePath: string | null;
}

export async function listTmuxSessions(): Promise<TmuxSession[]> {
  const bin = resolveTmux();
  if (!bin) return [];

  try {
    const fmt =
      "#{session_name}|#{session_created}|#{session_attached}|#{session_windows}|#{pane_current_command}|#{pane_pid}|#{pane_current_path}";
    const { stdout } = await execFileAsync(bin, ["list-panes", "-a", "-F", fmt], {
      timeout: 3000,
    });
    const map = new Map<string, TmuxSession>();
    for (const line of stdout.split("\n")) {
      const parts = line.split("|");
      if (parts.length < 7) continue;
      const name = parts[0];
      if (!name) continue;
      const created = parseInt(parts[1], 10) * 1000;
      const attached = parts[2] !== "0";
      const windows = parseInt(parts[3], 10);
      const paneCmd = parts[4];
      const pid = parseInt(parts[5], 10);
      const panePath = parts[6] || null;
      const existing = map.get(name);
      if (existing) {
        existing.panes++;
        if (
          /^claude(-os)?$/.test(paneCmd) ||
          /node|bun/.test(paneCmd) === false
        ) {
          existing.paneCmd = paneCmd;
          existing.pid = pid;
          if (panePath) existing.panePath = panePath;
        }
      } else {
        map.set(name, {
          name,
          created,
          attached,
          windows,
          panes: 1,
          paneCmd,
          pid: isNaN(pid) ? null : pid,
          panePath,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.created - b.created);
  } catch {
    return [];
  }
}

export async function capturePane(
  target: string,
  scrollback = 200
): Promise<string> {
  const bin = resolveTmux();
  if (!bin) return "";
  // Sanitize target: only allow word chars, dash, underscore, colon (window:pane).
  if (!/^[A-Za-z0-9_:.\-]+$/.test(target)) {
    throw new Error("invalid target");
  }
  try {
    const { stdout } = await execFileAsync(
      bin,
      ["capture-pane", "-t", target, "-p", "-S", `-${scrollback}`],
      { timeout: 3000, maxBuffer: 1024 * 1024 }
    );
    return stdout;
  } catch (e) {
    throw new Error(
      "capture failed: " + (e instanceof Error ? e.message : String(e))
    );
  }
}

export async function sendKeys(
  target: string,
  text: string,
  withEnter = true
): Promise<void> {
  const bin = resolveTmux();
  if (!bin) throw new Error("tmux not installed");
  if (!/^[A-Za-z0-9_:.\-]+$/.test(target)) {
    throw new Error("invalid target");
  }
  if (text.length > 10000) throw new Error("text too long");

  // Send text literally
  await execFileAsync(bin, ["send-keys", "-t", target, "-l", text], {
    timeout: 3000,
  });
  if (withEnter) {
    await execFileAsync(bin, ["send-keys", "-t", target, "Enter"], {
      timeout: 3000,
    });
  }
}

export interface TmuxStatus {
  installed: boolean;
  path: string | null;
  sessionCount: number;
}

export async function tmuxStatus(): Promise<TmuxStatus> {
  const bin = resolveTmux();
  if (!bin) return { installed: false, path: null, sessionCount: 0 };
  const sessions = await listTmuxSessions();
  return { installed: true, path: bin, sessionCount: sessions.length };
}
