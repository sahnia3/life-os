"use client";

import { useState } from "react";
import { Cloud, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PipelineEvaluation } from "@/lib/hooks/use-pipeline";


export function EnsembleAgreement({ evaluation }: { evaluation: PipelineEvaluation | null }) {
  if (!evaluation) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Cloud className="h-4 w-4 text-sky-500" />
            Ensemble Agreement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
        </CardContent>
      </Card>
    );
  }

  const { ensembleMean, ensembleStd, ensembleMembers, ensembleRange, modelSpread, bucketValue, side, ensembleProb, livePrice, liveEdge } = evaluation;
  const spreadOk = modelSpread <= 3.0;
  const isFahrenheit = bucketValue != null && bucketValue > 50;
  const marketUnit = isFahrenheit ? "°F" : "°C";
  // Ensemble data is always °C; convert bucket for chart positioning
  const bucketC = isFahrenheit && bucketValue != null ? Math.round((bucketValue - 32) * 5 / 9) : bucketValue;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Cloud className="h-4 w-4 text-sky-500" />
          Ensemble
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {evaluation.city} {evaluation.targetDate}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Key metrics row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold">{ensembleMean?.toFixed(1)}°C</p>
            <p className="text-[10px] text-muted-foreground">Mean</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">±{ensembleStd?.toFixed(1)}°C</p>
            <p className="text-[10px] text-muted-foreground">Std Dev</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{ensembleMembers}</p>
            <p className="text-[10px] text-muted-foreground">Members</p>
          </div>
        </div>

        {/* Range bar */}
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{ensembleRange.min}°C</span>
            <span>Range: {(ensembleRange.max - ensembleRange.min).toFixed(1)}°C</span>
            <span>{ensembleRange.max}°C</span>
          </div>
          <div className="relative h-6 rounded-full bg-muted overflow-hidden">
            {/* Bucket indicator */}
            {bucketC != null && ensembleRange.min != null && ensembleRange.max != null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                style={{
                  left: `${Math.min(100, Math.max(0, ((bucketC - ensembleRange.min) / (ensembleRange.max - ensembleRange.min)) * 100))}%`,
                }}
                title={`Bucket: ${bucketValue}${marketUnit}`}
              />
            )}
            {/* Mean indicator */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-amber-500 rounded-full z-10"
              style={{
                left: `${Math.min(100, Math.max(0, ((ensembleMean - ensembleRange.min) / (ensembleRange.max - ensembleRange.min)) * 100))}%`,
              }}
              title={`Mean: ${ensembleMean?.toFixed(1)}°C`}
            />
            {/* Fill showing ±1 std around mean */}
            <div
              className="absolute top-1 bottom-1 rounded-full bg-sky-500/30"
              style={{
                left: `${Math.max(0, (((ensembleMean - ensembleStd) - ensembleRange.min) / (ensembleRange.max - ensembleRange.min)) * 100)}%`,
                right: `${Math.max(0, 100 - (((ensembleMean + ensembleStd) - ensembleRange.min) / (ensembleRange.max - ensembleRange.min)) * 100)}%`,
              }}
            />
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-amber-500 rounded" /> Mean</span>
            <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-primary rounded" /> Bucket ({bucketValue}{marketUnit})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-sky-500/30 rounded" /> ±1σ</span>
          </div>
        </div>

        {/* Model spread & edge */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Model spread</span>
            <span className={`font-medium ${spreadOk ? "text-emerald-500" : "text-destructive"}`}>
              {modelSpread?.toFixed(1)}°C
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Ensemble prob</span>
            <span className="font-medium">{(ensembleProb * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Market price</span>
            <span className="font-medium">{(livePrice * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Live edge</span>
            <span className={`font-medium ${liveEdge >= 0.08 ? "text-emerald-500" : "text-amber-500"}`}>
              {(liveEdge * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Per-model breakdown */}
        {evaluation.models && evaluation.models.length > 0 && (
          <ModelBreakdown models={evaluation.models} bucketC={bucketC} />
        )}
      </CardContent>
    </Card>
  );
}

function ModelBreakdown({ models, bucketC }: { models: { name: string; mean: number; members: number }[]; bucketC: number | null }) {
  const [expanded, setExpanded] = useState(false);
  const AI_MODELS = ["ecmwf_aifs025", "ecmwf_aifs_025", "aigefs_025", "ncep_aigfs_025", "ncep_gfs_graphcast"];
  const sorted = [...models].sort((a, b) => b.members - a.members);

  return (
    <div className="pt-2 border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        <span>Models ({models.length})</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {sorted.map((m) => {
            const isAI = AI_MODELS.some((ai) => m.name.includes(ai) || ai.includes(m.name));
            const agreesWithBucket = bucketC != null && Math.abs(m.mean - bucketC) <= 1.0;
            return (
              <div key={m.name} className="flex items-center gap-2 text-[11px]">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${agreesWithBucket ? "bg-emerald-500" : "bg-destructive"}`} />
                <span className="font-mono text-muted-foreground truncate flex-1">{m.name.replace(/_/g, " ")}</span>
                {isAI && <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-violet-500 border-violet-500/30">AI</Badge>}
                <span className="font-medium tabular-nums">{m.mean.toFixed(1)}°C</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
