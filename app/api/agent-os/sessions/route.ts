import { NextResponse } from "next/server";
import { getWatcher } from "@/lib/agent-os/watcher";
import { rollupTokens } from "@/lib/agent-os/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const watcher = getWatcher();
  const sessions = watcher.getSnapshot();
  const rollup = rollupTokens(5 * 60 * 60 * 1000);

  // Merge rolling-window token totals onto each session
  const bySession = new Map(
    rollup.bySession.map((r) => [r.session_id, r])
  );
  const enriched = sessions.map((s) => {
    const r = bySession.get(s.sessionId);
    return {
      ...s,
      tokensThisWindow: r
        ? {
            input: r.input,
            output: r.output,
            cacheRead: r.cache_read,
            cacheCreate: r.cache_create,
          }
        : s.tokensThisWindow,
    };
  });

  return NextResponse.json({
    sessions: enriched,
    serverTime: Date.now(),
  });
}
