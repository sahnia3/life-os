import { NextResponse } from "next/server";
import { readLatestRateLimit } from "@/lib/agent-os/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const snap = readLatestRateLimit();
  return NextResponse.json({ snapshot: snap });
}
