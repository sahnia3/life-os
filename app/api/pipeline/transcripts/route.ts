import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const AGENT_DIR =
  process.env.POLYMARKET_AGENT_DIR ||
  "/Users/adityasahni/Desktop/Claudecode/polymarket-agent";

const DB_PATH = path.join(AGENT_DIR, "db", "trading.db");

interface TranscriptRow {
  id: number;
  cycle_id: string;
  timestamp: string;
  city: string;
  target_date: string;
  bucket_value: number;
  side: string;
  ensemble_prob: number;
  live_price: number;
  live_edge: number;
  gate_q8_result: string;
  gate_q8_reasoning: string;
  gate_outcome: string;
  trade_executed: number;
  rejection_reason: string | null;
}

export async function GET() {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    const rows = db
      .prepare(
        `SELECT id, cycle_id, timestamp, city, target_date, bucket_value,
                side, ensemble_prob, live_price, live_edge,
                gate_q8_result, gate_q8_reasoning, gate_outcome,
                trade_executed, rejection_reason
         FROM pipeline_evaluations
         WHERE gate_q8_reasoning IS NOT NULL AND gate_q8_reasoning != ''
         ORDER BY id DESC
         LIMIT 100`
      )
      .all() as TranscriptRow[];

    // Compute stats
    let pass = 0;
    let warn = 0;
    let block = 0;
    for (const r of rows) {
      if (r.gate_q8_result === "block") block++;
      else if (r.gate_q8_result === "warn") warn++;
      else pass++;
    }

    db.close();

    return NextResponse.json({
      transcripts: rows.map((r) => ({
        id: r.id,
        cycleId: r.cycle_id,
        timestamp: r.timestamp,
        city: r.city,
        targetDate: r.target_date,
        bucketValue: r.bucket_value,
        side: r.side,
        ensembleProb: r.ensemble_prob,
        livePrice: r.live_price,
        liveEdge: r.live_edge,
        q8Result: r.gate_q8_result,
        q8Reasoning: r.gate_q8_reasoning,
        gateOutcome: r.gate_outcome,
        tradeExecuted: !!r.trade_executed,
        rejectionReason: r.rejection_reason,
      })),
      stats: { total: rows.length, pass, warn, block },
    });
  } catch (error) {
    console.error("Transcripts error:", error);
    return NextResponse.json({ error: "Failed to read transcripts" }, { status: 500 });
  }
}
