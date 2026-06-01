"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  scheduleHint: string | null;
  disabled: boolean;
  body: string;
}

export function ScheduledTasksWidget() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/widgets/scheduled", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = (await r.json()) as { tasks: ScheduledTask[] };
        if (mounted) setTasks(j.tasks);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const active = tasks.filter((t) => !t.disabled);
  const disabled = tasks.filter((t) => t.disabled);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="h-3.5 w-3.5 text-sky-500" />
          Scheduled tasks
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            {active.length} active · {disabled.length} disabled
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No scheduled tasks.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={cn(
                  "rounded-md border border-border/60 px-2 py-1.5 text-xs",
                  task.disabled && "opacity-50"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-mono text-[11px] font-medium">
                    {task.name}
                  </span>
                  {task.disabled && (
                    <Pause className="h-3 w-3 text-rose-500 flex-shrink-0" />
                  )}
                  {task.scheduleHint && (
                    <span className="ml-auto truncate text-[10px] text-muted-foreground">
                      {task.scheduleHint}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground leading-snug">
                  {task.description}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
