"use client";

import { useState } from "react";
import { Clock, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PipelineCycle, PipelineEvaluation } from "@/lib/hooks/use-pipeline";

function formatCycleTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    OK: { label: "OK", className: "text-emerald-600 border-emerald-500/30 bg-emerald-500/5" },
    NO_EDGE: { label: "No Edge", className: "text-muted-foreground border-border bg-muted/50" },
    NO_MARKETS: { label: "No Markets", className: "text-muted-foreground border-border bg-muted/50" },
    KILLED: { label: "Killed", className: "text-destructive border-destructive/30 bg-destructive/5" },
    LOW_BALANCE: { label: "Low Balance", className: "text-amber-600 border-amber-500/30 bg-amber-500/5" },
    ERROR: { label: "Error", className: "text-destructive border-destructive/30 bg-destructive/5" },
  };
  const info = map[status] || { label: status, className: "text-muted-foreground border-border" };
  return <Badge variant="outline" className={`text-[10px] h-4 ${info.className}`}>{info.label}</Badge>;
}

const INITIAL_EVAL_COUNT = 5;

function EvalList({ evaluations }: { evaluations: PipelineEvaluation[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? evaluations : evaluations.slice(0, INITIAL_EVAL_COUNT);
  const hasMore = evaluations.length > INITIAL_EVAL_COUNT;

  return (
    <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
      {visible.map((ev, j) => (
        <div key={j} className="flex items-center gap-2 text-[11px]">
          {ev.gateOutcome === "REJECTED" ? (
            <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
          ) : ev.tradeExecuted ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
          )}
          <span className="font-medium">{ev.city}</span>
          <span className="text-muted-foreground">{ev.bucketValue}° {ev.side}</span>
          <span className={ev.liveEdge >= 0.08 ? "text-emerald-500" : "text-muted-foreground"}>
            {(ev.liveEdge * 100).toFixed(1)}% edge
          </span>
          <span className="text-muted-foreground ml-auto truncate max-w-[160px]">
            {ev.tradeExecuted
              ? `Executed $${ev.tradeAmount?.toFixed(2)}`
              : ev.rejectionReason || ""}
          </span>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[11px] text-primary hover:text-primary/80 font-medium mt-1 transition-colors"
        >
          {showAll ? "Show less" : `See all ${evaluations.length} evaluations`}
        </button>
      )}
    </div>
  );
}

export function CycleLog({
  cycles,
  evaluationsByCycle,
}: {
  cycles: PipelineCycle[];
  evaluationsByCycle: Record<string, PipelineEvaluation[]>;
}) {
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(
    () => new Set(cycles.length > 0 ? [cycles[0].cycleId] : [])
  );

  const toggleCycle = (cycleId: string) => {
    setExpandedCycles((prev) => {
      const next = new Set(prev);
      if (next.has(cycleId)) next.delete(cycleId);
      else next.add(cycleId);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Cycle History
          {cycles.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {cycles.length} cycle{cycles.length !== 1 ? "s" : ""}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cycles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No cycles recorded yet</p>
        ) : (
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {cycles.map((cycle) => {
              const isExpanded = expandedCycles.has(cycle.cycleId);
              const cycleEvals = evaluationsByCycle[cycle.cycleId] ?? [];
              const hasEvals = cycleEvals.length > 0;
              const executedCount = cycleEvals.filter((e) => e.tradeExecuted).length;
              const rejectedCount = cycleEvals.filter((e) => e.gateOutcome === "REJECTED").length;

              return (
                <div
                  key={cycle.cycleId}
                  className={`rounded-lg border transition-colors ${
                    isExpanded ? "border-primary/20 bg-primary/5" : "border-border hover:bg-accent/50"
                  }`}
                >
                  <button
                    onClick={() => hasEvals && toggleCycle(cycle.cycleId)}
                    className="w-full p-2.5 flex items-center justify-between gap-2 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {hasEvals ? (
                        isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )
                      ) : (
                        <div className="w-3" />
                      )}
                      <StatusBadge status={cycle.status} />
                      <span className="text-xs text-muted-foreground">
                        {formatCycleTime(cycle.startedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-shrink-0">
                      <span>{cycle.eventsScanned} events</span>
                      <span>{cycle.opportunitiesFound} opps</span>
                      {executedCount > 0 ? (
                        <span className="text-emerald-500 font-medium">
                          {executedCount} trade{executedCount !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span>0 trades</span>
                      )}
                      {rejectedCount > 0 && (
                        <span className="text-destructive/70">
                          {rejectedCount} rejected
                        </span>
                      )}
                      {cycle.dryRun && <Badge variant="outline" className="text-[9px] h-3.5">DRY</Badge>}
                    </div>
                  </button>

                  {isExpanded && hasEvals && (
                    <div className="px-2.5 pb-2.5">
                      <EvalList evaluations={cycleEvals} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
