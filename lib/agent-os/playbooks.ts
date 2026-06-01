import fs from "fs";
import path from "path";
import os from "os";

const PLAYBOOKS_DIR = path.join(os.homedir(), ".claude", "agent-os", "playbooks");
const RUNS_DIR = path.join(os.homedir(), ".claude", "agent-os", "runs");

function ensureDirs(): void {
  if (!fs.existsSync(PLAYBOOKS_DIR))
    fs.mkdirSync(PLAYBOOKS_DIR, { recursive: true });
  if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });
}

export interface PlaybookSession {
  tmuxName: string;
  cwd: string;
  initialPrompt: string;
  // Optional permission mode override (default | acceptEdits | bypassPermissions | plan)
  permissionMode?: string;
  // Optional model alias (sonnet | opus | haiku) or full model name
  model?: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  sessions: PlaybookSession[];
  createdAt: number;
  updatedAt: number;
}

export interface PlaybookRun {
  runId: string;
  playbookId: string;
  startedAt: number;
  completedAt: number | null;
  sessions: Array<{
    tmuxName: string;
    cwd: string;
    ok: boolean;
    error?: string;
    pid?: number;
  }>;
}

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,40}$/;
const TMUX_NAME_RE = /^[A-Za-z0-9_\-]{1,30}$/;

export function validatePlaybook(p: Partial<Playbook>): { ok: true; pb: Playbook } | { ok: false; error: string } {
  if (!p.id || !ID_RE.test(p.id))
    return { ok: false, error: "id must be lowercase alphanumeric/dash/underscore (max 40 chars)" };
  if (!p.name || p.name.trim().length === 0)
    return { ok: false, error: "name required" };
  if (!Array.isArray(p.sessions) || p.sessions.length === 0)
    return { ok: false, error: "at least one session required" };
  for (const [i, s] of p.sessions.entries()) {
    if (!s.tmuxName || !TMUX_NAME_RE.test(s.tmuxName))
      return { ok: false, error: `session ${i + 1}: tmuxName invalid (alphanumeric/dash/underscore, max 30)` };
    if (!s.cwd || !s.cwd.startsWith("/"))
      return { ok: false, error: `session ${i + 1}: cwd must be absolute path` };
    if (!fs.existsSync(s.cwd))
      return { ok: false, error: `session ${i + 1}: cwd does not exist: ${s.cwd}` };
    if (typeof s.initialPrompt !== "string")
      return { ok: false, error: `session ${i + 1}: initialPrompt must be a string` };
    if (s.initialPrompt.length > 8000)
      return { ok: false, error: `session ${i + 1}: initialPrompt too long (max 8000 chars)` };
  }
  const now = Date.now();
  return {
    ok: true,
    pb: {
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      sessions: p.sessions,
      createdAt: p.createdAt ?? now,
      updatedAt: now,
    },
  };
}

export function listPlaybooks(): Playbook[] {
  ensureDirs();
  const out: Playbook[] = [];
  for (const f of fs.readdirSync(PLAYBOOKS_DIR)) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(PLAYBOOKS_DIR, f), "utf8"));
      const v = validatePlaybook(raw);
      if (v.ok) out.push(v.pb);
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function getPlaybook(id: string): Playbook | null {
  ensureDirs();
  if (!ID_RE.test(id)) return null;
  const p = path.join(PLAYBOOKS_DIR, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const v = validatePlaybook(raw);
    return v.ok ? v.pb : null;
  } catch {
    return null;
  }
}

export function savePlaybook(input: Partial<Playbook>): { ok: true; pb: Playbook } | { ok: false; error: string } {
  ensureDirs();
  const v = validatePlaybook(input);
  if (!v.ok) return v;
  const p = path.join(PLAYBOOKS_DIR, `${v.pb.id}.json`);
  fs.writeFileSync(p, JSON.stringify(v.pb, null, 2), "utf8");
  return { ok: true, pb: v.pb };
}

export function deletePlaybook(id: string): boolean {
  ensureDirs();
  if (!ID_RE.test(id)) return false;
  const p = path.join(PLAYBOOKS_DIR, `${id}.json`);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

export function recordRun(run: PlaybookRun): void {
  ensureDirs();
  const p = path.join(RUNS_DIR, `${run.runId}.json`);
  fs.writeFileSync(p, JSON.stringify(run, null, 2), "utf8");
}

export function listRecentRuns(limit = 20): PlaybookRun[] {
  ensureDirs();
  const files = fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({
      f,
      mtime: fs.statSync(path.join(RUNS_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
  const out: PlaybookRun[] = [];
  for (const { f } of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), "utf8"));
      out.push(raw as PlaybookRun);
    } catch {
      /* skip */
    }
  }
  return out;
}
