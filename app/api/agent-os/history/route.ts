import { NextRequest, NextResponse } from "next/server";
import { listHistory } from "@/lib/agent-os/history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = sp.get("limit") ? parseInt(sp.get("limit")!, 10) : 100;
  const offset = sp.get("offset") ? parseInt(sp.get("offset")!, 10) : 0;
  const project = sp.get("project") || undefined;
  const role = sp.get("role") || undefined;
  const q = sp.get("q") || undefined;
  const hasAnchor = sp.get("hasAnchor") === "1";
  const sinceStr = sp.get("since");
  const untilStr = sp.get("until");
  const since = sinceStr ? parseInt(sinceStr, 10) : undefined;
  const until = untilStr ? parseInt(untilStr, 10) : undefined;

  const result = listHistory({
    limit,
    offset,
    project,
    role,
    q,
    hasAnchor,
    since,
    until,
  });
  return NextResponse.json(result);
}
