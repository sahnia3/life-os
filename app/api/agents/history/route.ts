import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(
  process.env.POLYMARKET_AGENT_DIR ||
    "/Users/adityasahni/Desktop/Claudecode/polymarket-agent",
  "db",
  "trading.db"
);

interface CycleRow {
  cycle_id: string;
  started_at: string;
  completed_at: string | null;
  agent_count: number;
  error_count: number;
  total_tokens: number;
}

interface EventRow {
  cycle_id: string;
  message: string;
  agent_name: string;
  event_type: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  try {
    const db = new Database(DB_PATH, { readonly: true });

    const cycles = db
      .prepare(
        `SELECT
          cycle_id,
          MIN(started_at) as started_at,
          MAX(completed_at) as completed_at,
          COUNT(*) as agent_count,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
          SUM(COALESCE(tokens_used, 0)) as total_tokens
        FROM agent_runs
        GROUP BY cycle_id
        ORDER BY MIN(started_at) DESC
        LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as CycleRow[];

    // Get final event message per cycle for summary
    const summaries: Record<string, string> = {};
    if (cycles.length > 0) {
      const cycleIds = cycles.map((c) => c.cycle_id);
      for (const cid of cycleIds) {
        const lastEvent = db
          .prepare(
            `SELECT message FROM agent_events
             WHERE cycle_id = ? AND agent_name = 'orchestrator' AND event_type = 'completed'
             ORDER BY id DESC LIMIT 1`
          )
          .get(cid) as EventRow | undefined;
        summaries[cid] = lastEvent?.message || "Cycle completed";
      }
    }

    db.close();

    const formattedCycles = cycles.map((c) => ({
      cycleId: c.cycle_id,
      startedAt: c.started_at,
      completedAt: c.completed_at,
      agentCount: c.agent_count,
      errorCount: c.error_count,
      totalTokens: c.total_tokens,
      summary: summaries[c.cycle_id] || "Cycle completed",
      hasErrors: c.error_count > 0,
    }));

    return NextResponse.json({
      cycles: formattedCycles,
      total: cycles.length,
      offset,
      limit,
    });
  } catch (error) {
    console.error("Failed to read cycle history:", error);
    return NextResponse.json(
      { cycles: [], total: 0, offset, limit },
      { status: 500 }
    );
  }
}
