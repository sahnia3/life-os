"use client";

import { useState } from "react";
import { ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Job {
  id: number;
  source: string;
  company: string;
  title: string;
  location: string | null;
  url: string;
  postedAt: string | null;
  insertedAt: string;
  fitScore: number | null;
  fitReason: string | null;
  suggestedResume: string | null;
  state: string;
  surfacedAt: string | null;
  appliedAt: string | null;
}

function fitColor(score: number | null): string {
  if (score == null) return "text-slate-500";
  if (score >= 8.5) return "text-emerald-400";
  if (score >= 7.0) return "text-teal-400";
  if (score >= 5.5) return "text-amber-400";
  if (score >= 4.0) return "text-slate-400";
  return "text-rose-400";
}

function fitBar(score: number | null): string {
  if (score == null) return "bg-slate-600";
  if (score >= 8.5) return "bg-emerald-500";
  if (score >= 7.0) return "bg-teal-500";
  if (score >= 5.5) return "bg-amber-500";
  if (score >= 4.0) return "bg-slate-500";
  return "bg-rose-500";
}

const SOURCE_STYLE: Record<string, string> = {
  greenhouse: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  lever: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
  ashby: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
  linkedin: "bg-teal-500/10 text-teal-400 ring-teal-500/20",
  indeed: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
};

const RESUME_STYLE: Record<string, string> = {
  swe: "bg-sky-500/12 text-sky-400",
  ml: "bg-violet-500/12 text-violet-400",
  quant: "bg-amber-500/12 text-amber-400",
  ds: "bg-teal-500/12 text-teal-400",
};

const STATE_STYLE: Record<string, { dot: string; bg: string; text: string }> = {
  scored: { dot: "bg-slate-400", bg: "bg-slate-500/10", text: "text-slate-400" },
  surfaced: { dot: "bg-sky-500", bg: "bg-sky-500/10", text: "text-sky-400" },
  applied: { dot: "bg-violet-500", bg: "bg-violet-500/10", text: "text-violet-400" },
  replied: { dot: "bg-teal-500", bg: "bg-teal-500/10", text: "text-teal-400" },
  interviewing: {
    dot: "bg-emerald-500 animate-pulse",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  rejected: { dot: "bg-rose-500", bg: "bg-rose-500/10", text: "text-rose-400" },
  ghosted: { dot: "bg-zinc-600", bg: "bg-zinc-500/10", text: "text-zinc-500" },
};

function ageInfo(
  postedAt: string | null,
  insertedAt: string
): { label: string; stale: boolean } | null {
  const raw = postedAt || insertedAt;
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  const diff = Date.now() - t;
  const days = Math.floor(diff / 86_400_000);
  let label: string;
  if (diff < 3_600_000) label = Math.max(1, Math.floor(diff / 60_000)) + "m";
  else if (diff < 86_400_000) label = Math.floor(diff / 3_600_000) + "h";
  else label = days + "d";
  return { label: label + " old", stale: days >= 7 };
}

export function JobCard({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const fit = job.fitScore;
  const st = STATE_STYLE[job.state] ?? STATE_STYLE.scored;
  const age = ageInfo(job.postedAt, job.insertedAt);
  const strong = fit != null && fit >= 9.0;

  return (
    <div className="ag-surface ag-rowin group/job relative overflow-hidden">
      {strong && (
        <span
          className="absolute left-0 top-0 h-full w-0.5"
          style={{ background: "var(--ag-accent)" }}
        />
      )}
      <div className="flex items-stretch gap-3 p-3">
        {/* fit rail */}
        <div className="flex w-11 flex-shrink-0 flex-col items-center justify-center">
          <span
            className={cn(
              "ag-num ag-roll text-xl font-semibold leading-none",
              fitColor(fit)
            )}
          >
            {fit != null ? fit.toFixed(1) : "—"}
          </span>
          <div
            className="mt-1.5 h-1 w-full overflow-hidden rounded-full"
            style={{ background: "var(--ag-nested)" }}
          >
            <div
              className={cn("h-full rounded-full", fitBar(fit))}
              style={{ width: `${Math.min(100, ((fit ?? 0) / 10) * 100)}%` }}
            />
          </div>
        </div>

        <div
          className="w-px flex-shrink-0"
          style={{ background: "var(--ag-divider)" }}
        />

        {/* main (click to expand) */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="truncate font-mono text-xs font-medium"
              style={{ color: "var(--ag-text)" }}
              title={job.company}
            >
              {job.company}
            </span>
            <span
              className="truncate text-[11px]"
              style={{ color: "var(--ag-text-mut)" }}
              title={job.title}
            >
              {job.title}
            </span>
          </div>
          <div
            className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px]"
            style={{ color: "var(--ag-text-mut)" }}
          >
            {job.location && <span className="truncate">{job.location}</span>}
            {age && (
              <>
                <span style={{ color: "var(--ag-text-dim)" }}>·</span>
                <span className={cn(age.stale && "text-amber-400")}>
                  {age.label}
                </span>
              </>
            )}
            {job.fitReason && (
              <>
                <span style={{ color: "var(--ag-text-dim)" }}>·</span>
                <span className="truncate" title={job.fitReason}>
                  {job.fitReason}
                </span>
              </>
            )}
          </div>
        </button>

        {/* right meta */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-1.5 py-px font-mono text-[9px] ring-1",
              SOURCE_STYLE[job.source] ??
                "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20"
            )}
          >
            {job.source}
          </span>
          {job.suggestedResume && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                RESUME_STYLE[job.suggestedResume] ??
                  "bg-muted text-muted-foreground"
              )}
            >
              {job.suggestedResume}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
              st.bg,
              st.text
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
            {job.state}
          </span>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-md p-1 opacity-0 transition-opacity hover:bg-[var(--ag-overlay)] focus:opacity-100 group-hover/job:opacity-100"
            style={{ color: "var(--ag-text-mut)" }}
            title="Open posting"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md p-1 hover:bg-[var(--ag-overlay)]"
            title={open ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
              style={{ color: "var(--ag-text-dim)" }}
            />
          </button>
        </div>
      </div>

      {open && (
        <div
          className="ag-surface-2 ag-rowin mx-3 mb-3 space-y-1.5 rounded-md p-3 text-[11px]"
          style={{ color: "var(--ag-text-2)" }}
        >
          {job.fitReason && <p className="leading-snug">{job.fitReason}</p>}
          <div
            className="flex flex-wrap gap-x-4 gap-y-1"
            style={{ color: "var(--ag-text-mut)" }}
          >
            <span>
              posted <span className="ag-num">{job.postedAt ?? "—"}</span>
            </span>
            <span>
              added <span className="ag-num">{job.insertedAt}</span>
            </span>
            {job.surfacedAt && (
              <span>
                surfaced <span className="ag-num">{job.surfacedAt}</span>
              </span>
            )}
            {job.appliedAt && (
              <span>
                applied <span className="ag-num">{job.appliedAt}</span>
              </span>
            )}
          </div>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:underline"
            style={{ color: "var(--ag-accent)" }}
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{job.url}</span>
          </a>
        </div>
      )}
    </div>
  );
}
