import { NextResponse } from "next/server";
import { getTodayDigest } from "@/lib/agent-os/today";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const data = await getTodayDigest();
  return NextResponse.json(data);
}
