import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { getWatcher } from "@/lib/agent-os/watcher";
import { generateRecap } from "@/lib/agent-os/handoff-recap";
import { getDb } from "@/lib/agent-os/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HANDOFF_DIR = path.join(os.homedir(), ".claude", "agent-os", "handoffs");

export async function POST() {
  const watcher = getWatcher();
  const sessions = watcher
    .getSnapshot()
    .filter((s) => s.status !== "stale" && s.cwd);

  if (sessions.length === 0) {
    return NextResponse.json({ ok: true, count: 0, results: [] });
  }

  if (!fs.existsSync(HANDOFF_DIR)) fs.mkdirSync(HANDOFF_DIR, { recursive: true });

  const results: Array<{
    sessionId: string;
    projectName: string;
    ok: boolean;
    filepath?: string;
    error?: string;
  }> = [];

  for (const s of sessions) {
    try {
      const recap = await generateRecap(s.sessionId, s.jsonlPath, s.cwd);
      const filepath = path.join(HANDOFF_DIR, `pending-${s.sessionId}.md`);
      const content = `---
cwd: ${s.cwd}
sessionId: ${s.sessionId}
projectName: ${s.projectName}
createdAt: ${Date.now()}
---

${recap}`;
      fs.writeFileSync(filepath, content, "utf8");

      const db = getDb();
      db.prepare(
        `INSERT INTO handoffs (from_session_id, cwd, recap_md, created_at, status)
         VALUES (?, ?, ?, ?, 'pending')`
      ).run(s.sessionId, s.cwd, content, Date.now());

      results.push({
        sessionId: s.sessionId,
        projectName: s.projectName,
        ok: true,
        filepath,
      });
    } catch (e) {
      results.push({
        sessionId: s.sessionId,
        projectName: s.projectName,
        ok: false,
        error: e instanceof Error ? e.message : "recap failed",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    count: results.length,
    results,
  });
}
