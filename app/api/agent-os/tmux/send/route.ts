import { NextRequest, NextResponse } from "next/server";
import { sendKeys } from "@/lib/agent-os/tmux";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { target?: string; text?: string; withEnter?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.target || typeof body.text !== "string") {
    return NextResponse.json(
      { error: "target and text required" },
      { status: 400 }
    );
  }
  try {
    await sendKeys(body.target, body.text, body.withEnter ?? true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "send failed" },
      { status: 500 }
    );
  }
}
