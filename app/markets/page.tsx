"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  BarChart3,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
  Zap,
  RefreshCw,
  GitBranch,
  Cloud,
  Thermometer,
  Brain,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePipelineStatus, useLessons, usePipelineProgress } from "@/lib/hooks/use-pipeline";
import { tempUnit } from "@/lib/utils";
import { PipelineFlow } from "@/components/markets/pipeline-flow";
import { GateResults } from "@/components/markets/gate-results";
import { EnsembleAgreement } from "@/components/markets/ensemble-agreement";
import { CycleLog } from "@/components/markets/cycle-log";
import { LlmDecisions } from "@/components/markets/llm-decisions";
import { BrierTrend } from "@/components/markets/brier-trend";
import { CityPnl } from "@/components/markets/city-pnl";
import { OpenPositions } from "@/components/markets/open-positions";

// --- Types ---

interface Trade {
  id: number;
  timestamp: string;
  marketId: string | null;
  marketQuestion: string | null;
  tokenId: string;
  side: string;
  amount: number;
  price: number | null;
  estimatedProb: number | null;
  edge: number | null;
  kellyPct: number | null;
  status: string;
  dryRun: boolean;
  txHash: string | null;
  orderId: string | null;
  sharesReceived: number | null;
  polymarketUrl: string | null;
  polygonscanUrl: string | null;
}

interface Position {
  id: number;
  timestamp: string;
  marketId: string | null;
  marketQuestion: string | null;
  side: string;
  amount: number;
  price: number | null;
  estimatedProb: number | null;
  edge: number | null;
  sharesReceived: number | null;
  maxPayout: number | null;
}

interface Portfolio {
  totalValue: number;
  cash: number;
  invested: number;
  realizedPnl: number;
  positionCount: number;
  todayPnl: number;
  dailyLossLimit: number;
  maxPositionSize: number;
  startingCapital: number;
}

interface TradingData {
  trades: Trade[];
  positions: Position[];
  snapshots: { timestamp: string; totalValue: number | null; cash: number | null; invested: number | null; dailyPnl: number | null }[];
  pnlTrend: { timestamp: string; city: string; pnl: number; win: boolean; edgeClaimed: number }[];
  portfolio: Portfolio;
  summary: { totalTrades: number; totalInvested: number; startingCapital: number };
}

// --- Animations ---

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

// --- Helpers ---

function formatTime(timestamp: string) {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return timestamp;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(timestamp: string) {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return timestamp;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseWeatherMeta(question: string | null, marketId: string | null) {
  if (!question) return null;
  const match = question.match(/temperature in (\w[\w\s]*?) (?:be|on)/i);
  const tempMatch = question.match(/(\d+)\s*°?\s*([CF])/i);
  if (!match) return null;
  return {
    city: match[1].trim(),
    bucketValue: tempMatch ? parseInt(tempMatch[1]) : null,
    unit: tempMatch?.[2]?.toUpperCase() === "F" ? "°F" : "°C",
  };
}

// --- Sub-components ---

function StatCard({
  title, value, subtitle, icon: Icon, trend, trendValue, accentClass = "text-primary",
}: {
  title: string; value: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral"; trendValue?: string; accentClass?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={`text-2xl font-bold tracking-tight ${accentClass}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              accentClass === "text-emerald-500" ? "bg-emerald-500/10" : accentClass === "text-destructive" ? "bg-destructive/10" : "bg-primary/10"
            }`}>
              <Icon className={`h-4.5 w-4.5 ${accentClass}`} />
            </div>
            {trend && trendValue && (
              <div className={`flex items-center gap-0.5 text-[11px] font-medium ${
                trend === "up" ? "text-emerald-500" : trend === "down" ? "text-destructive" : "text-muted-foreground"
              }`}>
                {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
                {trendValue}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold">${payload[0].value.toFixed(2)}</p>
    </div>
  );
}

// --- Main Page ---

export default function MarketsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState<TradingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { status: pipelineStatus, refetch: refetchPipeline } = usePipelineStatus();
  const { data: lessonsData } = useLessons();
  const { progress, triggerCycle, connect: connectSSE } = usePipelineProgress();
  const [sseRef, setSseRef] = useState<EventSource | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/trades");
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch trades:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const portfolio = data?.portfolio;
  const startingCapital = portfolio?.startingCapital ?? 131;
  const liveTrades = data?.trades.filter((t) => !t.dryRun) ?? [];
  const totalInvested = portfolio?.invested ?? 0;
  const cashRemaining = portfolio?.cash ?? startingCapital;
  const totalValue = portfolio?.totalValue ?? startingCapital;
  const totalPnl = portfolio?.realizedPnl ?? 0;
  const totalPnlPct = ((totalPnl / startingCapital) * 100).toFixed(1);
  const positionCount = portfolio?.positionCount ?? 0;

  const chartData = data?.snapshots?.length
    ? data.snapshots.map((s) => ({ date: formatDate(s.timestamp), value: s.totalValue ?? startingCapital })).reverse()
    : [{ date: "Today", value: startingCapital }];

  const latestCycle = pipelineStatus?.latestCycle;
  const pipelineRunning = progress.status === "running" || progress.status === "starting";
  const isRunning = pipelineRunning || latestCycle?.status === "RUNNING";

  const handleTrigger = useCallback(async () => {
    const result = await triggerCycle();
    if (result.started && result.eventSource) {
      setSseRef(result.eventSource);
    }
  }, [triggerCycle]);

  // When pipeline completes, refresh data and close SSE
  useEffect(() => {
    if ((progress.status === "completed" || progress.status === "error") && sseRef) {
      refetchPipeline();
      fetchData();
      sseRef.close();
      setSseRef(null);
    }
  }, [progress.status, sseRef, refetchPipeline, fetchData]);

  // Selected evaluation for gate/ensemble display (first one from latest cycle)
  const [selectedEvalIdx, setSelectedEvalIdx] = useState(0);
  const evals = pipelineStatus?.recentEvaluations ?? [];
  const selectedEval = evals[selectedEvalIdx] ?? null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto pb-24 lg:pb-8">
      <motion.div variants={container} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Cloud className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Markets</h1>
              <p className="text-sm text-muted-foreground">Weather Ensemble Pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="Refresh">
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
            {pipelineRunning ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Cycle Active</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                <span className="text-xs font-medium text-muted-foreground">Idle</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard
            title="Portfolio"
            value={`$${totalValue.toFixed(2)}`}
            subtitle={`$${cashRemaining.toFixed(2)} cash`}
            icon={Wallet}
            trend={totalPnl >= 0 ? "up" : "down"}
            trendValue={`${totalPnl >= 0 ? "+" : ""}${totalPnlPct}%`}
            accentClass={totalPnl >= 0 ? "text-emerald-500" : "text-destructive"}
          />
          <StatCard
            title="Invested"
            value={`$${totalInvested.toFixed(2)}`}
            subtitle={`${positionCount} position${positionCount !== 1 ? "s" : ""}`}
            icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
            accentClass={totalInvested > 0 ? "text-primary" : "text-muted-foreground"}
          />
          <StatCard title="P&L" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`} subtitle="Realized" icon={Activity} accentClass={totalPnl >= 0 ? "text-emerald-500" : "text-destructive"} />
          <StatCard title="Open" value={positionCount.toString()} subtitle={`position${positionCount !== 1 ? "s" : ""} active`} icon={Target} />
        </motion.div>

        {/* Tabs */}
        <motion.div variants={item}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
            <TabsList variant="line" className="mb-4">
              <TabsTrigger value="overview"><BarChart3 className="h-3.5 w-3.5" />Overview</TabsTrigger>
              <TabsTrigger value="trades"><CircleDollarSign className="h-3.5 w-3.5" />Trades</TabsTrigger>
              <TabsTrigger value="pipeline"><GitBranch className="h-3.5 w-3.5" />Pipeline</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />Portfolio Value
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                            <XAxis dataKey="date" className="text-muted-foreground" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis domain={["dataMin - 10", "dataMax + 10"]} className="text-muted-foreground" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} fill="url(#portfolioGradient)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  {/* Bot Status */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />Pipeline Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5">Live</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Mode</span>
                        <span className="text-sm font-medium">Weather Ensemble</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Cycle</span>
                        <span className="text-sm font-medium">Every 2h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Strategy</span>
                        <span className="text-sm font-medium">Quarter-Kelly</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Min Edge</span>
                        <span className="text-sm font-medium">8%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Models</span>
                        <span className="text-sm font-medium text-sky-500">6+ ensemble (AI + physics)</span>
                      </div>
                      {pipelineStatus?.lessons && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Lessons</span>
                          <span className="text-sm font-medium">
                            {pipelineStatus.lessons.total} ({pipelineStatus.lessons.wins}W/{pipelineStatus.lessons.losses}L)
                          </span>
                        </div>
                      )}
                      <div className="pt-1 border-t border-border">
                        <p className="text-[11px] text-muted-foreground">
                          Last refresh: {lastRefresh.toLocaleTimeString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Risk Limits */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />Risk Limits
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                      {[
                        { label: "Daily Loss", used: Math.abs(portfolio?.todayPnl ?? 0), limit: portfolio?.dailyLossLimit ?? 13.1, unit: "$" },
                        { label: "Invested", used: totalInvested, limit: startingCapital, unit: "$" },
                      ].map((r) => {
                        const pct = r.limit > 0 ? Math.min((r.used / r.limit) * 100, 100) : 0;
                        return (
                          <div key={r.label}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{r.label}</span>
                              <span className="font-medium">{r.unit}{r.used.toFixed(r.unit === "$" ? 2 : 0)} / {r.unit}{r.limit.toFixed(r.unit === "$" ? 2 : 0)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pct > 80 ? "bg-destructive" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(pct, 1)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                  <BrierTrend data={data?.pnlTrend ?? lessonsData?.brierTrend ?? []} />
                  <CityPnl data={lessonsData?.cityPnl ?? []} />
                </div>
              </div>
              {/* Open Positions */}
              {(data?.positions?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <OpenPositions positions={data?.positions ?? []} />
                </div>
              )}
            </TabsContent>

            {/* Trades Tab */}
            <TabsContent value="trades">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CircleDollarSign className="h-4 w-4 text-primary" />
                    Trade History
                    {liveTrades.length > 0 && (
                      <span className="text-xs font-normal text-muted-foreground ml-auto">
                        {data?.trades.length} total ({liveTrades.length} live)
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!data?.trades.length ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <CircleDollarSign className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium mb-1">No trades yet</p>
                      <p className="text-xs text-muted-foreground max-w-[280px]">
                        The pipeline will place trades automatically when it finds weather mispricings.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.trades.map((trade) => {
                        const weather = parseWeatherMeta(trade.marketQuestion, trade.marketId);
                        return (
                          <Link
                            key={trade.id}
                            href={`/markets/trade/${trade.id}`}
                            className="block p-3 rounded-lg border border-border hover:bg-accent/50 hover:border-primary/20 transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {trade.marketQuestion || "Unknown Market"}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <Badge
                                    variant={trade.side === "BUY" ? "default" : "destructive"}
                                    className="text-[10px] h-4"
                                  >
                                    {trade.side}
                                  </Badge>
                                  {weather && (
                                    <>
                                      <Badge variant="outline" className="text-[10px] h-4 border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/5">
                                        <Thermometer className="h-2.5 w-2.5 mr-0.5" />
                                        {weather.city}
                                      </Badge>
                                      {weather.bucketValue && (
                                        <Badge variant="outline" className="text-[10px] h-4">
                                          {weather.bucketValue}{weather.unit}
                                        </Badge>
                                      )}
                                    </>
                                  )}
                                  <span className="text-[11px] text-muted-foreground">
                                    ${trade.amount.toFixed(2)}
                                    {trade.price ? ` @ ${(trade.price * 100).toFixed(0)}%` : ""}
                                  </span>
                                  {trade.edge && (
                                    <span className="text-[11px] text-emerald-500 font-medium">
                                      {(trade.edge * 100).toFixed(1)}% edge
                                    </span>
                                  )}
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                    <Clock className="h-2.5 w-2.5" />
                                    {formatTime(trade.timestamp)}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <Badge
                                  variant={trade.status === "filled" ? "default" : "outline"}
                                  className={`text-[10px] h-4 ${
                                    trade.dryRun ? "text-muted-foreground" : trade.status === "filled" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : ""
                                  }`}
                                >
                                  {trade.dryRun ? "Dry Run" : trade.status === "filled" ? "Filled" : trade.status}
                                </Badge>
                                {trade.sharesReceived && !trade.dryRun && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Payout: ${trade.sharesReceived.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pipeline Tab */}
            <TabsContent value="pipeline">
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <PipelineFlow
                    cycle={pipelineStatus?.latestCycle ?? null}
                    progress={progress}
                    onTrigger={handleTrigger}
                  />

                  <div className="space-y-4">
                    <EnsembleAgreement evaluation={selectedEval} />
                    <GateResults evaluation={selectedEval} />
                  </div>
                </div>

                {/* Evaluation selector */}
                {evals.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Evaluations:</span>
                    {evals.map((ev, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedEvalIdx(i)}
                        className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                          i === selectedEvalIdx
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        {ev.city} {ev.bucketValue}{tempUnit(ev.bucketValue)} {ev.side}
                      </button>
                    ))}
                  </div>
                )}

                <LlmDecisions evaluations={evals} />

                <CycleLog
                  cycles={pipelineStatus?.cycleHistory ?? []}
                  evaluationsByCycle={pipelineStatus?.evaluationsByCycle ?? {}}
                />

                {/* Fallback link when widget has no Q8 data */}
                {!evals.some((e) => e.q8Reasoning) && (
                  <div className="flex justify-end">
                    <Link
                      href="/markets/transcripts"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Brain className="h-3.5 w-3.5" />
                      View all LLM decisions
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  );
}
