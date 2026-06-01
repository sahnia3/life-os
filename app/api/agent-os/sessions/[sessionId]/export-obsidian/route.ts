import { NextRequest, NextResponse } from "next/server";
import { getWatcher } from "@/lib/agent-os/watcher";
import { exportSessionToObsidian } from "@/lib/agent-os/obsidian-export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await ctx.params;
  const watcher = getWatcher();
  const session = watcher.getSnapshot().find((s) => s.sessionId === sessionId);
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = exportSessionToObsidian(session);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, filepath: result.filepath });
}
