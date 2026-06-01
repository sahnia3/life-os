import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { getWatcher } from "@/lib/agent-os/watcher";
import { generateRecap } from "@/lib/agent-os/handoff-recap";
import { getDb } from "@/lib/agent-os/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HANDOFF_DIR = path.join(os.homedir(), ".claude", "agent-os", "handoffs");

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await ctx.params;
  const watcher = getWatcher();
  const session = watcher.getSnapshot().find((s) => s.sessionId === sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (!session.cwd) {
    return NextResponse.json({ error: "session has no cwd" }, { status: 400 });
  }

  try {
    const recap = await generateRecap(
      sessionId,
      session.jsonlPath,
      session.cwd
    );

    if (!fs.existsSync(HANDOFF_DIR)) fs.mkdirSync(HANDOFF_DIR, { recursive: true });
    const filename = `pending-${sessionId}.md`;
    const filepath = path.join(HANDOFF_DIR, filename);

    // Frontmatter so wrapper script can match cwd
    const content = `---
cwd: ${session.cwd}
sessionId: ${sessionId}
projectName: ${session.projectName}
createdAt: ${Date.now()}
---

${recap}`;

    fs.writeFileSync(filepath, content, "utf8");

    // Log to DB
    const db = getDb();
    db.prepare(
      `INSERT INTO handoffs (from_session_id, cwd, recap_md, created_at, status)
       VALUES (?, ?, ?, ?, 'pending')`
    ).run(sessionId, session.cwd, content, Date.now());

    return NextResponse.json({
      ok: true,
      filepath,
      cwd: session.cwd,
      bytes: content.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "execute failed" },
      { status: 500 }
    );
  }
}
