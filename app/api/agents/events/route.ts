import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(
  process.env.POLYMARKET_AGENT_DIR ||
    "/Users/adityasahni/Desktop/Claudecode/polymarket-agent",
  "db",
  "trading.db"
);

interface AgentEvent {
  id: number;
  timestamp: string;
  cycle_id: string;
  agent_name: string;
  event_type: string;
  message: string;
  data_json: string | null;
  parent_agent: string | null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lastId = parseInt(url.searchParams.get("lastId") || "0", 10);

  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );

      let currentLastId = lastId;

      const poll = () => {
        if (cancelled) return;

        try {
          const db = new Database(DB_PATH, { readonly: true });
          const rows = db
            .prepare(
              "SELECT * FROM agent_events WHERE id > ? ORDER BY id ASC LIMIT 50"
            )
            .all(currentLastId) as AgentEvent[];
          db.close();

          for (const row of rows) {
            const event = {
              type: "agent_event",
              id: row.id,
              timestamp: row.timestamp,
              cycleId: row.cycle_id,
              agentName: row.agent_name,
              eventType: row.event_type,
              message: row.message,
              data: row.data_json ? JSON.parse(row.data_json) : null,
              parentAgent: row.parent_agent,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
            currentLastId = row.id;
          }
        } catch {
          // DB might be locked momentarily, skip this poll
        }

        if (!cancelled) {
          setTimeout(poll, 500);
        }
      };

      poll();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
