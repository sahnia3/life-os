import fs from "fs";
import path from "path";
import readline from "readline";
import os from "os";
import { getDb } from "./db";
import { parseJsonlLine } from "./jsonl-parser";
import { projectNameForCwd } from "./sessions";
import type { ParsedJsonlLine } from "./types";

export interface HistoryRow {
  sessionId: string;
  cwd: string | null;
  projectName: string;
  startedAt: number;
  lastEventAt: number;
  durationMs: number;
  eventCount: number;
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
  effectiveTotal: number;
  model: string | null;
  anchor: string | null;
  digest: string | null;
  role: string | null;
  roleFocus: string | null;
  jsonlPath: string | null;
}

interface ListOpts {
  limit?: number;
  offset?: number;
  project?: string;
  role?: string;
  since?: number; // ms epoch
  until?: number;
  q?: string;
  hasAnchor?: boolean;
}

export function listHistory(opts: ListOpts = {}): { total: number; rows: HistoryRow[]; projects: string[] } {
  const db = getDb();
  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));
  const offset = Math.max(0, opts.offset ?? 0);

  // Aggregate from token_events (canonical source: any session that ever sent tokens)
  // join anchors / digests / classifications / latest cwd
  const baseRows = db
    .prepare(
      `SELECT
        t.session_id,
        (SELECT cwd FROM token_events t2 WHERE t2.session_id = t.session_id AND t2.cwd IS NOT NULL ORDER BY ts DESC LIMIT 1) AS cwd,
        (SELECT model FROM token_events t2 WHERE t2.session_id = t.session_id AND t2.model IS NOT NULL ORDER BY ts DESC LIMIT 1) AS model,
        (SELECT jsonl_path FROM token_events t2 WHERE t2.session_id = t.session_id ORDER BY ts DESC LIMIT 1) AS jsonl_path,
        MIN(ts) AS startedAt,
        MAX(ts) AS lastEventAt,
        COUNT(*) AS eventCount,
        COALESCE(SUM(input), 0) AS input,
        COALESCE(SUM(output), 0) AS output,
        COALESCE(SUM(cache_create), 0) AS cacheCreate,
        COALESCE(SUM(cache_read), 0) AS cacheRead
       FROM token_events t
       GROUP BY t.session_id`
    )
    .all() as Array<{
    session_id: string;
    cwd: string | null;
    model: string | null;
    jsonl_path: string | null;
    startedAt: number;
    lastEventAt: number;
    eventCount: number;
    input: number;
    output: number;
    cacheCreate: number;
    cacheRead: number;
  }>;

  const anchors = db
    .prepare(`SELECT session_id, anchor_text FROM session_anchors`)
    .all() as Array<{ session_id: string; anchor_text: string }>;
  const anchorMap = new Map(anchors.map((a) => [a.session_id, a.anchor_text]));

  const digests = db
    .prepare(`SELECT session_id, digest_text FROM session_digests`)
    .all() as Array<{ session_id: string; digest_text: string }>;
  const digestMap = new Map(digests.map((d) => [d.session_id, d.digest_text]));

  let classMap = new Map<string, { role: string; focus: string }>();
  try {
    const classifications = db
      .prepare(
        `SELECT session_id, role, focus FROM session_classifications`
      )
      .all() as Array<{ session_id: string; role: string; focus: string }>;
    classMap = new Map(
      classifications.map((c) => [c.session_id, { role: c.role, focus: c.focus }])
    );
  } catch {
    /* table doesn't exist yet */
  }

  let rows: HistoryRow[] = baseRows.map((r) => {
    const projectName = r.cwd ? projectNameForCwd(r.cwd) : "(unknown)";
    const effective = r.input + r.output + r.cacheCreate;
    const cls = classMap.get(r.session_id);
    return {
      sessionId: r.session_id,
      cwd: r.cwd,
      projectName,
      startedAt: r.startedAt,
      lastEventAt: r.lastEventAt,
      durationMs: r.lastEventAt - r.startedAt,
      eventCount: r.eventCount,
      input: r.input,
      output: r.output,
      cacheCreate: r.cacheCreate,
      cacheRead: r.cacheRead,
      effectiveTotal: effective,
      model: r.model,
      anchor: anchorMap.get(r.session_id) ?? null,
      digest: digestMap.get(r.session_id) ?? null,
      role: cls?.role ?? null,
      roleFocus: cls?.focus ?? null,
      jsonlPath: r.jsonl_path,
    };
  });

  // Filters
  if (opts.project) {
    rows = rows.filter((r) => r.projectName === opts.project);
  }
  if (opts.role) {
    rows = rows.filter((r) => r.role === opts.role);
  }
  if (opts.since != null) {
    rows = rows.filter((r) => r.lastEventAt >= opts.since!);
  }
  if (opts.until != null) {
    rows = rows.filter((r) => r.lastEventAt <= opts.until!);
  }
  if (opts.hasAnchor) {
    rows = rows.filter((r) => !!r.anchor);
  }
  if (opts.q) {
    const q = opts.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.sessionId.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q) ||
        (r.cwd ?? "").toLowerCase().includes(q) ||
        (r.anchor ?? "").toLowerCase().includes(q) ||
        (r.digest ?? "").toLowerCase().includes(q) ||
        (r.roleFocus ?? "").toLowerCase().includes(q)
    );
  }

  rows.sort((a, b) => b.lastEventAt - a.lastEventAt);
  const total = rows.length;
  const paged = rows.slice(offset, offset + limit);

  const projects = Array.from(
    new Set(rows.map((r) => r.projectName).filter((p) => p !== "(unknown)"))
  ).sort();

  return { total, rows: paged, projects };
}

export interface HistoryDetail {
  meta: HistoryRow;
  files: Array<{ path: string; toolName: string; count: number }>;
  tools: Array<{ name: string; count: number }>;
  events: Array<{
    ts: number;
    kind: string;
    summary: string;
    toolName: string | null;
  }>;
  totalLinesScanned: number;
}

export async function getHistoryDetail(
  sessionId: string,
  jsonlPath: string,
  maxEvents = 80
): Promise<HistoryDetail | null> {
  const db = getDb();
  const baseList = listHistory({ limit: 1, offset: 0, q: sessionId });
  const meta = baseList.rows.find((r) => r.sessionId === sessionId);
  if (!meta) return null;

  const tools = new Map<string, number>();
  const fileHits = new Map<string, { path: string; toolName: string; count: number }>();
  const tail: ParsedJsonlLine[] = [];
  let totalLines = 0;

  if (jsonlPath && fs.existsSync(jsonlPath)) {
    await new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(jsonlPath, { encoding: "utf8" });
      const rl = readline.createInterface({ input: stream });
      rl.on("line", (line) => {
        totalLines++;
        const p = parseJsonlLine(line);
        if (!p) return;
        if (p.toolName) {
          tools.set(p.toolName, (tools.get(p.toolName) ?? 0) + 1);
          if (
            (p.toolName === "Edit" || p.toolName === "Write" || p.toolName === "Read") &&
            p.summary
          ) {
            const m = /(?:Edit|Write|Read):\s+(.+)/.exec(p.summary);
            if (m) {
              const key = `${p.toolName}:${m[1].trim()}`;
              const existing = fileHits.get(key);
              if (existing) existing.count++;
              else fileHits.set(key, { path: m[1].trim(), toolName: p.toolName, count: 1 });
            }
          }
        }
        if (p.kind === "user" || p.kind === "assistant" || p.kind === "tool_use") {
          tail.push(p);
          if (tail.length > maxEvents) tail.shift();
        }
      });
      rl.on("close", () => resolve());
      rl.on("error", reject);
    });
  }

  const _ = db; // suppress unused
  void _;

  return {
    meta,
    files: Array.from(fileHits.values()).sort((a, b) => b.count - a.count).slice(0, 30),
    tools: Array.from(tools.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    events: tail.map((e) => ({
      ts: e.ts,
      kind: e.kind,
      summary: e.summary,
      toolName: e.toolName,
    })),
    totalLinesScanned: totalLines,
  };
}

export function getClaudeProjectsRoot(): string {
  return path.join(os.homedir(), ".claude", "projects");
}
