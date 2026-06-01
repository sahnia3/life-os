"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Thermometer,
  Clock,
  Brain,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TradeDetail {
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
  resolved: boolean;
  pnl: number | null;
  brierScore: number | null;
  category: string | null;
  txHash: string | null;
  orderId: string | null;
  sharesReceived: number | null;
  polymarketUrl: string | null;
  polygonscanUrl: string | null;
  responseData: Record<string, unknown> | null;
}

interface EvalDetail {
  cycleId: string;
  timestamp: string;
  city: string;
  targetDate: string;
  bucketValue: number;
  side: string;
  ensembleProb: number;
  livePrice: number;
  liveEdge: number;
  ensembleMean: number;
  ensembleStd: number;
  modelSpread: number;
  gates: Record<string, string>;
  q8Reasoning: string | null;
  gateOutcome: string;
  rejectionReason: string | null;
}

const GATE_LABELS: Record<string, string> = {
  q1: "Deterministic",
  q2: "Ensemble Spread",
  q3: "Low Prob Filter",
  q3b: "Off-by-One",
  q4: "Price Drift",
  q5: "Horizon",
  q6: "Duplicate Pos",
  q7: "METAR Sanity",
  q8: "LLM Context",
};

function GateIcon({ result }: { result: string }) {
  if (result === "block") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (result === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function pct(v: number | null) {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

export default function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [trade, setTrade] = useState<TradeDetail | null>(null);
  const [evaluation, setEvaluation] = useState<EvalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    fetch(`/api/trades/${resolvedParams.id}`)
      .then((r) => r.json())
      .then((data) => {
        setTrade(data.trade);
        setEvaluation(data.evaluation ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/markets" className="flex items-center gap-1.5 text-sm text-primary mb-6 hover:text-primary/80">
          <ArrowLeft className="h-4 w-4" />Back to Markets
        </Link>
        <p className="text-sm text-muted-foreground">Trade not found.</p>
      </div>
    );
  }

  const cityMatch = trade.marketQuestion?.match(/temperature in (\w[\w\s]*?) (?:be|on)/i);
  const city = cityMatch?.[1]?.trim();
  const bucketMatch = trade.marketQuestion?.match(/(\d+)\s*°?\s*([CF])/i);
  const bucket = bucketMatch ? parseInt(bucketMatch[1]) : null;
  const unit = bucketMatch?.[2]?.toUpperCase() === "F" ? "°F" : "°C";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
      {/* Back link */}
      <Link href="/markets" className="flex items-center gap-1.5 text-sm text-primary mb-6 hover:text-primary/80 transition-colors">
        <ArrowLeft className="h-4 w-4" />Back to Markets
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge variant={trade.side === "BUY" ? "default" : "destructive"} className="text-xs h-5">
            {trade.side}
          </Badge>
          {city && (
            <Badge variant="outline" className="text-xs h-5 border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/5">
              <Thermometer className="h-3 w-3 mr-0.5" />
              {city}
            </Badge>
          )}
          {bucket && <Badge variant="outline" className="text-xs h-5">{bucket}{unit}</Badge>}
          <Badge
            variant="outline"
            className={`text-xs h-5 ${
              trade.resolved
                ? (trade.pnl ?? 0) > 0
                  ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                  : "text-destructive border-destructive/30 bg-destructive/5"
                : trade.dryRun
                  ? "text-muted-foreground"
                  : "text-amber-600 border-amber-500/30 bg-amber-500/5"
            }`}
          >
            {trade.resolved ? (trade.pnl ?? 0) > 0 ? "Won" : "Lost" : trade.dryRun ? "Dry Run" : "Open"}
          </Badge>
        </div>
        <h1 className="text-lg font-semibold leading-snug">{trade.marketQuestion || "Unknown Market"}</h1>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTime(trade.timestamp)}
          {evaluation?.cycleId && (
            <span className="ml-2 text-muted-foreground/70">Cycle: {evaluation.cycleId}</span>
          )}
        </p>
      </div>

      {/* Trade details + Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Trade Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Amount", `$${trade.amount.toFixed(2)}`],
              ["Entry Price", pct(trade.price)],
              ["Estimated Prob", pct(trade.estimatedProb)],
              ["Edge", pct(trade.edge)],
              ["Kelly %", pct(trade.kellyPct)],
              ...(trade.sharesReceived ? [["Shares Received", trade.sharesReceived.toLocaleString()]] : []),
              ...(trade.resolved ? [["P&L", `${(trade.pnl ?? 0) >= 0 ? "+" : ""}$${(trade.pnl ?? 0).toFixed(2)}`]] : []),
              ...(trade.brierScore !== null && trade.brierScore !== undefined ? [["Brier Score", trade.brierScore.toFixed(4)]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trade.polymarketUrl && (
              <a
                href={trade.polymarketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />Polymarket Event
              </a>
            )}
            {trade.polygonscanUrl && (
              <a
                href={trade.polygonscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />Polygonscan Transaction
              </a>
            )}
            {trade.orderId && (
              <div className="text-xs text-muted-foreground">
                <span className="text-muted-foreground/70">Order ID:</span>{" "}
                <span className="font-mono">{trade.orderId}</span>
              </div>
            )}
            {trade.tokenId && (
              <div className="text-xs text-muted-foreground">
                <span className="text-muted-foreground/70">Token:</span>{" "}
                <span className="font-mono text-[10px]">{trade.tokenId.slice(0, 20)}...</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline evaluation */}
      {evaluation && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pipeline Evaluation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
              <div>
                <span className="text-muted-foreground block">Ensemble Mean</span>
                <span className="font-medium text-sm">{evaluation.ensembleMean?.toFixed(1)}°C</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Ensemble Std</span>
                <span className="font-medium text-sm">{evaluation.ensembleStd?.toFixed(2)}°C</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Model Spread</span>
                <span className="font-medium text-sm">{evaluation.modelSpread?.toFixed(1)}°C</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Live Edge</span>
                <span className="font-medium text-sm text-emerald-500">{pct(evaluation.liveEdge)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
              {Object.entries(evaluation.gates).map(([key, result]) => {
                const label = GATE_LABELS[key] ?? key;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs ${
                      result === "block"
                        ? "border-destructive/20 bg-destructive/5"
                        : result === "warn"
                          ? "border-amber-500/20 bg-amber-500/5"
                          : "border-border"
                    }`}
                  >
                    <GateIcon result={result} />
                    <span className="truncate">{label}</span>
                  </div>
                );
              })}
            </div>

            {evaluation.q8Reasoning && (
              <div className="pt-3 border-t border-border">
                <div className="flex items-center gap-2 mb-1.5">
                  <Brain className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs font-semibold">LLM Weather Context</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {evaluation.q8Reasoning}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Raw response collapsible */}
      {trade.responseData && (
        <Card>
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="w-full px-6 py-3 flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Raw Response Data
            <ChevronDown className={`h-4 w-4 transition-transform ${showRaw ? "rotate-180" : ""}`} />
          </button>
          {showRaw && (
            <CardContent className="pt-0">
              <pre className="text-[10px] bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-64">
                {JSON.stringify(trade.responseData, null, 2)}
              </pre>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
