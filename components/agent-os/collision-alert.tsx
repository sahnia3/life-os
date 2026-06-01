"use client";

import { useEffect, useState } from "react";
import { GitMerge } from "lucide-react";
import type { FileCollision } from "@/lib/agent-os/db";

function base(p: string): string {
  return p.split("/").slice(-2).join("/");
}

export function CollisionAlert() {
  const [collisions, setCollisions] = useState<FileCollision[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/collisions", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = (await r.json()) as { collisions: FileCollision[] };
        if (mounted) setCollisions(j.collisions);
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = setInterval(load, 8000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  if (collisions.length === 0) return null;

  return (
    <div
      className="ag-surface ag-attn px-3 py-2"
      style={{ boxShadow: "inset 0 0 0 1px rgba(243,139,168,0.5)" }}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <GitMerge className="h-4 w-4" style={{ color: "var(--ag-red)" }} />
        <h2 className="ag-h text-sm" style={{ color: "var(--ag-red)" }}>
          File collision risk
        </h2>
        <span
          className="ag-num text-[10px]"
          style={{ color: "var(--ag-text-dim)" }}
        >
          {collisions.length} file{collisions.length === 1 ? "" : "s"} touched by
          2+ sessions
        </span>
      </div>
      <ul className="space-y-1">
        {collisions.slice(0, 5).map((c) => (
          <li
            key={c.filePath}
            className="ag-num flex items-center gap-2 text-[11px]"
          >
            <span className="truncate" style={{ color: "var(--ag-text-2)" }}>
              {base(c.filePath)}
            </span>
            <span style={{ color: "var(--ag-text-dim)" }}>
              ←{" "}
              {c.sessions
                .map((s) => (s.cwd ? s.cwd.split("/").pop() : s.sessionId.slice(0, 6)))
                .join(", ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
