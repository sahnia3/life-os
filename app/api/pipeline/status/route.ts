import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const AGENT_DIR =
  process.env.POLYMARKET_AGENT_DIR ||
  "/Users/adityasahni/Desktop/Claudecode/polymarket-agent";

const DB_PATH = path.join(AGENT_DIR, "db", "trading.db");
const LESSONS_PATH = path.join(AGENT_DIR, "data", "weather_lessons.json");

interface CycleRow {
  id: number;
  cycle_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  events_scanned: number;
  opportunities_found: number;
  trades_executed: number;
  dry_run: number;
  balance_before: number | null;
  balance_after: number | null;
}

interface EvalRow {
  id: number;
  cycle_id: string;
  timestamp: string;
  city: string;
  target_date: string;
  bucket_value: number;
  bucket_type: string;
  side: string;
  ensemble_prob: number;
  market_price: number;
  live_price: number;
  edge: number;
  live_edge: number;
  ensemble_members: number;
  ensemble_mean: number;
  ensemble_std: number;
  ensemble_range_min: number;
  ensemble_range_max: number;
  model_spread: number;
  gate_q1_result: string;
  gate_q2_result: string;
  gate_q3_result: string;
  gate_q3b_result: string;
  gate_q4_result: string;
  gate_q5_result: string;
  gate_q6_result: string;
  gate_q7_result: string;
  gate_q8_result: string | null;
  gate_q8_reasoning: string | null;
  gate_warnings: number;
  gate_blocks: number;
  gate_outcome: string;
  metar_icao: string | null;
  metar_latest_temp: number | null;
  metar_max_observed: number | null;
  deterministic_json: string | null;
  trade_executed: number;
  trade_amount: number | null;
  rejection_reason: string | null;
}

interface Lesson {
  timestamp: string;
  market: string;
  category: string;
  failure_type: string;
  estimated_prob: number;
  market_price: number;
  pnl: number;
  brier: number | null;
  lesson: string;
}

export async function GET() {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    const latestCycle = db
      .prepare(
        "SELECT * FROM pipeline_cycles ORDER BY id DESC LIMIT 1"
      )
      .get() as CycleRow | undefined;

    const cycleHistory = db
      .prepare(
        "SELECT cycle_id, started_at, status, events_scanned, opportunities_found, trades_executed, dry_run FROM pipeline_cycles ORDER BY id DESC LIMIT 20"
      )
      .all() as CycleRow[];

    const latestCycleId = latestCycle?.cycle_id;
    const recentEvals = latestCycleId
      ? (db
          .prepare(
            "SELECT * FROM pipeline_evaluations WHERE cycle_id = ? ORDER BY id"
          )
          .all(latestCycleId) as EvalRow[])
      : [];

    // Fetch evaluations for ALL recent cycles (for expandable cycle view)
    const allCycleIds = cycleHistory.map((c) => c.cycle_id);
    const cycleEvalMap: Record<string, EvalRow[]> = {};
    if (allCycleIds.length > 0) {
      const placeholders = allCycleIds.map(() => "?").join(",");
      const allEvals = db
        .prepare(
          `SELECT * FROM pipeline_evaluations WHERE cycle_id IN (${placeholders}) ORDER BY id`
        )
        .all(...allCycleIds) as EvalRow[];
      for (const ev of allEvals) {
        if (!cycleEvalMap[ev.cycle_id]) cycleEvalMap[ev.cycle_id] = [];
        cycleEvalMap[ev.cycle_id].push(ev);
      }
    }

    // Gate analytics: count outcomes across all evaluations
    const gateStats = db
      .prepare(
        `SELECT
           SUM(CASE WHEN gate_q1_result = 'block' THEN 1 ELSE 0 END) as q1_blocks,
           SUM(CASE WHEN gate_q2_result = 'block' THEN 1 ELSE 0 END) as q2_blocks,
           SUM(CASE WHEN gate_q3_result = 'block' THEN 1 ELSE 0 END) as q3_blocks,
           SUM(CASE WHEN gate_q3b_result = 'block' THEN 1 ELSE 0 END) as q3b_blocks,
           SUM(CASE WHEN gate_q4_result = 'block' THEN 1 ELSE 0 END) as q4_blocks,
           SUM(CASE WHEN gate_q5_result = 'block' THEN 1 ELSE 0 END) as q5_blocks,
           SUM(CASE WHEN gate_q6_result = 'block' THEN 1 ELSE 0 END) as q6_blocks,
           SUM(CASE WHEN gate_q7_result = 'block' THEN 1 ELSE 0 END) as q7_blocks,
           SUM(CASE WHEN gate_q8_result = 'block' THEN 1 ELSE 0 END) as q8_blocks,
           COUNT(*) as total_evals
         FROM pipeline_evaluations`
      )
      .get() as Record<string, number>;

    db.close();

    function parseModels(json: string | null): { name: string; mean: number; members: number }[] | null {
      if (!json) return null;
      try {
        const data = JSON.parse(json);
        return Object.entries(data as Record<string, unknown>).map(([name, info]) => ({
          name,
          mean: (info as { peak?: number }).peak ?? 0,
          members: (info as { members?: number }).members ?? 1,
        }));
      } catch {
        return null;
      }
    }

    function formatEval(e: EvalRow) {
      const models = parseModels(e.deterministic_json);
      return {
        city: e.city,
        targetDate: e.target_date,
        bucketValue: e.bucket_value,
        bucketType: e.bucket_type,
        side: e.side,
        ensembleProb: e.ensemble_prob,
        marketPrice: e.market_price,
        livePrice: e.live_price,
        edge: e.edge,
        liveEdge: e.live_edge,
        ensembleMembers: e.ensemble_members,
        ensembleMean: e.ensemble_mean,
        ensembleStd: e.ensemble_std,
        modelSpread: e.model_spread,
        modelCount: models?.length ?? 0,
        models,
        ensembleRange: { min: e.ensemble_range_min, max: e.ensemble_range_max },
        gates: {
          q1: e.gate_q1_result,
          q2: e.gate_q2_result,
          q3: e.gate_q3_result,
          q3b: e.gate_q3b_result,
          q4: e.gate_q4_result,
          q5: e.gate_q5_result,
          q6: e.gate_q6_result,
          q7: e.gate_q7_result,
          q8: e.gate_q8_result ?? "skip",
        },
        gateWarnings: e.gate_warnings,
        q8Reasoning: e.gate_q8_reasoning,
        gateBlocks: e.gate_blocks,
        gateOutcome: e.gate_outcome,
        metar: e.metar_icao
          ? { icao: e.metar_icao, latestTemp: e.metar_latest_temp, maxObserved: e.metar_max_observed }
          : null,
        tradeExecuted: !!e.trade_executed,
        tradeAmount: e.trade_amount,
        rejectionReason: e.rejection_reason,
      };
    }

    // Build per-cycle evaluation map
    const evaluationsByCycle: Record<string, ReturnType<typeof formatEval>[]> = {};
    for (const [cycleId, evs] of Object.entries(cycleEvalMap)) {
      evaluationsByCycle[cycleId] = evs.map(formatEval);
    }

    // Read lessons
    let lessons: Lesson[] = [];
    try {
      if (fs.existsSync(LESSONS_PATH)) {
        lessons = JSON.parse(fs.readFileSync(LESSONS_PATH, "utf-8"));
      }
    } catch {
      // no lessons file
    }

    const wins = lessons.filter((l) => l.failure_type === "WIN");
    const losses = lessons.filter((l) => l.failure_type !== "WIN");

    return NextResponse.json({
      latestCycle: latestCycle
        ? {
            cycleId: latestCycle.cycle_id,
            startedAt: latestCycle.started_at,
            completedAt: latestCycle.completed_at,
            status: latestCycle.status,
            eventsScanned: latestCycle.events_scanned,
            opportunitiesFound: latestCycle.opportunities_found,
            tradesExecuted: latestCycle.trades_executed,
            dryRun: !!latestCycle.dry_run,
          }
        : null,
      recentEvaluations: recentEvals.map(formatEval),
      evaluationsByCycle,
      cycleHistory: cycleHistory.map((c) => ({
        cycleId: c.cycle_id,
        startedAt: c.started_at,
        status: c.status,
        eventsScanned: c.events_scanned,
        opportunitiesFound: c.opportunities_found,
        tradesExecuted: c.trades_executed,
        dryRun: !!c.dry_run,
      })),
      gateStats: gateStats || {},
      lessons: {
        total: lessons.length,
        wins: wins.length,
        losses: losses.length,
        winRate: lessons.length > 0 ? wins.length / lessons.length : 0,
        recentLosses: losses.slice(-5).map((l) => ({
          lesson: l.lesson,
          failureType: l.failure_type,
          pnl: l.pnl,
          market: l.market,
        })),
      },
    });
  } catch (error) {
    console.error("Pipeline status error:", error);
    return NextResponse.json(
      {
        error: "Failed to read pipeline data",
        latestCycle: null,
        recentEvaluations: [],
        cycleHistory: [],
        gateStats: {},
        lessons: { total: 0, wins: 0, losses: 0, winRate: 0, recentLosses: [] },
      },
      { status: 500 }
    );
  }
}
