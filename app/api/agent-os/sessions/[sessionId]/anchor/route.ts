import { NextRequest, NextResponse } from "next/server";
import { deleteAnchor, getAnchor, setAnchor } from "@/lib/agent-os/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await ctx.params;
  const a = getAnchor(sessionId);
  return NextResponse.json({ anchor: a });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await ctx.params;
  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  if (text.length > 400) {
    return NextResponse.json({ error: "text too long (max 400)" }, { status: 400 });
  }
  if (text.length === 0) {
    deleteAnchor(sessionId);
    return NextResponse.json({ anchor: null });
  }
  setAnchor(sessionId, text);
  return NextResponse.json({ anchor: getAnchor(sessionId) });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await ctx.params;
  deleteAnchor(sessionId);
  return NextResponse.json({ ok: true });
}
