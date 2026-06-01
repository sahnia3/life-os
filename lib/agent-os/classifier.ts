import fs from "fs";
import readline from "readline";
import { parseJsonlLine } from "./jsonl-parser";
import type { ParsedJsonlLine } from "./types";
import { getDb } from "./db";

const TAIL_LINES = 80;
const STALE_AFTER_MS = 5 * 60 * 1000;

export type SessionRole =
  | "builder"
  | "debugger"
  | "researcher"
  | "planner"
  | "reviewer"
  | "operator"
  | "writer"
  | "chatter";

export interface RoleProfile {
  role: SessionRole;
  emoji: string;
  label: string;
  color: string; // tailwind color name fragment
  description: string;
}

export const ROLE_PROFILES: Record<SessionRole, RoleProfile> = {
  builder: {
    role: "builder",
    emoji: "🔨",
    label: "Builder",
    color: "amber",
    description: "Writing and editing code",
  },
  debugger: {
    role: "debugger",
    emoji: "🐛",
    label: "Debugger",
    color: "rose",
    description: "Investigating bugs, reading logs",
  },
  researcher: {
    role: "researcher",
    emoji: "🔍",
    label: "Researcher",
    color: "sky",
    description: "Web research, exploring docs",
  },
  planner: {
    role: "planner",
    emoji: "📋",
    label: "Planner",
    color: "violet",
    description: "Designing, scoping, sequencing work",
  },
  reviewer: {
    role: "reviewer",
    emoji: "🧪",
    label: "Reviewer",
    color: "emerald",
    description: "Reading and critiquing code",
  },
  operator: {
    role: "operator",
    emoji: "🚀",
    label: "Operator",
    color: "orange",
    description: "Running commands, deploying, CI/CD",
  },
  writer: {
    role: "writer",
    emoji: "✍️",
    label: "Writer",
    color: "cyan",
    description: "Docs, content, markdown",
  },
  chatter: {
    role: "chatter",
    emoji: "💬",
    label: "Conversation",
    color: "slate",
    description: "Discussion with few tool calls",
  },
};

async function tail(filepath: string, max: number): Promise<ParsedJsonlLine[]> {
  if (!fs.existsSync(filepath)) return [];
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filepath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream });
    const buf: ParsedJsonlLine[] = [];
    rl.on("line", (line) => {
      const p = parseJsonlLine(line);
      if (!p) return;
      buf.push(p);
      if (buf.length > max) buf.shift();
    });
    rl.on("close", () => resolve(buf));
    rl.on("error", reject);
  });
}

function heuristicRole(events: ParsedJsonlLine[]): { role: SessionRole; focus: string } {
  // Build a tool histogram
  const tools = new Map<string, number>();
  const editLikeFiles: string[] = [];
  let lastUserText = "";
  for (const e of events) {
    if (e.kind === "tool_use" && e.toolName) {
      tools.set(e.toolName, (tools.get(e.toolName) ?? 0) + 1);
      if (e.toolName === "Edit" || e.toolName === "Write") {
        const m = /(?:Edit|Write):\s+(.+)$/.exec(e.summary || "");
        if (m) editLikeFiles.push(m[1]);
      }
    }
    if (e.kind === "user" && e.summary && e.summary !== "(user message)") {
      lastUserText = e.summary;
    }
  }
  const total = Array.from(tools.values()).reduce((a, b) => a + b, 0);
  const get = (k: string) => tools.get(k) ?? 0;

  const edits = get("Edit") + get("Write");
  const reads = get("Read") + get("Glob") + get("Grep");
  const bash = get("Bash");
  const web = get("WebFetch") + get("WebSearch");
  const todo = get("TodoWrite");

  let role: SessionRole = "chatter";

  if (total === 0) {
    role = "chatter";
  } else if (web >= 3 && web >= edits) {
    role = "researcher";
  } else if (todo >= 3 && edits < 3) {
    role = "planner";
  } else if (edits >= 5) {
    // Builder vs Writer based on file types
    const mdShare =
      editLikeFiles.filter((f) => /\.(md|mdx|txt)$/i.test(f)).length /
      Math.max(1, editLikeFiles.length);
    role = mdShare > 0.5 ? "writer" : "builder";
  } else if (bash >= 5 && edits === 0) {
    // Many bash calls but no edits — debugging or operations
    role = "debugger";
  } else if (reads >= 4 && edits <= 1) {
    role = "reviewer";
  } else if (edits >= 1) {
    role = "builder";
  } else if (bash >= 1) {
    role = "operator";
  } else {
    role = "chatter";
  }

  // Build a short focus string from the most recent meaningful user message
  let focus = lastUserText
    ? lastUserText
        .replace(/[#*_`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60)
    : "";
  if (!focus && editLikeFiles.length > 0) {
    const file = editLikeFiles[editLikeFiles.length - 1];
    focus = `Editing ${file}`;
  }
  if (!focus) focus = ROLE_PROFILES[role].description;

  return { role, focus };
}

export interface ClassificationResult {
  role: SessionRole;
  emoji: string;
  label: string;
  color: string;
  focus: string;
  generatedAt: number;
  cached: boolean;
  model: string | null;
}

// Lazy migration: ensure classification table exists
function ensureTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_classifications (
      session_id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      focus TEXT NOT NULL,
      generated_at INTEGER NOT NULL,
      last_event_at INTEGER NOT NULL,
      model TEXT
    );
  `);
}

interface ClassificationRow {
  role: SessionRole;
  focus: string;
  generatedAt: number;
  lastEventAt: number;
  model: string | null;
}

export function getClassification(sessionId: string): ClassificationRow | null {
  ensureTable();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT role, focus, generated_at, last_event_at, model
       FROM session_classifications WHERE session_id = ?`
    )
    .get(sessionId) as
    | { role: string; focus: string; generated_at: number; last_event_at: number; model: string | null }
    | undefined;
  if (!row) return null;
  return {
    role: row.role as SessionRole,
    focus: row.focus,
    generatedAt: row.generated_at,
    lastEventAt: row.last_event_at,
    model: row.model,
  };
}

function setClassification(
  sessionId: string,
  role: SessionRole,
  focus: string,
  lastEventAt: number,
  model: string | null
): void {
  ensureTable();
  const db = getDb();
  db.prepare(
    `INSERT INTO session_classifications (session_id, role, focus, generated_at, last_event_at, model)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id) DO UPDATE SET
       role = excluded.role,
       focus = excluded.focus,
       generated_at = excluded.generated_at,
       last_event_at = excluded.last_event_at,
       model = excluded.model`
  ).run(sessionId, role, focus, Date.now(), lastEventAt, model);
}

export function getAllClassifications(): Map<string, ClassificationRow> {
  ensureTable();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT session_id, role, focus, generated_at, last_event_at, model FROM session_classifications`
    )
    .all() as Array<{
    session_id: string;
    role: string;
    focus: string;
    generated_at: number;
    last_event_at: number;
    model: string | null;
  }>;
  const map = new Map<string, ClassificationRow>();
  for (const r of rows) {
    map.set(r.session_id, {
      role: r.role as SessionRole,
      focus: r.focus,
      generatedAt: r.generated_at,
      lastEventAt: r.last_event_at,
      model: r.model,
    });
  }
  return map;
}

export async function classifySession(
  sessionId: string,
  jsonlPath: string,
  lastEventAt: number,
  forceRefresh = false
): Promise<ClassificationResult> {
  const cached = getClassification(sessionId);
  if (!forceRefresh && cached) {
    const fresh = cached.lastEventAt >= lastEventAt;
    const recent = Date.now() - cached.generatedAt < STALE_AFTER_MS;
    if (fresh && recent) {
      const p = ROLE_PROFILES[cached.role];
      return {
        role: cached.role,
        emoji: p.emoji,
        label: p.label,
        color: p.color,
        focus: cached.focus,
        generatedAt: cached.generatedAt,
        cached: true,
        model: cached.model,
      };
    }
  }

  const events = await tail(jsonlPath, TAIL_LINES);
  const { role: hRole, focus: hFocus } = heuristicRole(events);

  // Optional Haiku enhancement for focus phrasing
  let role = hRole;
  let focus = hFocus;
  let model: string | null = null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && events.length > 0) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });
      const sample = events
        .slice(-30)
        .map((e) => {
          if (e.kind === "user") return `USER: ${e.summary?.slice(0, 150) ?? ""}`;
          if (e.kind === "assistant") return `ASSISTANT: ${e.summary?.slice(0, 150) ?? ""}`;
          if (e.kind === "tool_use") return `TOOL ${e.toolName}: ${e.summary?.slice(0, 80) ?? ""}`;
          return "";
        })
        .filter(Boolean)
        .join("\n");

      const resp = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 80,
        messages: [
          {
            role: "user",
            content: `Classify this Claude Code session's current role and focus.

Pick exactly one ROLE from: builder, debugger, researcher, planner, reviewer, operator, writer, chatter.

Then write a 3-7 word FOCUS describing what it's specifically working on right now (no fluff, like a git commit subject).

Output exactly two lines:
ROLE: <one of the above>
FOCUS: <3-7 words>

Recent activity:
${sample}`,
          },
        ],
      });
      let text = "";
      for (const block of resp.content) if (block.type === "text") text += block.text;
      const rm = /ROLE:\s*(builder|debugger|researcher|planner|reviewer|operator|writer|chatter)/i.exec(text);
      const fm = /FOCUS:\s*(.+)/i.exec(text);
      if (rm) role = rm[1].toLowerCase() as SessionRole;
      if (fm) focus = fm[1].trim().slice(0, 80);
      model = "claude-haiku-4-5";
    } catch {
      // fall through to heuristic
    }
  }

  setClassification(sessionId, role, focus, lastEventAt, model);
  const p = ROLE_PROFILES[role];
  return {
    role,
    emoji: p.emoji,
    label: p.label,
    color: p.color,
    focus,
    generatedAt: Date.now(),
    cached: false,
    model,
  };
}
