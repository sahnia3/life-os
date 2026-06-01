import { NextResponse } from "next/server";
import { listRecentRuns } from "@/lib/agent-os/playbooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ runs: listRecentRuns(20) });
}
