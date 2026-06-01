"use client";

import { useState } from "react";
import Link from "next/link";
import { Brain, CheckCircle2, AlertTriangle, XCircle, Thermometer, ArrowUpRight, Zap, ShieldCheck, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PipelineEvaluation } from "@/lib/hooks/use-pipeline";
import { tempUnit } from "@/lib/utils";

function ResultIcon({ result }: { result: string }) {
  if (result === "block") return <XCircle className="h-3 w-3 text-destructive" />;
  if (result === "warn") return <AlertTriangle className="h-3 w-3 text-amber-500" />;
  return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
}

function resultClass(result: string) {
  if (result === "block") return "text-destructive border-destructive/30 bg-destructive/5";
  if (result === "warn") return "text-amber-600 border-amber-500/30 bg-amber-500/5";
  return "text-emerald-600 border-emerald-500/30 bg-emerald-500/5";
}

function DecisionCard({ ev, index }: { ev: PipelineEvaluation; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div
      className={`rounded-lg border transition-colors ${
        ev.gates.q8 === "block"
          ? "border-destructive/20 bg-destructive/5"
          : ev.gates.q8 === "warn"
            ? "border-amber-500/20 bg-amber-500/5"
            : "border-border"
      }`}
    >
      {/* Clickable header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3 flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <Badge variant="outline" className="text-[10px] h-4 border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/5">
            <Thermometer className="h-2.5 w-2.5 mr-0.5" />
            {ev.city}
          </Badge>
          <Badge variant="outline" className="text-[10px] h-4">
            {ev.bucketValue}{tempUnit(ev.bucketValue)}
          </Badge>
          <Badge
            variant={ev.side.includes("NO") ? "destructive" : "default"}
            className="text-[10px] h-4"
          >
            {ev.side}
          </Badge>
          {ev.tradeExecuted && (
            <Badge variant="outline" className="text-[10px] h-4 text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              Traded
            </Badge>
          )}
          {!ev.tradeExecuted && ev.gateOutcome === "REJECTED" && (
            <Badge variant="outline" className="text-[10px] h-4 text-destructive border-destructive/30 bg-destructive/5">
              <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
              Rejected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Badge variant="outline" className={`text-[10px] h-4 ${resultClass(ev.gates.q8)}`}>
            <ResultIcon result={ev.gates.q8} />
            <span className="ml-0.5">{ev.gates.q8?.toUpperCase()}</span>
          </Badge>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Expandable reasoning */}
      {expanded && (
        <div className="px-3 pb-3 -mt-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {ev.q8Reasoning}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            <span>Edge: <span className="font-medium text-foreground">{(ev.liveEdge * 100).toFixed(1)}%</span></span>
            <span>Ensemble: <span className="font-medium text-foreground">{(ev.ensembleProb * 100).toFixed(1)}%</span></span>
            <span>Market: <span className="font-medium text-foreground">{(ev.livePrice * 100).toFixed(1)}%</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

export function LlmDecisions({ evaluations }: { evaluations: PipelineEvaluation[] }) {
  const withQ8 = evaluations.filter((e) => e.q8Reasoning);

  if (!withQ8.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" />
          LLM Decisions
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {withQ8.length} check{withQ8.length !== 1 ? "s" : ""} this cycle
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {withQ8.map((ev, i) => (
          <DecisionCard key={i} ev={ev} index={i} />
        ))}

        <Link
          href="/markets/transcripts"
          className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors rounded-lg border border-primary/20 hover:border-primary/40 hover:bg-primary/5 py-2.5 mt-1"
        >
          <Brain className="h-3.5 w-3.5" />
          View all LLM decisions
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
