import fs from "fs";
import path from "path";
import os from "os";

const RATELIMIT_DIR = path.join(os.homedir(), ".claude", "agent-os", "ratelimit");

export interface RateLimitWindow {
  usedPercentage: number;
  resetsAt: number; // ms epoch
}

export interface RateLimitSnapshot {
  fiveHour: RateLimitWindow | null;
  sevenDay: RateLimitWindow | null;
  capturedAt: number;
  sourceSessionId: string;
  model: string | null;
  cwd: string | null;
  stale: boolean; // > 10 min old
  ageMs: number;
}

interface RawFile {
  session_id: string;
  rate_limits?: {
    five_hour?: { used_percentage?: number; resets_at?: number | string };
    seven_day?: { used_percentage?: number; resets_at?: number | string };
  };
  captured_at: number;
  model?: string | null;
  cwd?: string | null;
}

function toMs(ts: number | string | undefined): number | null {
  if (ts == null) return null;
  if (typeof ts === "number") {
    // Heuristic: seconds vs ms (claude statusline uses seconds for resets_at)
    return ts < 1e12 ? ts * 1000 : ts;
  }
  const parsed = Date.parse(ts);
  return isNaN(parsed) ? null : parsed;
}

function parseWindow(w?: {
  used_percentage?: number;
  resets_at?: number | string;
}): RateLimitWindow | null {
  if (!w || typeof w.used_percentage !== "number") return null;
  const resets = toMs(w.resets_at);
  if (resets == null) return null;
  return { usedPercentage: w.used_percentage, resetsAt: resets };
}

export function readLatestRateLimit(): RateLimitSnapshot | null {
  if (!fs.existsSync(RATELIMIT_DIR)) return null;
  let entries: Array<{ file: string; mtimeMs: number }>;
  try {
    entries = fs
      .readdirSync(RATELIMIT_DIR)
      .filter((f) => f.endsWith(".json") && !f.startsWith("_debug"))
      .map((f) => {
        const fp = path.join(RATELIMIT_DIR, f);
        return { file: fp, mtimeMs: fs.statSync(fp).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return null;
  }

  for (const { file } of entries) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as RawFile;
      const fiveHour = parseWindow(raw.rate_limits?.five_hour);
      const sevenDay = parseWindow(raw.rate_limits?.seven_day);
      if (!fiveHour && !sevenDay) continue;
      const ageMs = Date.now() - raw.captured_at;
      return {
        fiveHour,
        sevenDay,
        capturedAt: raw.captured_at,
        sourceSessionId: raw.session_id,
        model: raw.model ?? null,
        cwd: raw.cwd ?? null,
        stale: ageMs > 10 * 60 * 1000,
        ageMs,
      };
    } catch {
      continue;
    }
  }
  return null;
}
