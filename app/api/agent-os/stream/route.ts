import { NextRequest } from "next/server";
import { getWatcher } from "@/lib/agent-os/watcher";
import { getBus } from "@/lib/agent-os/event-bus";
import type { StreamEvent } from "@/lib/agent-os/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const watcher = getWatcher();

  const stream = new ReadableStream({
    start(controller) {
      const send = (evt: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        } catch {
          // controller closed
        }
      };

      // Initial snapshot
      send({
        type: "snapshot",
        sessions: watcher.getSnapshot(),
        serverTime: Date.now(),
      });

      const unsubscribe = getBus().subscribe(send);

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
