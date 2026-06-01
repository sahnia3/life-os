import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AGENT_DIR =
  process.env.POLYMARKET_AGENT_DIR ||
  "/Users/adityasahni/Desktop/Claudecode/polymarket-agent";

const DB_PATH = path.join(AGENT_DIR, "db", "trading.db");
const PORTFOLIO_PATH = path.join(AGENT_DIR, "data", "portfolio.json");

interface PolymarketSnapshot {
  walletUsd: number | null;
  positions: number;
  lastCycleAt: number | null;
  lastCycleStatus: string | null;
  recentTrades: Array<{
    market: string;
    side: string;
    size: number;
    price: number;
    ts: number;
  }>;
  portfolioStale: boolean;
  portfolioMtimeMs: number | null;
  dbExists: boolean;
}

export async function GET() {
  const out: PolymarketSnapshot = {
    walletUsd: null,
    positions: 0,
    lastCycleAt: null,
    lastCycleStatus: null,
    recentTrades: [],
    portfolioStale: false,
    portfolioMtimeMs: null,
    dbExists: fs.existsSync(DB_PATH),
  };

  if (fs.existsSync(PORTFOLIO_PATH)) {
    const stat = fs.statSync(PORTFOLIO_PATH);
    out.portfolioMtimeMs = stat.mtimeMs;
    out.portfolioStale = Date.now() - stat.mtimeMs > 24 * 60 * 60 * 1000;
    try {
      const raw = JSON.parse(
        fs.readFileSync(PORTFOLIO_PATH, "utf8")
      ) as Record<string, unknown>;
      if (typeof raw.total_usd === "number") out.walletUsd = raw.total_usd;
      else if (typeof raw.wallet_balance_usd === "number")
        out.walletUsd = raw.wallet_balance_usd;
      if (Array.isArray(raw.positions)) out.positions = raw.positions.length;
    } catch {
      // skip
    }
  }

  if (out.dbExists) {
    try {
      const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
      try {
        const lastCycle = db
          .prepare(
            `SELECT started_at, status FROM cycles ORDER BY id DESC LIMIT 1`
          )
          .get() as { started_at: string; status: string } | undefined;
        if (lastCycle) {
          out.lastCycleAt = Date.parse(lastCycle.started_at);
          out.lastCycleStatus = lastCycle.status;
        }
      } catch {
        // table may not exist
      }
      try {
        const trades = db
          .prepare(
            `SELECT market_question as market, side, size, price, ts FROM trades ORDER BY ts DESC LIMIT 5`
          )
          .all() as Array<{
          market: string;
          side: string;
          size: number;
          price: number;
          ts: string;
        }>;
        out.recentTrades = trades.map((t) => ({
          market: t.market,
          side: t.side,
          size: t.size,
          price: t.price,
          ts: Date.parse(t.ts),
        }));
      } catch {
        // skip
      }
      db.close();
    } catch {
      // db open failed
    }
  }

  return NextResponse.json(out);
}
