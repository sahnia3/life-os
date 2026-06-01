import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const AGENT_DIR =
  process.env.POLYMARKET_AGENT_DIR ||
  "/Users/adityasahni/Desktop/Claudecode/polymarket-agent";

const DB_PATH = path.join(AGENT_DIR, "db", "trading.db");

interface TradeRow {
  id: number;
  timestamp: string;
  market_id: string | null;
  market_question: string | null;
  token_id: string;
  side: string;
  amount: number;
  price: number | null;
  estimated_prob: number | null;
  edge: number | null;
  kelly_pct: number | null;
  status: string;
  dry_run: number;
  response_json: string | null;
  resolved?: number;
  pnl?: number | null;
}

interface SnapshotRow {
  id: number;
  timestamp: string;
  total_value: number | null;
  cash: number | null;
  invested: number | null;
  daily_pnl: number | null;
  positions_json: string | null;
}

function parseResponseJson(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET() {
  const STARTING_CAPITAL = 131.0;

  try {
    const db = new Database(DB_PATH, { readonly: true });

    const trades = db
      .prepare("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 50")
      .all() as TradeRow[];

    const snapshots = db
      .prepare(
        "SELECT * FROM portfolio_snapshots ORDER BY timestamp DESC LIMIT 30"
      )
      .all() as SnapshotRow[];

    // Compute portfolio from DB — single source of truth
    const resolvedPnl = db
      .prepare("SELECT COALESCE(SUM(pnl), 0) as total FROM trades WHERE dry_run = 0 AND resolved = 1")
      .get() as { total: number };

    const openPositions = db
      .prepare(
        `SELECT id, timestamp, market_id, market_question, token_id, side, amount, price,
                estimated_prob, edge, response_json
         FROM trades WHERE dry_run = 0 AND resolved = 0 AND side != 'SELL'
           AND token_id NOT IN (SELECT token_id FROM trades WHERE side = 'SELL' AND dry_run = 0)
         ORDER BY timestamp DESC`
      )
      .all() as TradeRow[];

    // Get real USDC balance from latest pipeline cycle
    const latestBalance = db
      .prepare("SELECT balance_after FROM pipeline_cycles WHERE balance_after IS NOT NULL ORDER BY id DESC LIMIT 1")
      .get() as { balance_after: number } | undefined;

    // Resolved trades for P&L trend (chronological)
    const resolvedTrades = db.prepare(
      `SELECT timestamp, market_question, side, amount, pnl, edge, market_id
       FROM trades WHERE dry_run = 0 AND resolved = 1 ORDER BY timestamp ASC`
    ).all() as { timestamp: string; market_question: string | null; side: string; amount: number; pnl: number | null; edge: number | null; market_id: string | null }[];

    const totalInvested = openPositions.reduce((sum, t) => sum + t.amount, 0);
    const realizedPnl = resolvedPnl.total;
    const cashAvailable = latestBalance?.balance_after ?? (STARTING_CAPITAL + realizedPnl - totalInvested);
    const estimatedTotalValue = cashAvailable + totalInvested;

    db.close();

    const formattedTrades = trades.map((t) => {
      const resp = parseResponseJson(t.response_json);
      const txHash = resp?.transactionsHashes?.[0] || null;
      const orderId = resp?.orderID || null;
      const sharesReceived = resp?.takingAmount
        ? parseInt(resp.takingAmount)
        : null;

      return {
        id: t.id,
        timestamp: t.timestamp,
        marketId: t.market_id,
        marketQuestion: t.market_question,
        tokenId: t.token_id,
        side: t.side,
        amount: t.amount,
        price: t.price,
        estimatedProb: t.estimated_prob,
        edge: t.edge,
        kellyPct: t.kelly_pct,
        status: t.dry_run ? "dry_run" : t.status === "SUBMITTED" ? "filled" : t.status?.toLowerCase(),
        dryRun: !!t.dry_run,
        txHash,
        orderId,
        sharesReceived,
        polymarketUrl: t.market_id
          ? `https://polymarket.com/event/${t.market_id}`
          : null,
        polygonscanUrl: txHash
          ? `https://polygonscan.com/tx/${txHash}`
          : null,
      };
    });

    const formattedSnapshots = snapshots.map((s) => ({
      timestamp: s.timestamp,
      totalValue: s.total_value,
      cash: s.cash,
      invested: s.invested,
      dailyPnl: s.daily_pnl,
    }));

    const formattedPositions = openPositions.map((t) => {
      const resp = parseResponseJson(t.response_json);
      const sharesReceived = resp?.takingAmount ? parseFloat(resp.takingAmount) : null;
      return {
        id: t.id,
        timestamp: t.timestamp,
        marketId: t.market_id,
        marketQuestion: t.market_question,
        side: t.side,
        amount: t.amount,
        price: t.price,
        estimatedProb: t.estimated_prob,
        edge: t.edge,
        sharesReceived,
        maxPayout: sharesReceived ? sharesReceived / 1e6 : null,
      };
    });

    const liveTrades = formattedTrades.filter((t) => !t.dryRun);

    const pnlTrend = resolvedTrades.map((t) => {
      const cityMatch = t.market_question?.match(/temperature in (\w[\w\s]*?) (?:on|be)/i);
      return {
        timestamp: t.timestamp,
        city: cityMatch?.[1]?.trim() ?? t.market_id?.split("-").slice(3, -4).join(" ") ?? "Unknown",
        pnl: t.pnl ?? 0,
        win: (t.pnl ?? 0) > 0,
        edgeClaimed: t.edge ?? 0,
      };
    });

    return NextResponse.json({
      trades: formattedTrades,
      snapshots: formattedSnapshots,
      positions: formattedPositions,
      pnlTrend,
      portfolio: {
        totalValue: estimatedTotalValue,
        cash: cashAvailable,
        invested: totalInvested,
        realizedPnl,
        positionCount: openPositions.length,
        todayPnl: 0,
        dailyLossLimit: STARTING_CAPITAL * 0.1,
        maxPositionSize: STARTING_CAPITAL * 0.15,
        startingCapital: STARTING_CAPITAL,
      },
      summary: {
        totalTrades: liveTrades.length,
        totalInvested: totalInvested,
        startingCapital: STARTING_CAPITAL,
      },
    });
  } catch (error) {
    console.error("Failed to read trading DB:", error);
    return NextResponse.json(
      { error: "Failed to read trading database", trades: [], snapshots: [], positions: [], summary: { totalTrades: 0, totalInvested: 0, startingCapital: STARTING_CAPITAL } },
      { status: 500 }
    );
  }
}
