import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const AGENT_DIR =
  process.env.POLYMARKET_AGENT_DIR ||
  "/Users/adityasahni/Desktop/Claudecode/polymarket-agent";

const PROGRESS_PATH = path.join(AGENT_DIR, "data", "pipeline_progress.json");

// SSE endpoint — streams pipeline stage progress in real time
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  let lastMtime = 0;
  let lastContent = "";
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      try {
        if (fs.existsSync(PROGRESS_PATH)) {
          const content = fs.readFileSync(PROGRESS_PATH, "utf-8");
          controller.enqueue(encoder.encode(`data: ${content}\n\n`));
          lastContent = content;
          lastMtime = fs.statSync(PROGRESS_PATH).mtimeMs;
        } else {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ status: "idle", stages: [] })}\n\n`)
          );
        }
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ status: "idle", stages: [] })}\n\n`)
        );
      }

      // Poll for changes every 500ms
      const interval = setInterval(() => {
        if (closed) {
          clearInterval(interval);
          return;
        }
        try {
          if (!fs.existsSync(PROGRESS_PATH)) return;
          const stat = fs.statSync(PROGRESS_PATH);
          if (stat.mtimeMs > lastMtime) {
            lastMtime = stat.mtimeMs;
            const content = fs.readFileSync(PROGRESS_PATH, "utf-8");
            if (content !== lastContent) {
              lastContent = content;
              controller.enqueue(encoder.encode(`data: ${content}\n\n`));
            }
          }
        } catch {
          // file might be mid-write
        }
      }, 500);

      // Clean up on abort
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
