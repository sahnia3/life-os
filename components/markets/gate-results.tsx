"use client";

import { CheckCircle2, AlertTriangle, XCircle, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import type { PipelineEvaluation } from "@/lib/hooks/use-pipeline";
import { tempUnit } from "@/lib/utils";

const GATE_INFO: Record<string, { label: string; description: string }> = {
  q1: { label: "Q1", description: "Deterministic Agreement" },
  q2: { label: "Q2", description: "Ensemble Spread" },
  q3: { label: "Q3", description: "Low Probability Filter" },
  q3b: { label: "Q3b", description: "Off-by-One Risk" },
  q4: { label: "Q4", description: "Price Drift" },
  q5: { label: "Q5", description: "Horizon Freshness" },
  q6: { label: "Q6", description: "Duplicate Position" },
  q7: { label: "Q7", description: "METAR Sanity" },
  q8: { label: "Q8", description: "LLM Weather Context" },
};

function GateIcon({ result }: { result: string }) {
  if (result === "block") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (result === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
}

export function GateResults({ evaluation }: { evaluation: PipelineEvaluation | null }) {
  if (!evaluation) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-red-500" />
            Counter-Questioning Gate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No evaluations yet</p>
        </CardContent>
      </Card>
    );
  }

  const gates = evaluation.gates;
  const gateEntries = Object.entries(gates) as [string, string][];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-red-500" />
          Gate Results
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {evaluation.city} {evaluation.bucketValue}{tempUnit(evaluation.bucketValue)} {evaluation.side}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Badge
            variant="outline"
            className={
              evaluation.gateOutcome === "REJECTED"
                ? "text-destructive border-destructive/30 bg-destructive/5"
                : evaluation.gateOutcome === "WARNED"
                  ? "text-amber-600 border-amber-500/30 bg-amber-500/5"
                  : "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
            }
          >
            {evaluation.gateOutcome}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {evaluation.gateWarnings} warning{evaluation.gateWarnings !== 1 ? "s" : ""}, {evaluation.gateBlocks} block{evaluation.gateBlocks !== 1 ? "s" : ""}
          </span>
          {evaluation.rejectionReason && (
            <span className="text-xs text-destructive truncate ml-auto max-w-[200px]" title={evaluation.rejectionReason}>
              {evaluation.rejectionReason}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {gateEntries.map(([key, result]) => {
            const info = GATE_INFO[key];
            if (!info) return null;
            return (
              <div
                key={key}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
                  result === "block"
                    ? "border-destructive/20 bg-destructive/5"
                    : result === "warn"
                      ? "border-amber-500/20 bg-amber-500/5"
                      : "border-border bg-background"
                }`}
              >
                <GateIcon result={result} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold">{info.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{info.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {evaluation.metar && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium">METAR {evaluation.metar.icao}</span>
            <span>Latest: {evaluation.metar.latestTemp}°C</span>
            <span>Max today: {evaluation.metar.maxObserved}°C</span>
          </div>
        )}

        {evaluation.q8Reasoning && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 mb-1.5">
              <Brain className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-xs font-semibold">LLM Weather Context</span>
              <Badge
                variant="outline"
                className={`text-[10px] h-4 ${
                  evaluation.gates.q8 === "block"
                    ? "text-destructive border-destructive/30 bg-destructive/5"
                    : evaluation.gates.q8 === "warn"
                      ? "text-amber-600 border-amber-500/30 bg-amber-500/5"
                      : "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                }`}
              >
                {evaluation.gates.q8?.toUpperCase() ?? "PASS"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {evaluation.q8Reasoning}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
