import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { getDb } from "./db";

const PROJECTS_FILE = path.join(
  os.homedir(),
  ".claude",
  "agent-os",
  "projects.json"
);

export interface Project {
  id: string;
  name: string;
  cwd: string;
  targetDate: string | null; // YYYY-MM-DD
  manualPct: number | null; // 0-100
  statusNote: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectWithStats extends Project {
  progressPct: number;
  source: "manual" | "milestones" | "sessions" | "none";
  daysUntilTarget: number | null;
  overdue: boolean;
  sessionsLast7d: number;
  effectiveTokensLast7d: number;
  lastActivityAt: number | null;
  commitsLast7d: number;
  planFiles: Array<{ path: string; mtimeMs: number }>;
}

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,40}$/;

function ensure(): void {
  const dir = path.dirname(PROJECTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects: [] }, null, 2));
  }
}

function read(): Project[] {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf8")) as {
      projects: Project[];
    };
    return raw.projects || [];
  } catch {
    return [];
  }
}

function write(projects: Project[]): void {
  ensure();
  fs.writeFileSync(
    PROJECTS_FILE,
    JSON.stringify({ projects }, null, 2),
    "utf8"
  );
}

export function listProjects(): Project[] {
  return read();
}

export function getProject(id: string): Project | null {
  return read().find((p) => p.id === id) ?? null;
}

export function saveProject(
  input: Partial<Project> & { id: string; name: string; cwd: string }
):
  | { ok: true; project: Project }
  | { ok: false; error: string } {
  if (!ID_RE.test(input.id))
    return { ok: false, error: "id must be lowercase alphanumeric/dash/underscore" };
  if (!input.name?.trim()) return { ok: false, error: "name required" };
  if (!input.cwd?.startsWith("/"))
    return { ok: false, error: "cwd must be absolute path" };

  const projects = read();
  const idx = projects.findIndex((p) => p.id === input.id);
  const now = Date.now();
  const merged: Project = {
    id: input.id,
    name: input.name.trim(),
    cwd: input.cwd.trim(),
    targetDate: input.targetDate ?? null,
    manualPct:
      typeof input.manualPct === "number"
        ? Math.max(0, Math.min(100, input.manualPct))
        : null,
    statusNote: (input.statusNote ?? "").slice(0, 300),
    createdAt: idx >= 0 ? projects[idx].createdAt : now,
    updatedAt: now,
  };
  if (idx >= 0) projects[idx] = merged;
  else projects.push(merged);
  write(projects);
  return { ok: true, project: merged };
}

export function deleteProject(id: string): boolean {
  const projects = read();
  const filtered = projects.filter((p) => p.id !== id);
  if (filtered.length === projects.length) return false;
  write(filtered);
  return true;
}

function safeGit(cwd: string, args: string[]): string {
  try {
    return execSync(`git ${args.join(" ")}`, {
      cwd,
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function isMilestoneFile(name: string): boolean {
  return /^(PLAN|README|REPORT|ROADMAP|HANDOFF|TODO|CHANGELOG)/i.test(name);
}

function planFiles(cwd: string): Array<{ path: string; mtimeMs: number }> {
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) return [];
  const out: Array<{ path: string; mtimeMs: number }> = [];
  // Just top-level + a couple known subdirs.
  const seen = new Set<string>();
  function scan(dir: string, depth: number) {
    if (depth > 2) return;
    let names: string[];
    try {
      names = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const full = path.join(dir, name);
      let st: fs.Stats;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        // Drill into select directories
        if (/^(\.planning|plans|docs|reports)$/i.test(name)) {
          scan(full, depth + 1);
        }
        continue;
      }
      if (!isMilestoneFile(name)) continue;
      if (!/\.(md|pdf|txt)$/i.test(name)) continue;
      if (seen.has(full)) continue;
      seen.add(full);
      out.push({ path: full.replace(cwd + "/", ""), mtimeMs: st.mtimeMs });
    }
  }
  scan(cwd, 0);
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 8);
}

function computeMilestonePct(cwd: string): number | null {
  // Parse PLAN.md or ROADMAP.md for "- [ ]" / "- [x]" task lines.
  for (const name of ["PLAN.md", "ROADMAP.md", "TODO.md"]) {
    const p = path.join(cwd, name);
    if (!fs.existsSync(p)) continue;
    try {
      const raw = fs.readFileSync(p, "utf8");
      const total = (raw.match(/^[\s>-]*\[[ xX-]\]/gm) ?? []).length;
      const done = (raw.match(/^[\s>-]*\[[xX]\]/gm) ?? []).length;
      if (total > 0) return Math.round((done / total) * 100);
    } catch {
      /* skip */
    }
  }
  return null;
}

export function getProjectsWithStats(): ProjectWithStats[] {
  const projects = read();
  if (projects.length === 0) return [];
  const db = getDb();
  const sevenDaysAgo = Date.now() - 7 * 86_400_000;

  return projects.map((p) => {
    // Sessions/tokens in last 7 days where cwd matches (prefix-match)
    const rows = db
      .prepare(
        `SELECT DISTINCT session_id FROM token_events WHERE ts >= ? AND cwd LIKE ?`
      )
      .all(sevenDaysAgo, p.cwd + "%") as Array<{ session_id: string }>;
    const sessionsLast7d = rows.length;

    const tokRow = db
      .prepare(
        `SELECT
          COALESCE(SUM(input + output + cache_create), 0) AS effective,
          MAX(ts) AS lastTs
         FROM token_events WHERE ts >= ? AND cwd LIKE ?`
      )
      .get(sevenDaysAgo, p.cwd + "%") as {
      effective: number;
      lastTs: number | null;
    };

    const commitsRaw = safeGit(p.cwd, [
      "log",
      "--since='7 days ago'",
      "--oneline",
      "--pretty=oneline",
    ]);
    const commitsLast7d = commitsRaw
      ? commitsRaw.split("\n").filter(Boolean).length
      : 0;

    // Pick progress source
    let progressPct = 0;
    let source: ProjectWithStats["source"] = "none";
    if (typeof p.manualPct === "number") {
      progressPct = p.manualPct;
      source = "manual";
    } else {
      const milePct = computeMilestonePct(p.cwd);
      if (milePct !== null) {
        progressPct = milePct;
        source = "milestones";
      } else if (sessionsLast7d > 0) {
        // Heuristic: arbitrary scaling from session count + commits
        progressPct = Math.min(100, sessionsLast7d * 8 + commitsLast7d * 4);
        source = "sessions";
      }
    }

    let daysUntilTarget: number | null = null;
    let overdue = false;
    if (p.targetDate) {
      const target = Date.parse(p.targetDate + "T23:59:59");
      if (!isNaN(target)) {
        daysUntilTarget = Math.ceil((target - Date.now()) / 86_400_000);
        overdue = daysUntilTarget < 0;
      }
    }

    return {
      ...p,
      progressPct,
      source,
      daysUntilTarget,
      overdue,
      sessionsLast7d,
      effectiveTokensLast7d: tokRow.effective,
      lastActivityAt: tokRow.lastTs,
      commitsLast7d,
      planFiles: planFiles(p.cwd),
    };
  });
}
