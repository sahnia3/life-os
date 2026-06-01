import { NextRequest, NextResponse } from "next/server";
import { getWatcher } from "@/lib/agent-os/watcher";
import { generateRecap } from "@/lib/agent-os/handoff-recap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await ctx.params;
  const watcher = getWatcher();
  const session = watcher.getSnapshot().find((s) => s.sessionId === sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  try {
    const recap = await generateRecap(
      sessionId,
      session.jsonlPath,
      session.cwd
    );
    return NextResponse.json({
      sessionId,
      cwd: session.cwd,
      projectName: session.projectName,
      recap,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "recap failed" },
      { status: 500 }
    );
  }
}
