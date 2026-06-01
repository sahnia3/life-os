"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  lastEventAt: number;
  className?: string;
}

export function HeartbeatDot({ lastEventAt, className }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const age = now - lastEventAt;
  // green < 30s, amber < 5m, rose < 1h, gray older
  const color =
    age < 30_000
      ? "bg-emerald-500"
      : age < 5 * 60_000
      ? "bg-amber-500"
      : age < 3_600_000
      ? "bg-rose-500"
      : "bg-muted-foreground/30";
  const pulse = age < 5_000;
  const label =
    age < 5_000
      ? "active now"
      : age < 60_000
      ? `${Math.floor(age / 1000)}s ago`
      : age < 3_600_000
      ? `${Math.floor(age / 60_000)}m ago`
      : age < 86_400_000
      ? `${Math.floor(age / 3_600_000)}h ago`
      : `${Math.floor(age / 86_400_000)}d ago`;

  return (
    <span
      className={cn("relative inline-flex h-2 w-2 flex-shrink-0", className)}
      title={`last event ${label}`}
    >
      {pulse && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}
