"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AttentionItem, HookSessionState } from "@/lib/agent-os/types";

export interface AttentionState {
  items: AttentionItem[];
  sessions: HookSessionState[];
  hooksActive: boolean;
  loading: boolean;
}

const REASON_PRIORITY: Record<string, number> = {
  permission_prompt: 0,
  error: 1,
  idle_prompt: 2,
  finished: 3,
};

function notifyKey(i: AttentionItem): string {
  return `${i.sessionId}:${i.reason}:${Math.round(i.since / 1000)}`;
}

/**
 * Polls the unified attention queue and raises a desktop notification the
 * first time a session enters a blocking state. Notifications are
 * deduped by (session, reason, since).
 */
export function useAttention(pollMs = 4000): AttentionState & {
  dismiss: (sessionId: string) => Promise<void>;
  requestNotifyPermission: () => void;
  notifyGranted: boolean;
} {
  const [state, setState] = useState<AttentionState>({
    items: [],
    sessions: [],
    hooksActive: false,
    loading: true,
  });
  const [notifyGranted, setNotifyGranted] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined")
      return false;
    return Notification.permission === "granted";
  });
  const seen = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const requestNotifyPermission = useCallback(() => {
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission().then((p) =>
      setNotifyGranted(p === "granted")
    );
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/agent-os/attention", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as {
        items: AttentionItem[];
        sessions: HookSessionState[];
        hooksActive: boolean;
      };
      const items = [...j.items].sort(
        (a, b) =>
          (REASON_PRIORITY[a.reason] ?? 9) - (REASON_PRIORITY[b.reason] ?? 9) ||
          a.since - b.since
      );

      // Fire notifications for newly-blocked sessions (skip the very first
      // load so we don't blast on page open).
      if (!firstLoad.current && notifyGranted) {
        for (const it of items) {
          const k = notifyKey(it);
          if (seen.current.has(k)) continue;
          seen.current.add(k);
          const title =
            it.reason === "permission_prompt"
              ? `🔐 ${it.projectName} needs permission`
              : it.reason === "error"
              ? `🔴 ${it.projectName} errored`
              : it.reason === "finished"
              ? `✅ ${it.projectName} finished`
              : `⏳ ${it.projectName} is waiting`;
          try {
            const n = new Notification(title, {
              body: it.message.slice(0, 140),
              tag: it.sessionId,
              requireInteraction: it.reason === "permission_prompt",
            });
            n.onclick = () => {
              window.focus();
              window.location.hash = `#session-${it.sessionId}`;
              n.close();
            };
          } catch {
            /* ignore */
          }
        }
      } else {
        for (const it of items) seen.current.add(notifyKey(it));
      }
      firstLoad.current = false;

      setState({
        items,
        sessions: j.sessions,
        hooksActive: j.hooksActive,
        loading: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [notifyGranted]);

  useEffect(() => {
    const kick = setTimeout(load, 0);
    const t = setInterval(load, pollMs);
    return () => {
      clearTimeout(kick);
      clearInterval(t);
    };
  }, [load, pollMs]);

  const dismiss = useCallback(async (sessionId: string) => {
    try {
      await fetch("/api/agent-os/attention", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      /* ignore */
    }
    setState((s) => ({
      ...s,
      items: s.items.filter((i) => i.sessionId !== sessionId),
    }));
  }, []);

  return {
    ...state,
    dismiss,
    requestNotifyPermission,
    notifyGranted,
  };
}
