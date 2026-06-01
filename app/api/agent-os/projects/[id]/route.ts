import { NextRequest, NextResponse } from "next/server";
import {
  deleteProject,
  getProject,
  saveProject,
} from "@/lib/agent-os/projects";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ project: p });
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
  const result = saveProject(
    body as Parameters<typeof saveProject>[0]
  );
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ project: result.project });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ok = deleteProject(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
