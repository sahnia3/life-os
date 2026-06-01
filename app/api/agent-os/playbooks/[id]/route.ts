import { NextRequest, NextResponse } from "next/server";
import {
  deletePlaybook,
  getPlaybook,
  savePlaybook,
} from "@/lib/agent-os/playbooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const pb = getPlaybook(id);
  if (!pb) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ playbook: pb });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  body.id = id;
  const result = savePlaybook(body as Partial<Parameters<typeof savePlaybook>[0]>);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ playbook: result.pb });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ok = deletePlaybook(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
