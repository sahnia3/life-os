"use client";

import { motion } from "framer-motion";
import {
  Search,
  BookOpen,
  Eye,
  Layers,
  Shield,
  Zap,
  CheckCircle2,
  Loader2,
  Circle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentEvent } from "@/lib/hooks/use-agent-events";

interface Phase {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  agents: string[];
  color: string;
}

const PHASES: Phase[] = [
  { id: "scan", label: "Scan", icon: Search, agents: ["market_scanner"], color: "text-blue-500" },
  { id: "research", label: "Research", icon: BookOpen, agents: ["researcher"], color: "text-purple-500" },
  { id: "estimate", label: "Estimate", icon: Eye, agents: ["estimator_a", "estimator_b", "estimator_c", "estimator_d"], color: "text-emerald-500" },
  { id: "aggregate", label: "Aggregate", icon: Layers, agents: ["aggregator"], color: "text-amber-500" },
  { id: "risk", label: "Risk", icon: Shield, agents: ["risk_manager"], color: "text-red-500" },
  { id: "trade", label: "Trade", icon: Zap, agents: ["trader"], color: "text-cyan-500" },
];

function getPhaseStatus(
  phase: Phase,
  events: AgentEvent[]
): "idle" | "running" | "completed" | "error" {
  const phaseEvents = events.filter((e) => phase.agents.includes(e.agentName));
  if (phaseEvents.length === 0) return "idle";

  const hasError = phaseEvents.some((e) => e.eventType === "error");
  const hasCompleted = phaseEvents.some((e) => e.eventType === "completed");

  if (hasCompleted) return "completed";
  if (hasError && !hasCompleted) return "error";

  const hasStarted = phaseEvents.some(
    (e) => e.eventType === "started" || e.eventType === "progress" || e.eventType === "thinking"
  );
  if (hasStarted) return "running";

  return "idle";
}

interface CycleTimelineProps {
  events: AgentEvent[];
  isRunning: boolean;
}

export function CycleTimeline({ events, isRunning }: CycleTimelineProps) {
  // Only show cycle progress for the active cycle; reset to idle when nothing is running
  const latestCycleId = events.length > 0 ? events[events.length - 1]?.cycleId : null;
  const cycleEvents = isRunning && latestCycleId
    ? events.filter((e) => e.cycleId === latestCycleId)
    : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Loader2 className={`h-4 w-4 text-primary ${isRunning ? "animate-spin" : ""}`} />
          Cycle Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-0.5">
          {PHASES.map((phase, i) => {
            const status = getPhaseStatus(phase, cycleEvents);
            const Icon = phase.icon;

            const StatusIcon =
              status === "completed"
                ? CheckCircle2
                : status === "running"
                  ? Loader2
                  : Circle;

            const statusColor =
              status === "completed"
                ? "text-emerald-500"
                : status === "running"
                  ? "text-amber-500"
                  : status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground/40";

            const bgColor =
              status === "completed"
                ? "bg-emerald-500/10 border-emerald-500/30"
                : status === "running"
                  ? "bg-amber-500/10 border-amber-500/30"
                  : status === "error"
                    ? "bg-destructive/10 border-destructive/30"
                    : "bg-muted/30 border-border";

            return (
              <div key={phase.id} className="flex items-center flex-1">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border ${bgColor} flex-1 transition-all duration-300`}
                >
                  <div className="relative">
                    <Icon className={`h-3.5 w-3.5 ${status !== "idle" ? phase.color : "text-muted-foreground/40"}`} />
                    <StatusIcon
                      className={`absolute -top-1 -right-1.5 h-2.5 w-2.5 ${statusColor} ${
                        status === "running" ? "animate-spin" : ""
                      }`}
                    />
                  </div>
                  <span className={`text-[9px] font-medium leading-tight ${
                    status !== "idle" ? "text-foreground" : "text-muted-foreground/50"
                  }`}>
                    {phase.label}
                  </span>
                </motion.div>

                {i < PHASES.length - 1 && (
                  <div className={`w-2 h-px mx-0.5 ${
                    status === "completed" ? "bg-emerald-500" : "bg-border"
                  } transition-colors duration-300`} />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
