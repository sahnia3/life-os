"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface AgentEvent {
  type: "agent_event" | "connected";
  id: number;
  timestamp: string;
  cycleId: string;
  agentName: string;
  eventType: string;
  message: string;
  data: Record<string, unknown> | null;
  parentAgent: string | null;
}

export interface AgentStatus {
  name: string;
  label: string;
  role: string;
  status: string;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  tokensUsed: number;
  error: string | null;
  cycleId: string | null;
}

export interface AgentStatusResponse {
  agents: AgentStatus[];
  isRunning: boolean;
  latestCycleId: string | null;
  totalCycles: number;
}

const MAX_EVENTS = 100;

export function useAgentEvents() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const lastIdRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const connectRef = useRef<() => void>();

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/agents/events?lastId=${lastIdRef.current}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "connected") {
          setIsConnected(true);
          return;
        }
        if (data.type === "agent_event") {
          lastIdRef.current = Math.max(lastIdRef.current, data.id);
          setEvents((prev) => {
            const next = [...prev, data as AgentEvent];
            return next.slice(-MAX_EVENTS);
          });
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      // Reconnect after 3s
      setTimeout(() => connectRef.current?.(), 3000);
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);

  // Derive latest event per agent
  const latestByAgent = events.reduce<Record<string, AgentEvent>>(
    (acc, event) => {
      acc[event.agentName] = event;
      return acc;
    },
    {}
  );

  return { events, isConnected, latestByAgent };
}

export function useAgentStatus() {
  const [status, setStatus] = useState<AgentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      // Ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, loading, refetch: fetchStatus };
}
