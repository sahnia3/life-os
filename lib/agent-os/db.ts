import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "agent_os.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("busy_timeout = 5000");

  migrate(_db);
  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      cwd TEXT,
      ts INTEGER NOT NULL,
      input INTEGER NOT NULL DEFAULT 0,
      output INTEGER NOT NULL DEFAULT 0,
      cache_create INTEGER NOT NULL DEFAULT 0,
      cache_read INTEGER NOT NULL DEFAULT 0,
      model TEXT,
      jsonl_path TEXT,
      jsonl_offset INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_token_events_ts ON token_events (ts);
    CREATE INDEX IF NOT EXISTS idx_token_events_session_ts ON token_events (session_id, ts);

    CREATE TABLE IF NOT EXISTS session_state (
      session_id TEXT PRIMARY KEY,
      pid INTEGER,
      cwd TEXT,
      project_name TEXT,
      started_at INTEGER,
      last_event_at INTEGER,
      last_summary TEXT,
      last_tool TEXT,
      status TEXT,
      jsonl_path TEXT
    );

    CREATE TABLE IF NOT EXISTS jsonl_cursors (
      jsonl_path TEXT PRIMARY KEY,
      byte_offset INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS handoffs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_session_id TEXT NOT NULL,
      to_session_id TEXT,
      cwd TEXT NOT NULL,
      recap_md TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      executed_at INTEGER,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS session_anchors (
      session_id TEXT PRIMARY KEY,
      anchor_text TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_digests (
      session_id TEXT PRIMARY KEY,
      digest_text TEXT NOT NULL,
      goal_alignment TEXT,
      generated_at INTEGER NOT NULL,
      last_event_at INTEGER NOT NULL,
      model TEXT
    );

    CREATE TABLE IF NOT EXISTS hook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      cwd TEXT,
      event_name TEXT NOT NULL,
      matcher TEXT,
      tool_name TEXT,
      message TEXT,
      payload_json TEXT,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hook_events_ts ON hook_events (ts);
    CREATE INDEX IF NOT EXISTS idx_hook_events_session ON hook_events (session_id, ts);
    CREATE INDEX IF NOT EXISTS idx_hook_events_name ON hook_events (event_name, ts);

    CREATE TABLE IF NOT EXISTS file_touches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      cwd TEXT,
      file_path TEXT NOT NULL,
      tool_name TEXT,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_file_touches_path ON file_touches (file_path, ts);
    CREATE INDEX IF NOT EXISTS idx_file_touches_ts ON file_touches (ts);
  `);
}

export interface HookEventRow {
  id: number;
  session_id: string | null;
  cwd: string | null;
  event_name: string;
  matcher: string | null;
  tool_name: string | null;
  message: string | null;
  payload_json: string | null;
  ts: number;
}

export function insertHookEvent(e: {
  sessionId: string | null;
  cwd: string | null;
  eventName: string;
  matcher: string | null;
  toolName: string | null;
  message: string | null;
  payload: unknown;
  ts: number;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO hook_events (session_id, cwd, event_name, matcher, tool_name, message, payload_json, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    e.sessionId,
    e.cwd,
    e.eventName,
    e.matcher,
    e.toolName,
    e.message,
    e.payload ? JSON.stringify(e.payload).slice(0, 20000) : null,
    e.ts
  );
  // Keep table bounded — last 5000 events
  db.prepare(
    `DELETE FROM hook_events WHERE id < (SELECT MAX(id) - 5000 FROM hook_events)`
  ).run();
}

export function recentHookEvents(limit = 100): HookEventRow[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM hook_events ORDER BY ts DESC LIMIT ?`)
    .all(limit) as HookEventRow[];
}

export function insertFileTouch(e: {
  sessionId: string;
  cwd: string | null;
  filePath: string;
  toolName: string | null;
  ts: number;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO file_touches (session_id, cwd, file_path, tool_name, ts) VALUES (?, ?, ?, ?, ?)`
  ).run(e.sessionId, e.cwd, e.filePath, e.toolName, e.ts);
  db.prepare(
    `DELETE FROM file_touches WHERE id < (SELECT MAX(id) - 4000 FROM file_touches)`
  ).run();
}

export interface FileCollision {
  filePath: string;
  sessions: Array<{ sessionId: string; cwd: string | null; lastTs: number; toolName: string | null }>;
}

export function detectFileCollisions(windowMs = 30 * 60 * 1000): FileCollision[] {
  const db = getDb();
  const since = Date.now() - windowMs;
  const rows = db
    .prepare(
      `SELECT file_path, session_id, cwd, tool_name, MAX(ts) as last_ts
       FROM file_touches WHERE ts >= ?
       GROUP BY file_path, session_id`
    )
    .all(since) as Array<{
    file_path: string;
    session_id: string;
    cwd: string | null;
    tool_name: string | null;
    last_ts: number;
  }>;
  const byFile = new Map<string, FileCollision>();
  for (const r of rows) {
    if (!byFile.has(r.file_path))
      byFile.set(r.file_path, { filePath: r.file_path, sessions: [] });
    byFile.get(r.file_path)!.sessions.push({
      sessionId: r.session_id,
      cwd: r.cwd,
      lastTs: r.last_ts,
      toolName: r.tool_name,
    });
  }
  return Array.from(byFile.values())
    .filter((c) => c.sessions.length > 1)
    .sort(
      (a, b) =>
        Math.max(...b.sessions.map((s) => s.lastTs)) -
        Math.max(...a.sessions.map((s) => s.lastTs))
    );
}

export function getAnchor(sessionId: string): { text: string; updatedAt: number } | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT anchor_text, updated_at FROM session_anchors WHERE session_id = ?`)
    .get(sessionId) as { anchor_text: string; updated_at: number } | undefined;
  return row ? { text: row.anchor_text, updatedAt: row.updated_at } : null;
}

export function setAnchor(sessionId: string, text: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO session_anchors (session_id, anchor_text, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT (session_id) DO UPDATE SET anchor_text = excluded.anchor_text, updated_at = excluded.updated_at`
  ).run(sessionId, text, Date.now());
}

export function deleteAnchor(sessionId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM session_anchors WHERE session_id = ?`).run(sessionId);
}

export function getAllAnchors(): Map<string, { text: string; updatedAt: number }> {
  const db = getDb();
  const rows = db
    .prepare(`SELECT session_id, anchor_text, updated_at FROM session_anchors`)
    .all() as Array<{ session_id: string; anchor_text: string; updated_at: number }>;
  const map = new Map<string, { text: string; updatedAt: number }>();
  for (const r of rows) map.set(r.session_id, { text: r.anchor_text, updatedAt: r.updated_at });
  return map;
}

export interface DigestRow {
  digestText: string;
  goalAlignment: string | null;
  generatedAt: number;
  lastEventAt: number;
  model: string | null;
}

export function getDigest(sessionId: string): DigestRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT digest_text, goal_alignment, generated_at, last_event_at, model
       FROM session_digests WHERE session_id = ?`
    )
    .get(sessionId) as
    | {
        digest_text: string;
        goal_alignment: string | null;
        generated_at: number;
        last_event_at: number;
        model: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    digestText: row.digest_text,
    goalAlignment: row.goal_alignment,
    generatedAt: row.generated_at,
    lastEventAt: row.last_event_at,
    model: row.model,
  };
}

export function setDigest(
  sessionId: string,
  digestText: string,
  lastEventAt: number,
  goalAlignment: string | null,
  model: string | null
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO session_digests (session_id, digest_text, goal_alignment, generated_at, last_event_at, model)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id) DO UPDATE SET
       digest_text = excluded.digest_text,
       goal_alignment = excluded.goal_alignment,
       generated_at = excluded.generated_at,
       last_event_at = excluded.last_event_at,
       model = excluded.model`
  ).run(sessionId, digestText, goalAlignment, Date.now(), lastEventAt, model);
}

export function getAllDigests(): Map<string, DigestRow> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT session_id, digest_text, goal_alignment, generated_at, last_event_at, model
       FROM session_digests`
    )
    .all() as Array<{
    session_id: string;
    digest_text: string;
    goal_alignment: string | null;
    generated_at: number;
    last_event_at: number;
    model: string | null;
  }>;
  const map = new Map<string, DigestRow>();
  for (const r of rows) {
    map.set(r.session_id, {
      digestText: r.digest_text,
      goalAlignment: r.goal_alignment,
      generatedAt: r.generated_at,
      lastEventAt: r.last_event_at,
      model: r.model,
    });
  }
  return map;
}

export interface TokenEventRow {
  session_id: string;
  cwd: string | null;
  ts: number;
  input: number;
  output: number;
  cache_create: number;
  cache_read: number;
  model: string | null;
  jsonl_path: string;
  jsonl_offset: number;
}

export function insertTokenEvent(row: TokenEventRow): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO token_events (session_id, cwd, ts, input, output, cache_create, cache_read, model, jsonl_path, jsonl_offset)
     VALUES (@session_id, @cwd, @ts, @input, @output, @cache_create, @cache_read, @model, @jsonl_path, @jsonl_offset)`
  ).run(row);
}

export function getCursor(jsonlPath: string): number {
  const db = getDb();
  const row = db
    .prepare(`SELECT byte_offset FROM jsonl_cursors WHERE jsonl_path = ?`)
    .get(jsonlPath) as { byte_offset: number } | undefined;
  return row?.byte_offset ?? 0;
}

export function setCursor(jsonlPath: string, byteOffset: number): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO jsonl_cursors (jsonl_path, byte_offset, last_seen_at)
     VALUES (?, ?, ?)
     ON CONFLICT (jsonl_path) DO UPDATE SET byte_offset = excluded.byte_offset, last_seen_at = excluded.last_seen_at`
  ).run(jsonlPath, byteOffset, Date.now());
}

export interface TokenRollupQueryRow {
  session_id: string;
  cwd: string | null;
  input: number;
  output: number;
  cache_create: number;
  cache_read: number;
}

function findWindowStart(db: Database.Database, windowMs: number): number {
  // The 5h rate-limit window starts at the first event after a gap of >= windowMs.
  // Strategy: scan recent events backwards, find the first pair where
  // (this.ts - prev.ts) >= windowMs. The event AFTER that gap is the window start.
  // If no such gap in the trailing day, use the oldest event in the trailing day.
  const lookbackMs = 24 * 60 * 60 * 1000;
  const since = Date.now() - lookbackMs;
  const rows = db
    .prepare(
      `SELECT ts FROM token_events WHERE ts >= ? ORDER BY ts ASC`
    )
    .all(since) as Array<{ ts: number }>;

  if (rows.length === 0) {
    return Date.now() - windowMs;
  }

  // Walk from newest backwards looking for a gap
  let windowStart = rows[0].ts;
  for (let i = rows.length - 1; i > 0; i--) {
    if (rows[i].ts - rows[i - 1].ts >= windowMs) {
      windowStart = rows[i].ts;
      break;
    }
  }
  return windowStart;
}

export function rollupTokens(windowMs: number): {
  totals: TokenRollupQueryRow & { earliestTs: number | null; windowStart: number };
  bySession: TokenRollupQueryRow[];
  buckets: Array<{ tsStart: number; effectiveTotal: number }>;
} {
  const db = getDb();
  const windowStart = findWindowStart(db, windowMs);
  const since = windowStart;

  const totalsRow = db
    .prepare(
      `SELECT
        COALESCE(SUM(input), 0) AS input,
        COALESCE(SUM(output), 0) AS output,
        COALESCE(SUM(cache_create), 0) AS cache_create,
        COALESCE(SUM(cache_read), 0) AS cache_read,
        MIN(ts) AS earliestTs
       FROM token_events WHERE ts >= ?`
    )
    .get(since) as {
    input: number;
    output: number;
    cache_create: number;
    cache_read: number;
    earliestTs: number | null;
  };

  const bySession = db
    .prepare(
      `SELECT session_id,
        (SELECT cwd FROM token_events t2 WHERE t2.session_id = t.session_id ORDER BY ts DESC LIMIT 1) AS cwd,
        SUM(input) AS input,
        SUM(output) AS output,
        SUM(cache_create) AS cache_create,
        SUM(cache_read) AS cache_read
       FROM token_events t WHERE ts >= ?
       GROUP BY session_id ORDER BY SUM(input + output) DESC`
    )
    .all(since) as TokenRollupQueryRow[];

  const bucketMs = 5 * 60 * 1000;
  const buckets = db
    .prepare(
      `SELECT (ts / ?) * ? AS tsStart,
        SUM(input + output + cache_create) AS effectiveTotal
       FROM token_events WHERE ts >= ?
       GROUP BY tsStart ORDER BY tsStart ASC`
    )
    .all(bucketMs, bucketMs, since) as Array<{
    tsStart: number;
    effectiveTotal: number;
  }>;

  return {
    totals: {
      session_id: "all",
      cwd: null,
      ...totalsRow,
      windowStart,
    },
    bySession,
    buckets,
  };
}

export function getHistoricalDailyTotals(days: number): Array<{
  day: string;
  session_id: string;
  cwd: string | null;
  effective_total: number;
}> {
  const db = getDb();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return db
    .prepare(
      `SELECT
        date(ts / 1000, 'unixepoch', 'localtime') AS day,
        session_id,
        (SELECT cwd FROM token_events t2 WHERE t2.session_id = t.session_id ORDER BY ts DESC LIMIT 1) AS cwd,
        SUM(input + output + cache_create) AS effective_total
       FROM token_events t WHERE ts >= ?
       GROUP BY day, session_id ORDER BY day ASC, effective_total DESC`
    )
    .all(since) as Array<{
    day: string;
    session_id: string;
    cwd: string | null;
    effective_total: number;
  }>;
}

export function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

export function getClaudeSessionsDir(): string {
  return path.join(os.homedir(), ".claude", "sessions");
}
