import { NextRequest, NextResponse } from "next/server";
import { listPlaybooks, savePlaybook } from "@/lib/agent-os/playbooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ playbooks: listPlaybooks() });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const result = savePlaybook(body as Partial<Parameters<typeof savePlaybook>[0]>);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ playbook: result.pb });
}
