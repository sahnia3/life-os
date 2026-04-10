"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BarChart3,
  MessageSquare,
  Shield,
  Zap,
  Brain,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentEvent } from "@/lib/hooks/use-agent-events";

const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  orchestrator: Brain,
  market_scanner: Search,
  odds_analyst: BarChart3,
  sentiment: MessageSquare,
  risk_manager: Shield,
  trader: Zap,
};

const AGENT_COLORS: Record<string, string> = {
  orchestrator_v2: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
  orchestrator: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
  market_scanner: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  researcher: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  estimator_a: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  estimator_b: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
  estimator_c: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
  aggregator: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  risk_manager: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  trader: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
};

const AGENT_LABELS: Record<string, string> = {
  orchestrator_v2: "CRO",
  orchestrator: "CRO",
  market_scanner: "Scanner",
  researcher: "Research",
  estimator_a: "Est-A",
  estimator_b: "Est-B",
  estimator_c: "Est-C",
  aggregator: "Aggregator",
  risk_manager: "Risk",
  trader: "Trader",
};

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  started: ArrowRight,
  progress: Loader2,
  thinking: Lightbulb,
  result: CheckCircle2,
  error: AlertCircle,
  completed: CheckCircle2,
};

function formatEventTime(timestamp: string) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

interface AgentActivityFeedProps {
  events: AgentEvent[];
  maxHeight?: string;
  isRunning?: boolean;
}

export function AgentActivityFeed({ events, maxHeight = "400px", isRunning = false }: AgentActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" />
          Agent Activity
          {events.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {events.length} events
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="space-y-1 overflow-y-auto pr-1"
          style={{ maxHeight }}
        >
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Brain className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">No activity yet</p>
              <p className="text-xs text-muted-foreground max-w-[240px]">
                Agent events will appear here when a trading cycle runs.
              </p>
            </div>
          ) : (
            <>
            {!isRunning && events.length > 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded-md bg-muted/30 border border-border/50">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                <span className="text-[11px] text-muted-foreground">
                  No active cycle — showing last cycle&apos;s activity
                </span>
              </div>
            )}
            <AnimatePresence initial={false}>
              {events.map((event) => {
                const AgentIcon = AGENT_ICONS[event.agentName] || Brain;
                const EventIcon = EVENT_ICONS[event.eventType] || ArrowRight;
                const colorClass = AGENT_COLORS[event.agentName] || AGENT_COLORS.orchestrator;
                const label = AGENT_LABELS[event.agentName] || event.agentName;
                const isError = event.eventType === "error";
                const isComplete = event.eventType === "completed";

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5 shrink-0 w-16">
                      {formatEventTime(event.timestamp)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-4 px-1.5 shrink-0 gap-1 ${colorClass}`}
                    >
                      <AgentIcon className="h-2.5 w-2.5" />
                      {label}
                    </Badge>
                    <EventIcon
                      className={`h-3 w-3 mt-0.5 shrink-0 ${
                        isError
                          ? "text-destructive"
                          : isComplete
                            ? "text-emerald-500"
                            : event.eventType === "progress" || event.eventType === "thinking"
                              ? "text-amber-500 animate-spin"
                              : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`text-xs leading-relaxed ${
                        isError ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {event.message}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
