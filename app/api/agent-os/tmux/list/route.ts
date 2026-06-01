import { NextResponse } from "next/server";
import { listTmuxSessions, tmuxStatus } from "@/lib/agent-os/tmux";
import { ensureBridge } from "@/lib/agent-os/bridge-supervisor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await tmuxStatus();
  if (!status.installed) {
    return NextResponse.json({ ...status, sessions: [] });
  }
  const sessions = await listTmuxSessions();
  // Lazy-start the PTY bridge so terminal-embed is ready when the user clicks.
  if (sessions.length > 0) {
    void ensureBridge();
  }
  return NextResponse.json({ ...status, sessionCount: sessions.length, sessions });
}
