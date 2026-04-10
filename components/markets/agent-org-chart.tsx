"use client";

import { motion } from "framer-motion";
import {
  Search,
  BookOpen,
  Shield,
  Zap,
  Brain,
  Eye,
  Layers,
  ShieldAlert,
  Hash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentStatus } from "@/lib/hooks/use-agent-events";

const AGENT_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    borderColor: string;
    glowColor: string;
    tier: string;
  }
> = {
  orchestrator_v2: {
    icon: Brain,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
    glowColor: "shadow-violet-500/20",
    tier: "Sonnet",
  },
  market_scanner: {
    icon: Search,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    glowColor: "shadow-blue-500/20",
    tier: "Sonnet",
  },
  researcher: {
    icon: BookOpen,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    glowColor: "shadow-purple-500/20",
    tier: "Claude Code",
  },
  estimator_a: {
    icon: Eye,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    glowColor: "shadow-emerald-500/20",
    tier: "Sonnet",
  },
  estimator_b: {
    icon: BookOpen,
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/30",
    glowColor: "shadow-teal-500/20",
    tier: "Sonnet",
  },
  estimator_c: {
    icon: Hash,
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
    glowColor: "shadow-sky-500/20",
    tier: "Sonnet",
  },
  estimator_d: {
    icon: ShieldAlert,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    glowColor: "shadow-orange-500/20",
    tier: "Sonnet",
  },
  aggregator: {
    icon: Layers,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    glowColor: "shadow-amber-500/20",
    tier: "Sonnet",
  },
  risk_manager: {
    icon: Shield,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    glowColor: "shadow-red-500/20",
    tier: "Local",
  },
  trader: {
    icon: Zap,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    glowColor: "shadow-cyan-500/20",
    tier: "Local",
  },
};

const DEFAULT_AGENT: AgentStatus = {
  name: "", label: "", role: "", status: "idle",
  lastRunAt: null, lastDurationMs: null, tokensUsed: 0, error: null, cycleId: null,
};

function AgentNode({
  agent,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isRunning,
  delay = 0,
  compact = false,
}: {
  agent: AgentStatus;
  isRunning: boolean;
  delay?: number;
  compact?: boolean;
}) {
  const config = AGENT_CONFIG[agent.name] || AGENT_CONFIG.orchestrator_v2;
  const Icon = config.icon;
  const running = agent.status === "running";
  const error = agent.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      className={`relative ${compact ? "p-2" : "p-3"} rounded-xl border ${config.borderColor} ${
        running ? `shadow-lg ${config.glowColor} ring-1 ring-offset-0 ${config.borderColor}` : ""
      } bg-card transition-all duration-300`}
    >
      {running && (
        <motion.div
          className={`absolute inset-0 rounded-xl ${config.bgColor} opacity-30`}
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      <div className="relative flex flex-col items-center text-center gap-1">
        <div className={`${compact ? "w-7 h-7" : "w-9 h-9"} rounded-lg flex items-center justify-center ${config.bgColor}`}>
          <Icon className={`${compact ? "h-3.5 w-3.5" : "h-4.5 w-4.5"} ${config.color} ${running ? "animate-pulse" : ""}`} />
        </div>
        <div>
          <p className={`${compact ? "text-[10px]" : "text-xs"} font-semibold leading-tight`}>{agent.label}</p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <Badge
              variant="outline"
              className={`text-[9px] h-3.5 px-1 ${
                running
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  : error
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : "text-muted-foreground"
              }`}
            >
              {running ? "Active" : error ? "Error" : agent.status === "completed" ? "Done" : "Idle"}
            </Badge>
            <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-muted-foreground">
              {config.tier}
            </Badge>
          </div>
        </div>
        {agent.lastDurationMs != null && agent.lastDurationMs > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {agent.lastDurationMs < 1000
              ? `${agent.lastDurationMs}ms`
              : `${(agent.lastDurationMs / 1000).toFixed(1)}s`}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function VerticalConnector({ isActive, delay = 0 }: { isActive: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center justify-center"
    >
      <div className={`w-px h-5 ${isActive ? "bg-emerald-500" : "bg-border"} transition-colors duration-300`}>
        {isActive && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 -ml-[2px]"
            animate={{ y: [0, 16, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  );
}

interface AgentOrgChartProps {
  agents: AgentStatus[];
  isRunning: boolean;
}

export function AgentOrgChart({ agents, isRunning }: AgentOrgChartProps) {
  const agentMap = new Map(agents.map((a) => [a.name, a]));
  const get = (name: string, label: string) =>
    agentMap.get(name) || { ...DEFAULT_AGENT, name, label };

  const orchestrator = get("orchestrator_v2", "CRO");
  const scanner = get("market_scanner", "Market Scanner");
  const researcher = get("researcher", "Researcher");
  const estA = get("estimator_a", "Est A (Prior)");
  const estB = get("estimator_b", "Est B (Research)");
  const estC = get("estimator_c", "Est C (Quant)");
  const estD = get("estimator_d", "Est D (Bear)");
  const aggregator = get("aggregator", "Aggregator");
  const risk = get("risk_manager", "Risk Manager");
  const trader = get("trader", "Trader");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" />
          Agent Organization
          {isRunning && (
            <Badge variant="outline" className="text-[10px] h-4 ml-auto bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
              Cycle Active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-0">
          {/* Orchestrator - Top */}
          <AgentNode agent={orchestrator} isRunning={isRunning} delay={0} />

          <VerticalConnector isActive={scanner.status === "running"} delay={0.05} />

          {/* Scanner */}
          <AgentNode agent={scanner} isRunning={isRunning} delay={0.05} />

          <VerticalConnector isActive={researcher.status === "running"} delay={0.1} />

          {/* Researcher (Claude Code) */}
          <AgentNode agent={researcher} isRunning={isRunning} delay={0.1} />

          <VerticalConnector isActive={estA.status === "running" || estB.status === "running" || estC.status === "running" || estD.status === "running"} delay={0.15} />

          {/* 4 Estimators — A/B/C in parallel, then D (adversarial) */}
          <div className="grid grid-cols-3 gap-2 w-full">
            <AgentNode agent={estA} isRunning={isRunning} delay={0.15} compact />
            <AgentNode agent={estB} isRunning={isRunning} delay={0.2} compact />
            <AgentNode agent={estC} isRunning={isRunning} delay={0.25} compact />
          </div>

          <VerticalConnector isActive={estD.status === "running"} delay={0.27} />

          {/* Estimator D — Bear Case (runs after A/B/C) */}
          <AgentNode agent={estD} isRunning={isRunning} delay={0.28} />

          <VerticalConnector isActive={aggregator.status === "running"} delay={0.3} />

          {/* Aggregator */}
          <AgentNode agent={aggregator} isRunning={isRunning} delay={0.3} />

          <VerticalConnector isActive={risk.status === "running"} delay={0.35} />

          {/* Risk + Trade row */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
            <AgentNode agent={risk} isRunning={isRunning} delay={0.35} compact />
            <AgentNode agent={trader} isRunning={isRunning} delay={0.4} compact />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
