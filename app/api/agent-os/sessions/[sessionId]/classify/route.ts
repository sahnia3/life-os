import { NextRequest, NextResponse } from "next/server";
import { getWatcher } from "@/lib/agent-os/watcher";
import { classifySession } from "@/lib/agent-os/classifier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await ctx.params;
  const watcher = getWatcher();
  const session = watcher.getSnapshot().find((s) => s.sessionId === sessionId);
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const result = await classifySession(sessionId, session.jsonlPath, session.lastEventAt, force);
  return NextResponse.json(result);
}
