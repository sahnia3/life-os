"use client";

import { useEffect, useRef, useState } from "react";
import type {
  SessionEvent,
  SessionMeta,
  StreamEvent,
} from "@/lib/agent-os/types";

interface FeedItem extends SessionEvent {
  projectName: string;
}

const MAX_FEED_ITEMS = 80;

export interface AgentOsStreamState {
  sessions: SessionMeta[];
  feed: FeedItem[];
  connected: boolean;
  lastHeartbeat: number | null;
}

export function useAgentOsStream(): AgentOsStreamState {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;
      const es = new EventSource("/api/agent-os/stream");
      esRef.current = es;

      es.onopen = () => setConnected(true);

      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data) as StreamEvent;
          if (evt.type === "snapshot") {
            setSessions(evt.sessions);
          } else if (evt.type === "session-added") {
            setSessions((prev) => {
              if (prev.find((s) => s.sessionId === evt.session.sessionId))
                return prev;
              return [evt.session, ...prev];
            });
          } else if (evt.type === "session-updated") {
            setSessions((prev) => {
              const idx = prev.findIndex(
                (s) => s.sessionId === evt.session.sessionId
              );
              if (idx === -1) return [evt.session, ...prev];
              const next = prev.slice();
              next[idx] = evt.session;
              return next;
            });
          } else if (evt.type === "session-removed") {
            setSessions((prev) =>
              prev.filter((s) => s.sessionId !== evt.sessionId)
            );
          } else if (evt.type === "event") {
            const projectName =
              (evt.event.cwd
                ? evt.event.cwd.replace(/^.*\//, "")
                : null) ?? "(unknown)";
            setFeed((prev) => {
              const next: FeedItem[] = [
                { ...evt.event, projectName },
                ...prev,
              ];
              return next.slice(0, MAX_FEED_ITEMS);
            });
          } else if (evt.type === "heartbeat") {
            setLastHeartbeat(evt.ts);
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        if (cancelled) return;
        retryTimer = setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      esRef.current?.close();
    };
  }, []);

  return { sessions, feed, connected, lastHeartbeat };
}

export function useTokenRollup(intervalMs = 30_000) {
  const [data, setData] = useState<
    import("@/lib/agent-os/types").TokenRollup | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/tokens?window=5h", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = (await r.json()) as import("@/lib/agent-os/types").TokenRollup;
        if (!cancelled) setData(j);
      } catch {
        // ignore
      }
    }
    void load();
    const t = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [intervalMs]);

  return data;
}
