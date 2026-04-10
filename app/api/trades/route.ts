import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const AGENT_DIR =
  process.env.POLYMARKET_AGENT_DIR ||
  "/Users/adityasahni/Desktop/Claudecode/polymarket-agent";

const DB_PATH = path.join(AGENT_DIR, "db", "trading.db");
const PORTFOLIO_PATH = path.join(AGENT_DIR, "data", "portfolio.json");

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

    // Read live portfolio data
    let portfolio = {
      starting_capital: 131.0,
      effective_capital: 131.0,
      realized_pnl: 0,
      cash_available: 131.0,
      total_invested: 0,
      estimated_total_value: 131.0,
      position_count: 0,
      max_positions: 5,
      today_pnl: 0,
      daily_loss_limit: 13.1,
      max_position_size: 19.65,
    };
    try {
      if (fs.existsSync(PORTFOLIO_PATH)) {
        const raw = fs.readFileSync(PORTFOLIO_PATH, "utf-8");
        portfolio = { ...portfolio, ...JSON.parse(raw) };
      }
    } catch {
      // use defaults
    }

    const liveTrades = formattedTrades.filter((t) => !t.dryRun);

    return NextResponse.json({
      trades: formattedTrades,
      snapshots: formattedSnapshots,
      portfolio: {
        totalValue: portfolio.estimated_total_value,
        cash: portfolio.cash_available,
        invested: portfolio.total_invested,
        realizedPnl: portfolio.realized_pnl,
        positionCount: portfolio.position_count,
        maxPositions: portfolio.max_positions,
        todayPnl: portfolio.today_pnl,
        dailyLossLimit: portfolio.daily_loss_limit,
        maxPositionSize: portfolio.max_position_size,
        startingCapital: portfolio.starting_capital,
      },
      summary: {
        totalTrades: liveTrades.length,
        totalInvested: portfolio.total_invested,
        startingCapital: portfolio.starting_capital,
      },
    });
  } catch (error) {
    console.error("Failed to read trading DB:", error);
    return NextResponse.json(
      { error: "Failed to read trading database", trades: [], snapshots: [], summary: { totalTrades: 0, totalInvested: 0, startingCapital: 131.0 } },
      { status: 500 }
    );
  }
}
