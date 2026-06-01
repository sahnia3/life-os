import { NextResponse } from "next/server";
import { detectFileCollisions } from "@/lib/agent-os/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    collisions: detectFileCollisions(30 * 60 * 1000),
    serverTime: Date.now(),
  });
}
