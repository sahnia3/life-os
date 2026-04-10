import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(
  process.env.POLYMARKET_AGENT_DIR ||
    "/Users/adityasahni/Desktop/Claudecode/polymarket-agent",
  "db",
  "trading.db"
);

interface AgentRun {
  id: number;
  cycle_id: string;
  agent_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  tokens_used: number | null;
  error_message: string | null;
}

const AGENT_DEFINITIONS = [
  { name: "orchestrator_v2", label: "CRO", role: "Chief Research Officer — runs V2 pipeline and final trade ratification" },
  { name: "market_scanner", label: "Market Scanner", role: "Scans and filters markets" },
  { name: "researcher", label: "Researcher", role: "Gathers web evidence via Claude Code" },
  { name: "estimator_a", label: "Est A (Prior)", role: "Pure prior — only sees question, no research or prices" },
  { name: "estimator_b", label: "Est B (Research)", role: "Research-informed — sees facts but no odds or prices" },
  { name: "estimator_c", label: "Est C (Quant)", role: "Quantitative only — hard numbers, no narrative" },
  { name: "estimator_d", label: "Est D (Bear)", role: "Adversarial bear case — argues against every trade" },
  { name: "aggregator", label: "Aggregator", role: "Combines and calibrates estimates" },
  { name: "risk_manager", label: "Risk Manager", role: "Validates risk limits" },
  { name: "trader", label: "Trader", role: "Executes approved trades" },
];

export async function GET() {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    // Get latest run per agent
    const latestRuns = db
      .prepare(
        `SELECT ar.* FROM agent_runs ar
         INNER JOIN (
           SELECT agent_name, MAX(id) as max_id
           FROM agent_runs GROUP BY agent_name
         ) latest ON ar.id = latest.max_id
         ORDER BY ar.started_at DESC`
      )
      .all() as AgentRun[];

    // Get latest cycle_id
    const latestCycle = db
      .prepare("SELECT cycle_id FROM agent_runs ORDER BY id DESC LIMIT 1")
      .get() as { cycle_id: string } | undefined;

    // Check if any agent is currently running (ignore stale runs older than 30 min)
    const runningCount = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM agent_runs WHERE status = 'running' AND started_at > datetime('now', '-30 minutes')"
      )
      .get() as { cnt: number };

    // Get total cycles
    const totalCycles = db
      .prepare("SELECT COUNT(DISTINCT cycle_id) as cnt FROM agent_runs")
      .get() as { cnt: number };

    db.close();

    const runsByAgent = new Map(latestRuns.map((r) => [r.agent_name, r]));

    const agents = AGENT_DEFINITIONS.map((def) => {
      const run = runsByAgent.get(def.name);
      return {
        name: def.name,
        label: def.label,
        role: def.role,
        status: run?.status || "idle",
        lastRunAt: run?.started_at || null,
        lastDurationMs: run?.duration_ms || null,
        tokensUsed: run?.tokens_used || 0,
        error: run?.error_message || null,
        cycleId: run?.cycle_id || null,
      };
    });

    // Override CRO duration with ratification-only timing (not full cycle)
    const ratifierRun = runsByAgent.get("cro_ratifier");
    const croAgent = agents.find((a) => a.name === "orchestrator_v2");
    if (ratifierRun && croAgent) {
      croAgent.lastDurationMs = ratifierRun.duration_ms;
    }

    return NextResponse.json({
      agents,
      isRunning: runningCount.cnt > 0,
      latestCycleId: latestCycle?.cycle_id || null,
      totalCycles: totalCycles.cnt,
    });
  } catch (error) {
    console.error("Failed to read agent status:", error);
    return NextResponse.json(
      {
        agents: AGENT_DEFINITIONS.map((d) => ({
          ...d,
          status: "idle",
          lastRunAt: null,
          lastDurationMs: null,
          tokensUsed: 0,
          error: null,
          cycleId: null,
        })),
        isRunning: false,
        latestCycleId: null,
        totalCycles: 0,
      },
      { status: 500 }
    );
  }
}
