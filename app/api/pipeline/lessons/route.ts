import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const AGENT_DIR =
  process.env.POLYMARKET_AGENT_DIR ||
  "/Users/adityasahni/Desktop/Claudecode/polymarket-agent";

const LESSONS_PATH = path.join(AGENT_DIR, "data", "weather_lessons.json");

interface Lesson {
  trade_id: number;
  timestamp: string;
  market: string;
  side: string;
  failure_type: string;
  estimated_prob: number;
  market_price: number;
  edge_claimed: number;
  pnl: number;
  lesson: string;
}

export async function GET() {
  try {
    let lessons: Lesson[] = [];
    if (fs.existsSync(LESSONS_PATH)) {
      lessons = JSON.parse(fs.readFileSync(LESSONS_PATH, "utf-8"));
    }

    const wins = lessons.filter((l) => l.failure_type === "WIN");
    const losses = lessons.filter((l) => l.failure_type !== "WIN");

    // Group by failure type
    const byFailureType: Record<string, { count: number; totalPnl: number }> = {};
    for (const l of lessons) {
      const ft = l.failure_type;
      if (!byFailureType[ft]) byFailureType[ft] = { count: 0, totalPnl: 0 };
      byFailureType[ft].count++;
      byFailureType[ft].totalPnl += l.pnl;
    }

    // City P&L breakdown
    const cityPnl: Record<string, { pnl: number; trades: number; wins: number }> = {};
    for (const l of lessons) {
      const cityMatch = l.market.match(/temperature in (\w[\w\s]*?) (?:be|on)/i);
      const city = cityMatch ? cityMatch[1].trim() : "Unknown";
      if (!cityPnl[city]) cityPnl[city] = { pnl: 0, trades: 0, wins: 0 };
      cityPnl[city].pnl += l.pnl;
      cityPnl[city].trades++;
      if (l.failure_type === "WIN") cityPnl[city].wins++;
    }

    // Brier-like trend: edge_claimed accuracy over time
    const brierTrend = lessons.map((l) => ({
      timestamp: l.timestamp,
      edgeClaimed: l.edge_claimed,
      pnl: l.pnl,
      win: l.failure_type === "WIN",
      city: (() => {
        const m = l.market.match(/temperature in (\w[\w\s]*?) (?:be|on)/i);
        return m ? m[1].trim() : "Unknown";
      })(),
    }));

    return NextResponse.json({
      total: lessons.length,
      wins: wins.length,
      losses: losses.length,
      winRate: lessons.length > 0 ? wins.length / lessons.length : 0,
      totalPnl: lessons.reduce((s, l) => s + l.pnl, 0),
      byFailureType,
      cityPnl: Object.entries(cityPnl)
        .map(([city, data]) => ({ city, ...data }))
        .sort((a, b) => b.pnl - a.pnl),
      brierTrend,
      lessons: lessons.map((l) => ({
        tradeId: l.trade_id,
        timestamp: l.timestamp,
        market: l.market,
        side: l.side,
        failureType: l.failure_type,
        estimatedProb: l.estimated_prob,
        marketPrice: l.market_price,
        edgeClaimed: l.edge_claimed,
        pnl: l.pnl,
        lesson: l.lesson,
      })),
    });
  } catch (error) {
    console.error("Lessons route error:", error);
    return NextResponse.json(
      { error: "Failed to read lessons", total: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, byFailureType: {}, cityPnl: [], brierTrend: [], lessons: [] },
      { status: 500 }
    );
  }
}
