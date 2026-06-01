import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/lib/agent-os/types";

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; dot: string; bg: string; text: string }
> = {
  active: {
    label: "Active",
    dot: "bg-emerald-500 animate-pulse",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  "running-tool": {
    label: "Running tool",
    dot: "bg-amber-500 animate-pulse",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
  },
  idle: {
    label: "Idle",
    dot: "bg-slate-400",
    bg: "bg-slate-500/10",
    text: "text-slate-600 dark:text-slate-400",
  },
  stale: {
    label: "Stale",
    dot: "bg-rose-500",
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
  },
};

export function StatusPill({ status }: { status: SessionStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
        c.bg,
        c.text
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}
