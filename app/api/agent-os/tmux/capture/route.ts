import { NextRequest, NextResponse } from "next/server";
import { capturePane } from "@/lib/agent-os/tmux";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("target");
  const lines = Math.max(
    10,
    Math.min(2000, parseInt(req.nextUrl.searchParams.get("lines") ?? "200", 10))
  );
  if (!target) return NextResponse.json({ error: "missing target" }, { status: 400 });
  try {
    const content = await capturePane(target, lines);
    return NextResponse.json({ target, content, ts: Date.now() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "capture failed" },
      { status: 500 }
    );
  }
}
