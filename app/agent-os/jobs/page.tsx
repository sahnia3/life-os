"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Briefcase,
  Loader2,
  Search,
  RefreshCw,
} from "lucide-react";
import { JobCard, type Job } from "@/components/agent-os/job-card";
import { JobFunnel, type Funnel } from "@/components/agent-os/job-funnel";

interface JobsResponse {
  jobs: Job[];
  funnel: Funnel;
  meta: { avgFit: number | null; strongCount: number; scoredCount: number };
  error?: string;
}

const EMPTY_FUNNEL: Funnel = {
  tracked: 0,
  scored: 0,
  surfaced: 0,
  applied: 0,
  replied: 0,
  interviewing: 0,
  rejected: 0,
  ghosted: 0,
};

type Sort = "fit" | "newest";

export default function JobsPage() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("fit");
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const [runNote, setRunNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/agent-os/jobs", { cache: "no-store" });
      const j = (await r.json()) as JobsResponse;
      setData(j);
      setError(j.error ?? null);
    } catch {
      setError("Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Reflect a scan that's already running (e.g. started elsewhere or the cron).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/agent-os/jobs/run", { cache: "no-store" });
        const j = (await r.json()) as { running?: boolean };
        if (j.running) setScanning(true);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // While scanning, poll for completion then refresh the list.
  useEffect(() => {
    if (!scanning) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/agent-os/jobs/run", { cache: "no-store" });
        const j = (await r.json()) as { running?: boolean };
        if (!j.running) {
          clearInterval(t);
          setScanning(false);
          setRunNote("Scan complete — list refreshed.");
          void load();
        }
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [scanning, load]);

  async function triggerScan() {
    setRunNote(null);
    try {
      const r = await fetch("/api/agent-os/jobs/run", { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.status === 409) {
        setScanning(true);
        setRunNote("A scan is already running…");
        return;
      }
      if (!r.ok) {
        setRunNote(j.error ?? `Failed to start scan (HTTP ${r.status}).`);
        return;
      }
      setScanning(true);
      setRunNote(
        "Scan started — polling boards + scoring with Haiku. New roles appear as they land."
      );
    } catch {
      setRunNote("Failed to start scan.");
    }
  }

  const jobs = useMemo(() => data?.jobs ?? [], [data]);
  const funnel = data?.funnel ?? EMPTY_FUNNEL;

  const sources = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.source))).sort(),
    [jobs]
  );

  const visible = useMemo(() => {
    let out = jobs;
    if (stateFilter) out = out.filter((j) => j.state === stateFilter);
    if (sourceFilter) out = out.filter((j) => j.source === sourceFilter);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter(
        (j) =>
          j.company.toLowerCase().includes(needle) ||
          j.title.toLowerCase().includes(needle)
      );
    }
    return [...out].sort((a, b) => {
      if (sort === "fit") return (b.fitScore ?? -1) - (a.fitScore ?? -1);
      return (Date.parse(b.insertedAt) || 0) - (Date.parse(a.insertedAt) || 0);
    });
  }, [jobs, stateFilter, sourceFilter, q, sort]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 p-3 lg:p-5">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/agent-os"
            className="inline-flex items-center gap-1 text-xs hover:text-[var(--ag-text)]"
            style={{ color: "var(--ag-text-mut)" }}
          >
            <ArrowLeft className="h-3 w-3" /> Agent OS
          </Link>
          <ChevronRight
            className="h-3 w-3"
            style={{ color: "var(--ag-text-dim)" }}
          />
          <Briefcase className="h-4 w-4 text-sky-500" />
          <h1 className="font-heading text-lg font-semibold tracking-tight">
            Jobs
          </h1>
          <span className="text-[11px]" style={{ color: "var(--ag-text-mut)" }}>
            {funnel.tracked} tracked
          </span>
        </div>
        <button
          onClick={triggerScan}
          disabled={scanning}
          title="Run the job-watcher cycle now (poll → score → digest)"
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {scanning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {scanning ? "Scanning…" : "Run scan now"}
        </button>
      </header>

      {runNote && (
        <p className="text-[11px]" style={{ color: "var(--ag-text-mut)" }}>
          {runNote}
        </p>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-500">
          {error}
        </div>
      )}

      <JobFunnel
        funnel={funnel}
        avgFit={data?.meta.avgFit ?? null}
        strongCount={data?.meta.strongCount ?? 0}
        activeFilter={stateFilter}
        onFilter={setStateFilter}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2"
            style={{ color: "var(--ag-text-dim)" }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company or title…"
            className="w-56 rounded-md border border-border bg-background py-1 pl-7 pr-2 text-xs"
          />
        </div>

        <div
          className="inline-flex rounded-md p-0.5 text-[10px]"
          style={{ background: "var(--ag-nested)" }}
        >
          {(["fit", "newest"] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="rounded px-2 py-0.5 font-medium capitalize transition-colors"
              style={
                sort === s
                  ? { background: "var(--ag-overlay)", color: "var(--ag-text)" }
                  : { color: "var(--ag-text-dim)" }
              }
            >
              {s}
            </button>
          ))}
        </div>

        {sources.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setSourceFilter(null)}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors"
              style={
                sourceFilter === null
                  ? { background: "var(--ag-overlay)", color: "var(--ag-text)" }
                  : { color: "var(--ag-text-dim)" }
              }
            >
              all
            </button>
            {sources.map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className="rounded-full px-2 py-0.5 font-mono text-[10px] transition-colors"
                style={
                  sourceFilter === s
                    ? { background: "var(--ag-overlay)", color: "var(--ag-text)" }
                    : { color: "var(--ag-text-dim)" }
                }
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <span
          className="ml-auto text-[11px]"
          style={{ color: "var(--ag-text-dim)" }}
        >
          {visible.length} shown
        </span>
      </div>

      {loading && jobs.length === 0 ? (
        <div
          className="ag-surface inline-flex w-full items-center justify-center gap-2 py-10 text-xs"
          style={{ color: "var(--ag-text-dim)" }}
        >
          <Loader2 className="h-3 w-3 animate-spin" /> Loading jobs…
        </div>
      ) : visible.length === 0 ? (
        <div
          className="ag-surface py-10 text-center text-xs"
          style={{ color: "var(--ag-text-dim)" }}
        >
          {jobs.length === 0
            ? "No jobs tracked yet. The job-watcher will surface roles here as it scores them."
            : "No jobs match these filters."}
          {jobs.length > 0 && (
            <button
              onClick={() => {
                setStateFilter(null);
                setSourceFilter(null);
                setQ("");
              }}
              className="ml-1 underline"
              style={{ color: "var(--ag-accent)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}
