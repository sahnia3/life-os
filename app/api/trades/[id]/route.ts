import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const AGENT_DIR =
  process.env.POLYMARKET_AGENT_DIR ||
  "/Users/adityasahni/Desktop/Claudecode/polymarket-agent";

const DB_PATH = path.join(AGENT_DIR, "db", "trading.db");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tradeId = parseInt(id, 10);
  if (isNaN(tradeId)) {
    return NextResponse.json({ error: "Invalid trade ID" }, { status: 400 });
  }

  try {
    const db = new Database(DB_PATH, { readonly: true });

    const trade = db
      .prepare("SELECT * FROM trades WHERE id = ?")
      .get(tradeId) as Record<string, unknown> | undefined;

    if (!trade) {
      db.close();
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    // Parse response_json for tx hash and order ID
    let txHash: string | null = null;
    let orderId: string | null = null;
    let sharesReceived: number | null = null;
    let responseData: Record<string, unknown> | null = null;
    if (trade.response_json && typeof trade.response_json === "string") {
      try {
        responseData = JSON.parse(trade.response_json);
        txHash = (responseData?.transactionsHashes as string[])?.[0] ?? null;
        orderId = (responseData?.orderID as string) ?? null;
        const taking = responseData?.takingAmount;
        if (taking) sharesReceived = parseInt(taking as string);
      } catch {
        // ignore parse errors
      }
    }

    // Try to find matching pipeline evaluation
    let evaluation: Record<string, unknown> | null = null;
    const question = trade.market_question as string | null;
    if (question) {
      const cityMatch = question.match(/temperature in (\w[\w\s]*?) (?:be|on)/i);
      const bucketMatch = question.match(/(\d+)\s*°?\s*[CF]/i);
      if (cityMatch && bucketMatch) {
        const city = cityMatch[1].trim();
        const bucket = parseInt(bucketMatch[1]);
        evaluation = db
          .prepare(
            `SELECT * FROM pipeline_evaluations
             WHERE city = ? AND bucket_value = ? AND trade_executed = 1
             ORDER BY id DESC LIMIT 1`
          )
          .get(city, bucket) as Record<string, unknown> | null;
      }
    }

    db.close();

    return NextResponse.json({
      trade: {
        id: trade.id,
        timestamp: trade.timestamp,
        marketId: trade.market_id,
        marketQuestion: trade.market_question,
        tokenId: trade.token_id,
        side: trade.side,
        amount: trade.amount,
        price: trade.price,
        estimatedProb: trade.estimated_prob,
        edge: trade.edge,
        kellyPct: trade.kelly_pct,
        status: trade.dry_run ? "dry_run" : trade.status === "SUBMITTED" ? "filled" : (trade.status as string)?.toLowerCase(),
        dryRun: !!trade.dry_run,
        resolved: !!trade.resolved,
        pnl: trade.pnl,
        brierScore: trade.brier_score,
        category: trade.category,
        txHash,
        orderId,
        sharesReceived,
        polymarketUrl: trade.market_id ? `https://polymarket.com/event/${trade.market_id}` : null,
        polygonscanUrl: txHash ? `https://polygonscan.com/tx/${txHash}` : null,
        responseData,
      },
      evaluation: evaluation
        ? {
            cycleId: evaluation.cycle_id,
            timestamp: evaluation.timestamp,
            city: evaluation.city,
            targetDate: evaluation.target_date,
            bucketValue: evaluation.bucket_value,
            side: evaluation.side,
            ensembleProb: evaluation.ensemble_prob,
            livePrice: evaluation.live_price,
            liveEdge: evaluation.live_edge,
            ensembleMean: evaluation.ensemble_mean,
            ensembleStd: evaluation.ensemble_std,
            modelSpread: evaluation.model_spread,
            gates: {
              q1: evaluation.gate_q1_result,
              q2: evaluation.gate_q2_result,
              q3: evaluation.gate_q3_result,
              q3b: evaluation.gate_q3b_result,
              q4: evaluation.gate_q4_result,
              q5: evaluation.gate_q5_result,
              q6: evaluation.gate_q6_result,
              q7: evaluation.gate_q7_result,
              q8: evaluation.gate_q8_result ?? "skip",
            },
            q8Reasoning: evaluation.gate_q8_reasoning,
            gateOutcome: evaluation.gate_outcome,
            rejectionReason: evaluation.rejection_reason,
          }
        : null,
    });
  } catch (error) {
    console.error("Trade detail error:", error);
    return NextResponse.json({ error: "Failed to read trade" }, { status: 500 });
  }
}
