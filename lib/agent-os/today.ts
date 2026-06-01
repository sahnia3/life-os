import fs from "fs";
import readline from "readline";
import { getDb } from "./db";
import { parseJsonlLine } from "./jsonl-parser";
import { projectNameForCwd } from "./sessions";
import type { ParsedJsonlLine } from "./types";

export interface ProjectTodayRow {
  projectName: string;
  cwd: string | null;
  sessions: number;
  effective: number;
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
  events: number;
  firstActivityAt: number;
  lastActivityAt: number;
  topTools: Array<{ name: string; count: number }>;
  topFiles: Array<{ path: string; toolName: string; count: number }>;
  lastUserText: string | null;
  lastAssistantText: string | null;
  anchors: string[];
  digests: string[];
  narrative: string;
}

export interface TodayResponse {
  date: string;
  startMs: number;
  endMs: number;
  totals: {
    sessions: number;
    effective: number;
    cacheRead: number;
    events: number;
    projects: number;
  };
  projects: ProjectTodayRow[];
  heatmap: Array<{ day: string; effective: number; events: number }>;
}

function startOfDayMs(now = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isMeaningful(s: string): boolean {
  if (!s) return false;
  const t = s.trim();
  return t !== "(user message)" && t !== "(assistant)" && t.length > 3;
}

function shortNarrative(row: Omit<ProjectTodayRow, "narrative">): string {
  const tools = row.topTools.slice(0, 3).map((t) => `${t.name}×${t.count}`).join(", ");
  const filesNum = row.topFiles.length;
  const anchorPart =
    row.anchors[0] ? ` toward: ${row.anchors[0].slice(0, 60)}.` : "";
  const lastAsk = row.lastUserText
    ? ` Last ask: ${row.lastUserText.slice(0, 80)}.`
    : "";
  const filesPart =
    filesNum > 0
      ? ` Touched ${filesNum} file${filesNum === 1 ? "" : "s"}${row.topFiles[0] ? ` (${row.topFiles[0].path.split("/").slice(-1)[0]}…)` : ""}.`
      : "";
  const toolPart = tools ? ` Top tools: ${tools}.` : "";
  return `${row.sessions} session${row.sessions === 1 ? "" : "s"} today.${anchorPart}${lastAsk}${filesPart}${toolPart}`.trim();
}

async function tailRecent(
  jsonlPath: string,
  sinceMs: number,
  maxEvents = 200
): Promise<ParsedJsonlLine[]> {
  if (!jsonlPath || !fs.existsSync(jsonlPath)) return [];
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(jsonlPath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream });
    const buf: ParsedJsonlLine[] = [];
    rl.on("line", (line) => {
      const p = parseJsonlLine(line);
      if (!p) return;
      if (p.ts < sinceMs) return;
      buf.push(p);
      if (buf.length > maxEvents) buf.shift();
    });
    rl.on("close", () => resolve(buf));
    rl.on("error", reject);
  });
}

export async function getTodayDigest(): Promise<TodayResponse> {
  const db = getDb();
  const start = startOfDayMs();
  const end = start + 86_400_000;
  const dateStr = new Date(start).toLocaleDateString();

  // Sessions active today
  const sessionsToday = db
    .prepare(
      `SELECT
        session_id,
        (SELECT cwd FROM token_events t2 WHERE t2.session_id = t.session_id AND t2.cwd IS NOT NULL ORDER BY ts DESC LIMIT 1) AS cwd,
        (SELECT jsonl_path FROM token_events t2 WHERE t2.session_id = t.session_id ORDER BY ts DESC LIMIT 1) AS jsonl_path,
        MIN(ts) AS firstTs,
        MAX(ts) AS lastTs,
        COUNT(*) AS events,
        COALESCE(SUM(input), 0) AS input,
        COALESCE(SUM(output), 0) AS output,
        COALESCE(SUM(cache_create), 0) AS cacheCreate,
        COALESCE(SUM(cache_read), 0) AS cacheRead
       FROM token_events t WHERE ts >= ? AND ts < ?
       GROUP BY session_id`
    )
    .all(start, end) as Array<{
    session_id: string;
    cwd: string | null;
    jsonl_path: string | null;
    firstTs: number;
    lastTs: number;
    events: number;
    input: number;
    output: number;
    cacheCreate: number;
    cacheRead: number;
  }>;

  // Anchors + digests
  const anchorMap = new Map<string, string>(
    (db.prepare(`SELECT session_id, anchor_text FROM session_anchors`).all() as Array<{
      session_id: string;
      anchor_text: string;
    }>).map((a) => [a.session_id, a.anchor_text])
  );
  const digestMap = new Map<string, string>(
    (db.prepare(`SELECT session_id, digest_text FROM session_digests`).all() as Array<{
      session_id: string;
      digest_text: string;
    }>).map((d) => [d.session_id, d.digest_text])
  );

  // Group by project
  const byProject = new Map<
    string,
    {
      cwd: string | null;
      sessions: number;
      sessionIds: string[];
      input: number;
      output: number;
      cacheCreate: number;
      cacheRead: number;
      events: number;
      firstActivityAt: number;
      lastActivityAt: number;
      jsonlPaths: Set<string>;
    }
  >();

  for (const s of sessionsToday) {
    const proj = s.cwd ? projectNameForCwd(s.cwd) : "(unknown)";
    let entry = byProject.get(proj);
    if (!entry) {
      entry = {
        cwd: s.cwd,
        sessions: 0,
        sessionIds: [],
        input: 0,
        output: 0,
        cacheCreate: 0,
        cacheRead: 0,
        events: 0,
        firstActivityAt: s.firstTs,
        lastActivityAt: s.lastTs,
        jsonlPaths: new Set(),
      };
      byProject.set(proj, entry);
    }
    entry.sessions++;
    entry.sessionIds.push(s.session_id);
    entry.input += s.input;
    entry.output += s.output;
    entry.cacheCreate += s.cacheCreate;
    entry.cacheRead += s.cacheRead;
    entry.events += s.events;
    entry.firstActivityAt = Math.min(entry.firstActivityAt, s.firstTs);
    entry.lastActivityAt = Math.max(entry.lastActivityAt, s.lastTs);
    if (s.jsonl_path) entry.jsonlPaths.add(s.jsonl_path);
  }

  // For each project, scan its JSONLs for today's tool calls + last messages
  const projects: ProjectTodayRow[] = [];
  for (const [projectName, info] of byProject.entries()) {
    const tools = new Map<string, number>();
    const files = new Map<string, { path: string; toolName: string; count: number }>();
    let lastUserText: string | null = null;
    let lastAssistantText: string | null = null;

    for (const jsonlPath of info.jsonlPaths) {
      try {
        const events = await tailRecent(jsonlPath, start, 200);
        for (const e of events) {
          if (e.toolName) {
            tools.set(e.toolName, (tools.get(e.toolName) ?? 0) + 1);
            if (
              (e.toolName === "Edit" || e.toolName === "Write" || e.toolName === "Read") &&
              e.summary
            ) {
              const m = /(?:Edit|Write|Read):\s+(.+)/.exec(e.summary);
              if (m) {
                const key = `${e.toolName}:${m[1].trim()}`;
                const existing = files.get(key);
                if (existing) existing.count++;
                else
                  files.set(key, {
                    path: m[1].trim(),
                    toolName: e.toolName,
                    count: 1,
                  });
              }
            }
          }
          if (e.kind === "user" && isMeaningful(e.summary)) lastUserText = e.summary;
          else if (e.kind === "assistant" && isMeaningful(e.summary))
            lastAssistantText = e.summary;
        }
      } catch {
        /* skip */
      }
    }

    const anchors = info.sessionIds
      .map((sid) => anchorMap.get(sid))
      .filter((a): a is string => !!a);
    const digests = info.sessionIds
      .map((sid) => digestMap.get(sid))
      .filter((a): a is string => !!a);

    const partial: Omit<ProjectTodayRow, "narrative"> = {
      projectName,
      cwd: info.cwd,
      sessions: info.sessions,
      effective: info.input + info.output + info.cacheCreate,
      input: info.input,
      output: info.output,
      cacheCreate: info.cacheCreate,
      cacheRead: info.cacheRead,
      events: info.events,
      firstActivityAt: info.firstActivityAt,
      lastActivityAt: info.lastActivityAt,
      topTools: Array.from(tools.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topFiles: Array.from(files.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      lastUserText,
      lastAssistantText,
      anchors,
      digests,
    };

    projects.push({
      ...partial,
      narrative: shortNarrative(partial),
    });
  }

  projects.sort((a, b) => b.effective - a.effective);

  // 14-day heatmap
  const heatmapStart = start - 13 * 86_400_000;
  const heat = db
    .prepare(
      `SELECT
        date(ts / 1000, 'unixepoch', 'localtime') AS day,
        SUM(input + output + cache_create) AS effective,
        COUNT(*) AS events
       FROM token_events WHERE ts >= ? GROUP BY day ORDER BY day ASC`
    )
    .all(heatmapStart) as Array<{ day: string; effective: number; events: number }>;
  // Fill missing days
  const heatMap = new Map(heat.map((h) => [h.day, { effective: h.effective, events: h.events }]));
  const heatmap: TodayResponse["heatmap"] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(heatmapStart + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    // Local-date version too — try matching either format
    const localKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const v = heatMap.get(key) ?? heatMap.get(localKey);
    heatmap.push({ day: localKey, effective: v?.effective ?? 0, events: v?.events ?? 0 });
  }

  const totals = projects.reduce(
    (acc, p) => ({
      sessions: acc.sessions + p.sessions,
      effective: acc.effective + p.effective,
      cacheRead: acc.cacheRead + p.cacheRead,
      events: acc.events + p.events,
      projects: acc.projects + 1,
    }),
    { sessions: 0, effective: 0, cacheRead: 0, events: 0, projects: 0 }
  );

  return {
    date: dateStr,
    startMs: start,
    endMs: end,
    totals,
    projects,
    heatmap,
  };
}
