import { NextRequest, NextResponse } from "next/server";
import { getHookState } from "@/lib/agent-os/hooks-state";
import { getWatcher } from "@/lib/agent-os/watcher";
import type { AttentionItem } from "@/lib/agent-os/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Unified attention queue. Authoritative source = HTTP hooks (if installed).
 * Fallback/merge = the JSONL watcher's awaitingInput heuristic, so the
 * "who needs me?" queue works TODAY with zero hook setup.
 */
export async function GET() {
  const store = getHookState();
  const hookItems = store.attentionQueue();
  const hookSessionIds = new Set(hookItems.map((i) => i.sessionId));

  // Fold in watcher-detected waiting sessions (assistant ended with '?',
  // no user reply since) that hooks haven't already flagged.
  const watcher = getWatcher();
  const now = Date.now();
  const fallback: AttentionItem[] = [];
  for (const s of watcher.getSnapshot()) {
    if (
      s.awaitingInput &&
      s.awaitingSince &&
      !hookSessionIds.has(s.sessionId) &&
      s.status !== "stale"
    ) {
      fallback.push({
        sessionId: s.sessionId,
        cwd: s.cwd,
        projectName: s.projectName,
        reason: "idle_prompt",
        message: s.lastSummary || "Waiting for your reply",
        since: s.awaitingSince,
        toolName: s.lastTool,
      });
    }
  }

  // Merge, rank: permission > error > idle(oldest first) > finished
  const order = { permission_prompt: 0, error: 1, idle_prompt: 2, finished: 3 };
  const items = [...hookItems, ...fallback].sort((a, b) => {
    const o = order[a.reason] - order[b.reason];
    if (o !== 0) return o;
    return a.since - b.since;
  });

  return NextResponse.json({
    items,
    sessions: store.list(),
    hooksActive: store.size() > 0,
    serverTime: now,
  });
}

export async function POST(req: NextRequest) {
  let body: { sessionId?: string };
  try {
    body = (await req.json()) as { sessionId?: string };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.sessionId)
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  getHookState().clearAttention(body.sessionId);
  return NextResponse.json({ ok: true });
}
