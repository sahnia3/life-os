import { NextRequest, NextResponse } from "next/server";
import {
  getProjectsWithStats,
  saveProject,
} from "@/lib/agent-os/projects";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ projects: getProjectsWithStats() });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const result = saveProject(
    body as Parameters<typeof saveProject>[0]
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ project: result.project });
}
