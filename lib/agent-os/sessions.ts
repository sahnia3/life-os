import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { getClaudeSessionsDir } from "./db";

export interface ProcessInfo {
  pid: number;
  command: string;
  startedAt: number;
}

export interface SessionJsonRecord {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  version?: string;
}

export function listRunningClaudePids(): ProcessInfo[] {
  let out = "";
  try {
    out = execSync(`ps -axo pid=,etime=,command=`, {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    return [];
  }

  const results: ProcessInfo[] = [];
  const now = Date.now();
  for (const line of out.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Match claude binary references; exclude grep itself and bash invocations.
    if (!/(?:^|\s|\/)claude(?:\s|$)/.test(trimmed)) continue;
    if (/\bgrep\b/.test(trimmed)) continue;

    const m = /^(\d+)\s+(\S+)\s+(.*)$/.exec(trimmed);
    if (!m) continue;
    const pid = parseInt(m[1], 10);
    const elapsed = parseElapsed(m[2]);
    const command = m[3];
    if (!/(?:^|\/|\s)claude(?:\s|$)/.test(command)) continue;
    if (/--print|-p\b/.test(command)) continue;
    results.push({
      pid,
      command,
      startedAt: now - elapsed,
    });
  }
  return results;
}

function parseElapsed(s: string): number {
  // ps etime formats: [[dd-]hh:]mm:ss
  let days = 0;
  let rest = s;
  if (rest.includes("-")) {
    const [d, r] = rest.split("-");
    days = parseInt(d, 10);
    rest = r;
  }
  const parts = rest.split(":").map((p) => parseInt(p, 10));
  let h = 0,
    m = 0,
    sec = 0;
  if (parts.length === 3) [h, m, sec] = parts;
  else if (parts.length === 2) [m, sec] = parts;
  else if (parts.length === 1) [sec] = parts;
  return ((days * 24 + h) * 3600 + m * 60 + sec) * 1000;
}

export function readSessionJsonByPid(pid: number): SessionJsonRecord | null {
  const dir = getClaudeSessionsDir();
  if (!fs.existsSync(dir)) return null;
  const candidate = path.join(dir, `${pid}.json`);
  if (fs.existsSync(candidate)) {
    try {
      const raw = JSON.parse(fs.readFileSync(candidate, "utf8")) as Record<
        string,
        unknown
      >;
      if (typeof raw.sessionId === "string" && typeof raw.cwd === "string") {
        return {
          pid: typeof raw.pid === "number" ? raw.pid : pid,
          sessionId: raw.sessionId,
          cwd: raw.cwd,
          startedAt:
            typeof raw.startedAt === "number"
              ? raw.startedAt
              : typeof raw.startedAt === "string"
              ? Date.parse(raw.startedAt)
              : Date.now(),
          version: typeof raw.version === "string" ? raw.version : undefined,
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function listAllSessionJsonFiles(): SessionJsonRecord[] {
  const dir = getClaudeSessionsDir();
  if (!fs.existsSync(dir)) return [];
  const out: SessionJsonRecord[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Record<
        string,
        unknown
      >;
      if (typeof raw.sessionId === "string" && typeof raw.cwd === "string") {
        out.push({
          pid:
            typeof raw.pid === "number"
              ? raw.pid
              : parseInt(f.replace(/\.json$/, ""), 10) || 0,
          sessionId: raw.sessionId,
          cwd: raw.cwd,
          startedAt:
            typeof raw.startedAt === "number"
              ? raw.startedAt
              : typeof raw.startedAt === "string"
              ? Date.parse(raw.startedAt)
              : Date.now(),
          version: typeof raw.version === "string" ? raw.version : undefined,
        });
      }
    } catch {
      // ignore
    }
  }
  return out;
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function projectNameForCwd(cwd: string): string {
  return path.basename(cwd) || cwd;
}
