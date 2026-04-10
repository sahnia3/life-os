"use client";

import { useState, useEffect, useCallback } from "react";
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
  ExternalLink,
  RefreshCw,
  Bot,
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
import { useAgentEvents, useAgentStatus } from "@/lib/hooks/use-agent-events";
import { AgentActivityFeed } from "@/components/markets/agent-activity-feed";
import { AgentOrgChart } from "@/components/markets/agent-org-chart";
import { CycleTimeline } from "@/components/markets/cycle-timeline";

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

interface Portfolio {
  totalValue: number;
  cash: number;
  invested: number;
  realizedPnl: number;
  positionCount: number;
  maxPositions: number;
  todayPnl: number;
  dailyLossLimit: number;
  maxPositionSize: number;
  startingCapital: number;
}

interface TradingData {
  trades: Trade[];
  snapshots: { timestamp: string; totalValue: number | null; cash: number | null; invested: number | null; dailyPnl: number | null }[];
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
  const d = new Date(timestamp + "Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(timestamp: string) {
  const d = new Date(timestamp + "Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const { events: agentEvents, isConnected: sseConnected } = useAgentEvents();
  const { status: agentStatus } = useAgentStatus();

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
    const interval = setInterval(fetchData, 30_000); // refresh every 30s
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

  // Build chart data from snapshots or fallback
  const chartData = data?.snapshots?.length
    ? data.snapshots.map((s) => ({ date: formatDate(s.timestamp), value: s.totalValue ?? startingCapital })).reverse()
    : [{ date: "Today", value: startingCapital }];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto pb-24 lg:pb-8">
      <motion.div variants={container} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Markets</h1>
              <p className="text-sm text-muted-foreground">Polymarket Trading Bot</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="Refresh">
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
            {agentStatus?.isRunning ? (
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
          <StatCard title="Open" value={positionCount.toString()} subtitle={`of ${portfolio?.maxPositions ?? 5} max`} icon={Target} />
        </motion.div>

        {/* Tabs */}
        <motion.div variants={item}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
            <TabsList variant="line" className="mb-4">
              <TabsTrigger value="overview"><BarChart3 className="h-3.5 w-3.5" />Overview</TabsTrigger>
              <TabsTrigger value="trades"><CircleDollarSign className="h-3.5 w-3.5" />Trades</TabsTrigger>
              <TabsTrigger value="agents">
                <Bot className="h-3.5 w-3.5" />
                Agents
                {sseConnected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </TabsTrigger>
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
                            <YAxis domain={["dataMin - 10", "dataMax + 10"]} className="text-muted-foreground" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
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
                        <Zap className="h-4 w-4 text-amber-500" />Bot Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5">Live</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Mode</span>
                        <span className="text-sm font-medium">Live Trading</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Cycle</span>
                        <span className="text-sm font-medium">Every 90m</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Strategy</span>
                        <span className="text-sm font-medium">Quarter-Kelly</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Min Edge</span>
                        <span className="text-sm font-medium">7%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Max Position</span>
                        <span className="text-sm font-medium">${(portfolio?.maxPositionSize ?? 19.65).toFixed(2)}</span>
                      </div>
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
                        { label: "Positions", used: positionCount, limit: portfolio?.maxPositions ?? 5, unit: "" },
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
                </div>
              </div>
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
                        The bot will place trades automatically once running in live mode.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.trades.map((trade) => (
                        <div
                          key={trade.id}
                          className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
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
                                <span className="text-[11px] text-muted-foreground">
                                  ${trade.amount.toFixed(2)}
                                  {trade.price ? ` @ ${(trade.price * 100).toFixed(0)}%` : ""}
                                </span>
                                {trade.sharesReceived && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {trade.sharesReceived} shares
                                  </span>
                                )}
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

                              {/* Analysis row */}
                              {trade.estimatedProb && trade.price && (
                                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                                  <span>Market: {((trade.price) * 100).toFixed(0)}%</span>
                                  <span>Estimate: {(trade.estimatedProb * 100).toFixed(0)}%</span>
                                  {trade.kellyPct && <span>Kelly: {(trade.kellyPct * 100).toFixed(1)}%</span>}
                                </div>
                              )}

                              {/* Links row */}
                              <div className="flex items-center gap-3 mt-2">
                                {trade.polygonscanUrl && (
                                  <a
                                    href={trade.polygonscanUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    View on Polygonscan
                                  </a>
                                )}
                                {trade.polymarketUrl && (
                                  <a
                                    href={trade.polymarketUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Polymarket
                                  </a>
                                )}
                                {trade.orderId && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    {trade.orderId.slice(0, 10)}...
                                  </span>
                                )}
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
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Agents Tab */}
            <TabsContent value="agents">
              <div className="space-y-4">
                {/* Agent Org Chart */}
                <AgentOrgChart
                  agents={agentStatus?.agents || []}
                  isRunning={agentStatus?.isRunning || false}
                />

                {/* Cycle Timeline */}
                <CycleTimeline
                  events={agentEvents}
                  isRunning={agentStatus?.isRunning || false}
                />

                {/* Cycle Info */}
                {agentStatus && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Total cycles: {agentStatus.totalCycles}</span>
                    <span>SSE: {sseConnected ? "Connected" : "Disconnected"}</span>
                    {agentStatus.isRunning && (
                      <Badge variant="outline" className="text-[10px] h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                        Cycle Running
                      </Badge>
                    )}
                  </div>
                )}

                {/* Activity Feed */}
                <AgentActivityFeed events={agentEvents} maxHeight="500px" isRunning={agentStatus?.isRunning || false} />
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  );
}
