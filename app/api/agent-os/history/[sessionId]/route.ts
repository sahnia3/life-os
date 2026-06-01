import { NextRequest, NextResponse } from "next/server";
import { getHistoryDetail, listHistory } from "@/lib/agent-os/history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await ctx.params;
  // Find the row's jsonlPath
  const list = listHistory({ q: sessionId, limit: 1 });
  const row = list.rows.find((r) => r.sessionId === sessionId);
  if (!row || !row.jsonlPath) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const detail = await getHistoryDetail(sessionId, row.jsonlPath, 80);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}
