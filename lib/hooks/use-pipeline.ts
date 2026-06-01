"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface PipelineEvaluation {
  city: string;
  targetDate: string;
  bucketValue: number;
  bucketType: string;
  side: string;
  ensembleProb: number;
  marketPrice: number;
  livePrice: number;
  edge: number;
  liveEdge: number;
  ensembleMembers: number;
  ensembleMean: number;
  ensembleStd: number;
  modelSpread: number;
  modelCount: number;
  models: { name: string; mean: number; members: number }[] | null;
  ensembleRange: { min: number; max: number };
  gates: {
    q1: string;
    q2: string;
    q3: string;
    q3b: string;
    q4: string;
    q5: string;
    q6: string;
    q7: string;
    q8: string;
  };
  gateWarnings: number;
  gateBlocks: number;
  gateOutcome: string;
  q8Reasoning: string | null;
  metar: { icao: string; latestTemp: number; maxObserved: number } | null;
  tradeExecuted: boolean;
  tradeAmount: number | null;
  rejectionReason: string | null;
}

export interface PipelineCycle {
  cycleId: string;
  startedAt: string;
  completedAt?: string;
  status: string;
  eventsScanned: number;
  opportunitiesFound: number;
  tradesExecuted: number;
  dryRun: boolean;
}

export interface PipelineStatus {
  latestCycle: PipelineCycle | null;
  recentEvaluations: PipelineEvaluation[];
  evaluationsByCycle: Record<string, PipelineEvaluation[]>;
  cycleHistory: PipelineCycle[];
  gateStats: Record<string, number>;
  lessons: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    recentLosses: { lesson: string; failureType: string; pnl: number; market: string }[];
  };
}

export function usePipelineStatus(refreshInterval = 30_000) {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline/status");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Pipeline status fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer the initial fetch off the effect body so it doesn't setState
    // synchronously during the effect (react-hooks/set-state-in-effect).
    const initial = setTimeout(refetch, 0);
    const interval = setInterval(refetch, refreshInterval);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [refetch, refreshInterval]);

  return { status, loading, refetch };
}

export interface CityPnl {
  city: string;
  pnl: number;
  trades: number;
  wins: number;
}

export interface BrierPoint {
  timestamp: string;
  edgeClaimed: number;
  pnl: number;
  win: boolean;
  city: string;
}

export interface LessonsData {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  byFailureType: Record<string, { count: number; totalPnl: number }>;
  cityPnl: CityPnl[];
  brierTrend: BrierPoint[];
}

export function useLessons(refreshInterval = 60_000) {
  const [data, setData] = useState<LessonsData | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline/lessons");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Lessons fetch error:", err);
    }
  }, []);

  useEffect(() => {
    // Defer the initial fetch off the effect body so it doesn't setState
    // synchronously during the effect (react-hooks/set-state-in-effect).
    const initial = setTimeout(refetch, 0);
    const interval = setInterval(refetch, refreshInterval);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [refetch, refreshInterval]);

  return { data, refetch };
}

export interface PipelineProgress {
  status: "idle" | "starting" | "running" | "completed" | "error";
  currentStage: string | null;
  completedStages?: string[];
  detail?: string;
  error?: string;
  result?: Record<string, unknown>;
  q8?: { result: string; reasoning: string | null; city?: string; bucket?: number; side?: string };
}

export function usePipelineProgress() {
  const [progress, setProgress] = useState<PipelineProgress>({
    status: "idle",
    currentStage: null,
  });
  const [connected, setConnected] = useState(false);
  // Tracks when we triggered — ignore stale "completed" for 5s after trigger.
  // Must be a real ref so it persists across renders (a plain object would reset
  // every render, defeating the stale-completion guard below).
  const triggeredAtRef = useRef(0);

  const connect = useCallback(() => {
    const es = new EventSource("/api/pipeline/progress");
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Guard: ignore stale "completed" right after triggering a new cycle.
        // The trigger route writes "starting" to the file, but SSE might read
        // the old file before the write lands. Give it 5 seconds.
        if (
          data.status === "completed" &&
          triggeredAtRef.current > 0 &&
          Date.now() - triggeredAtRef.current < 5000
        ) {
          return; // skip stale completion
        }
        setProgress(data);
      } catch {
        // ignore parse errors
      }
    };
    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      es.close();
    };
    return es;
  }, []);

  const triggerCycle = useCallback(async () => {
    // Set starting state immediately to prevent stale "completed" from closing SSE
    setProgress({ status: "starting", currentStage: null, detail: "Launching pipeline..." });
    triggeredAtRef.current = Date.now();

    const res = await fetch("/api/pipeline/trigger", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      // Connect SSE to watch progress
      const es = connect();
      return { started: true, pid: data.pid, eventSource: es };
    }
    setProgress({ status: "idle", currentStage: null });
    return { started: false, error: data.error };
  }, [connect]);

  return { progress, connected, connect, triggerCycle };
}
