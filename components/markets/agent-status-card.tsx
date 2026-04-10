"use client";

import { motion } from "framer-motion";
import {
  Search,
  BarChart3,
  MessageSquare,
  Shield,
  Zap,
  Brain,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const AGENT_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }
> = {
  orchestrator: { icon: Brain, color: "text-violet-500", bgColor: "bg-violet-500/10" },
  market_scanner: { icon: Search, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  odds_analyst: { icon: BarChart3, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  sentiment: { icon: MessageSquare, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  risk_manager: { icon: Shield, color: "text-red-500", bgColor: "bg-red-500/10" },
  trader: { icon: Zap, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
};

interface AgentStatusCardProps {
  name: string;
  label: string;
  role: string;
  status: string;
  lastDurationMs: number | null;
  lastMessage?: string;
  compact?: boolean;
}

export function AgentStatusCard({
  name,
  label,
  role,
  status,
  lastDurationMs,
  lastMessage,
  compact = false,
}: AgentStatusCardProps) {
  const config = AGENT_CONFIG[name] || AGENT_CONFIG.orchestrator;
  const Icon = config.icon;
  const isRunning = status === "running";
  const isError = status === "error";

  const statusColor = isRunning
    ? "text-emerald-500"
    : isError
      ? "text-destructive"
      : "text-muted-foreground";

  const statusBg = isRunning
    ? "bg-emerald-500/10 border-emerald-500/20"
    : isError
      ? "bg-destructive/10 border-destructive/20"
      : "bg-muted/50 border-border";

  return (
    <Card className={`relative overflow-hidden ${isRunning ? "ring-1 ring-emerald-500/30" : ""}`}>
      {isRunning && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      )}
      <CardContent className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start gap-3 relative">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bgColor}`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{label}</span>
              <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${statusBg} ${statusColor}`}>
                {isRunning && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                )}
                {status === "idle" ? "Idle" : status === "running" ? "Running" : status === "completed" ? "Done" : "Error"}
              </Badge>
            </div>
            {!compact && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{role}</p>
            )}
            {lastMessage && (
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                {lastMessage}
              </p>
            )}
            {lastDurationMs != null && lastDurationMs > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {lastDurationMs < 1000
                  ? `${lastDurationMs}ms`
                  : `${(lastDurationMs / 1000).toFixed(1)}s`}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
