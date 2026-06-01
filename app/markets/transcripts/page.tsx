"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Thermometer,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tempUnit } from "@/lib/utils";

interface Transcript {
  id: number;
  cycleId: string;
  timestamp: string;
  city: string;
  targetDate: string;
  bucketValue: number;
  side: string;
  ensembleProb: number;
  livePrice: number;
  liveEdge: number;
  q8Result: string;
  q8Reasoning: string;
  gateOutcome: string;
  tradeExecuted: boolean;
  rejectionReason: string | null;
}

interface Stats {
  total: number;
  pass: number;
  warn: number;
  block: number;
}

function ResultIcon({ result }: { result: string }) {
  if (result === "block") return <XCircle className="h-4 w-4 text-destructive" />;
  if (result === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
}

function resultBadgeClass(result: string) {
  if (result === "block") return "text-destructive border-destructive/30 bg-destructive/5";
  if (result === "warn") return "text-amber-600 border-amber-500/30 bg-amber-500/5";
  return "text-emerald-600 border-emerald-500/30 bg-emerald-500/5";
}

function formatTime(ts: string) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return (
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

function pct(v: number | null) {
  if (v === null || v === undefined) return "--";
  return `${(v * 100).toFixed(1)}%`;
}

export default function TranscriptsPage() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pipeline/transcripts")
      .then((r) => r.json())
      .then((data) => {
        setTranscripts(data.transcripts ?? []);
        setStats(data.stats ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
      {/* Back link */}
      <Link
        href="/markets"
        className="flex items-center gap-1.5 text-sm text-primary mb-6 hover:text-primary/80 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Markets
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">LLM Decisions</h1>
            <p className="text-sm text-muted-foreground">
              Gate Q8 weather context checks by Claude Haiku
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-emerald-500">{stats.pass}</p>
              <p className="text-[11px] text-muted-foreground">Pass</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-amber-500">{stats.warn}</p>
              <p className="text-[11px] text-muted-foreground">Warn</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-destructive">{stats.block}</p>
              <p className="text-[11px] text-muted-foreground">Block</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading / Empty */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Loading...</p>
      ) : transcripts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Brain className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">No LLM decisions yet</p>
            <p className="text-xs text-muted-foreground max-w-[320px] mx-auto">
              Gate Q8 reasoning will appear here after the next pipeline cycle with the LLM context check enabled.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {transcripts.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-4 pb-4">
                {/* Top row: city/bucket/side + result badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-xs h-5 border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/5"
                    >
                      <Thermometer className="h-3 w-3 mr-0.5" />
                      {t.city}
                    </Badge>
                    <Badge variant="outline" className="text-xs h-5">
                      {t.bucketValue}{tempUnit(t.bucketValue)}
                    </Badge>
                    <Badge
                      variant={t.side.includes("NO") ? "destructive" : "default"}
                      className="text-xs h-5"
                    >
                      {t.side}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.tradeExecuted && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                      >
                        <Zap className="h-2.5 w-2.5 mr-0.5" />
                        Traded
                      </Badge>
                    )}
                    {!t.tradeExecuted && t.gateOutcome === "REJECTED" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 text-destructive border-destructive/30 bg-destructive/5"
                      >
                        <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
                        Rejected
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-xs h-5 ${resultBadgeClass(t.q8Result)}`}>
                      <ResultIcon result={t.q8Result} />
                      <span className="ml-1">Q8 {t.q8Result.toUpperCase()}</span>
                    </Badge>
                  </div>
                </div>

                {/* Reasoning */}
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  {t.q8Reasoning}
                </p>

                {/* Metrics row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/50">
                  <span>Edge: <span className="font-medium text-foreground">{pct(t.liveEdge)}</span></span>
                  <span>Ensemble: <span className="font-medium text-foreground">{pct(t.ensembleProb)}</span></span>
                  <span>Market: <span className="font-medium text-foreground">{pct(t.livePrice)}</span></span>
                  <span className="ml-auto">{formatTime(t.timestamp)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
