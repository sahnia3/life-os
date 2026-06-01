"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Cloud,
  TrendingUp,
  GitBranch,
  Radio,
  Target,
  ShieldCheck,
  BarChart3,
  Calculator,
  Zap,
  Play,
  Loader2,
  Brain,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PipelineCycle } from "@/lib/hooks/use-pipeline";
import type { PipelineProgress } from "@/lib/hooks/use-pipeline";
import { tempUnit } from "@/lib/utils";

const STAGES = [
  { id: "scan", label: "Market Scan", icon: Search, color: "text-blue-500", bg: "bg-blue-500/10", activeBg: "bg-blue-500/30" },
  { id: "ensemble", label: "Ensemble Fetch", icon: Cloud, color: "text-sky-500", bg: "bg-sky-500/10", activeBg: "bg-sky-500/30", detail: "6+ models (AI + physics)" },
  { id: "distribution", label: "Student-t Fit", icon: TrendingUp, color: "text-violet-500", bg: "bg-violet-500/10", activeBg: "bg-violet-500/30", detail: "Continuous CDF (df=7)" },
  { id: "deterministic", label: "Deterministic CV", icon: GitBranch, color: "text-purple-500", bg: "bg-purple-500/10", activeBg: "bg-purple-500/30", detail: "7-10 model cross-check" },
  { id: "metar", label: "METAR Fetch", icon: Radio, color: "text-teal-500", bg: "bg-teal-500/10", activeBg: "bg-teal-500/30", detail: "Airport observations" },
  { id: "mispricing", label: "Mispricing Detect", icon: Target, color: "text-amber-500", bg: "bg-amber-500/10", activeBg: "bg-amber-500/30" },
  { id: "gates", label: "Counter-Question Gate", icon: ShieldCheck, color: "text-red-500", bg: "bg-red-500/10", activeBg: "bg-red-500/30", detail: "8 checks (incl. LLM)" },
  { id: "depth", label: "Orderbook Depth", icon: BarChart3, color: "text-orange-500", bg: "bg-orange-500/10", activeBg: "bg-orange-500/30" },
  { id: "sizing", label: "Position Sizing", icon: Calculator, color: "text-emerald-500", bg: "bg-emerald-500/10", activeBg: "bg-emerald-500/30", detail: "Quarter-Kelly" },
  { id: "execute", label: "Execute Trade", icon: Zap, color: "text-primary", bg: "bg-primary/10", activeBg: "bg-primary/30" },
];

export function PipelineFlow({
  cycle,
  progress,
  onTrigger,
}: {
  cycle: PipelineCycle | null;
  progress?: PipelineProgress | null;
  onTrigger?: () => void;
}) {
  const isRunning = progress?.status === "running" || progress?.status === "starting";
  const completed = progress?.completedStages ?? [];
  const currentStage = progress?.currentStage;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active stage
  useEffect(() => {
    if (currentStage && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-stage="${currentStage}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentStage]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          Pipeline Flow
          {isRunning ? (
            <span className="text-xs font-normal text-emerald-500 ml-auto flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {progress?.detail || "Running..."}
            </span>
          ) : cycle ? (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              Last cycle: {cycle.eventsScanned} events, {cycle.opportunitiesFound} opportunities, {cycle.tradesExecuted} trades
            </span>
          ) : null}
          {onTrigger && !isRunning && (
            <button
              onClick={onTrigger}
              className="ml-2 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
              title="Trigger a new cycle"
            >
              <Play className="h-3.5 w-3.5 text-primary" />
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1" ref={scrollRef}>
          {STAGES.map((stage, i) => {
            const Icon = stage.icon;
            const isActive = currentStage === stage.id;
            const isDone = completed.includes(stage.id);
            return (
              <motion.div
                key={stage.id}
                data-stage={stage.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className={`flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary/10 border border-primary/30"
                    : isDone && isRunning
                      ? "bg-emerald-500/5"
                      : "hover:bg-accent/50"
                }`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive ? stage.activeBg : stage.bg
                  }`}>
                    {isActive ? (
                      <Loader2 className={`h-3.5 w-3.5 ${stage.color} animate-spin`} />
                    ) : (
                      <Icon className={`h-3.5 w-3.5 ${stage.color} ${isDone && isRunning ? "opacity-100" : ""}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${isDone && isRunning ? "text-emerald-500" : ""}`}>
                      {stage.label}
                    </span>
                    {stage.detail && (
                      <span className="text-[11px] text-muted-foreground ml-2">{stage.detail}</span>
                    )}
                  </div>
                  {isDone && isRunning && (
                    <span className="text-emerald-500 text-xs">&#10003;</span>
                  )}
                  {!isDone && !isActive && i < STAGES.length - 1 && (
                    <div className="text-muted-foreground/30 text-xs">&#8594;</div>
                  )}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`ml-[22px] h-2 border-l ${
                    isDone && isRunning ? "border-emerald-500/50" : "border-border/50"
                  }`} />
                )}
              </motion.div>
            );
          })}
        </div>

        {progress?.q8 && isRunning && (
          <div className="mt-2 px-3 py-2.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
            <div className="flex items-center gap-2">
              <Brain className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-violet-500">Q8 LLM</span>
              {progress.q8.city && (
                <span className="text-[11px] text-muted-foreground">
                  {progress.q8.city} {progress.q8.bucket}{tempUnit(progress.q8.bucket)} {progress.q8.side}
                </span>
              )}
              <Badge
                variant="outline"
                className={`text-[10px] h-4 ml-auto ${
                  progress.q8.result === "block"
                    ? "text-destructive border-destructive/30 bg-destructive/5"
                    : progress.q8.result === "warn"
                      ? "text-amber-600 border-amber-500/30 bg-amber-500/5"
                      : "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                }`}
              >
                {progress.q8.result.toUpperCase()}
              </Badge>
            </div>
            {progress.q8.reasoning && (
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                {progress.q8.reasoning}
              </p>
            )}
          </div>
        )}

        {progress?.status === "completed" && progress?.result && (() => {
          const r = progress.result;
          const events = Number(r.events_scanned ?? 0);
          const opps = Number(r.opportunities_found ?? 0);
          const trades = Array.isArray(r.trades) ? r.trades.length : 0;
          return (
            <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-medium">Cycle complete</span>
                <span>{events} events scanned</span>
                <span className="text-muted-foreground/50">|</span>
                <span>{opps} opportunities</span>
                <span className="text-muted-foreground/50">|</span>
                <span className={trades > 0 ? "text-emerald-500 font-medium" : ""}>
                  {trades} trades executed
                </span>
              </div>
            </div>
          );
        })()}
        {progress?.status === "error" && progress?.error && (
          <div className="mt-3 pt-3 border-t border-destructive/30 text-xs text-destructive">
            Error: {progress.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
