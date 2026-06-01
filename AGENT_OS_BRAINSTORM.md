# Agent-OS Brainstorm — Leveling Up the Agentic OS

Generative ideation for the Life-OS agent layer. Grounded in the current codebase, the revamp vision, Aditya's projects/workflow, and the early-2026 AI capability landscape. Opinionated by design.

---

## 1. Honest assessment (where it actually is)

The observability spine is real and good. Chokidar → SQLite (`lib/agent-os/db.ts`, `data/agent_os.db`) → SSE (`app/api/agent-os/stream/route.ts`) genuinely works: token events, session state, file-collision detection, the attention queue, today digest, history search, projects tracker, and the Polymarket pipeline reader all flow live data. That is a legitimate mission-control read layer for the 3-4 concurrent sessions Aditya runs.

What is scaffold or theater: anything that _acts_ rather than _observes_. Playbook execution has a Run button but no spawner. Live terminals show names, no I/O. Handoff has a DB schema and a stub recap generator that nothing calls. The bridge supervisor is a 2KB stub. Role classification exists in `classifier.ts` but is never invoked. Digests/anchors are DB-wired with no edit UI. The "today narrative" is heuristic string-building, not LLM synthesis. Net: Agent-OS is a strong **passive telescope** pointed at his agent fleet, and a **non-functional cockpit**. The entire next phase is converting read-only widgets into write/act loops — and crucially, none of the four things he's asking for require the broken parts to work first. They're all additive on top of the solid spine. One more asset to fold in: a **separate, already-live automation — the Job-Watcher** (standalone Python project, daily LaunchAgent, currently scoring 131 real jobs into Discord) — lives outside this repo but belongs surfaced inside Life-OS. It is treated as existing foundation, not new build (see 3.5).

---

## 2. The three requested features, fully designed

### 2.1 Daily auto-triggered MapleRewards code review

**What it does.** Every morning, with zero prompting, a headless Claude run does a deep multi-angle review of the MapleRewards repo (bugs, financial-math sanity, security, stale offer data, regressions vs yesterday) and posts a graded, scannable report into Life-OS plus Discord. This is the highest-value item on the list because it directly attacks his #1 documented pain: single-defect financial-math bugs that silently destroy value (the optimizer cap bug projecting 500K points on $100K spend, LogSpend cap bug, multi-pax CPP inflation).

**How it works in this stack.**

- Scheduler: a **Routine** (cloud-scheduled Claude Code agent, launched Apr 2026) firing ~07:00 America/Toronto — fires even with his laptop closed, no VPS. Fallback: macOS LaunchAgent `com.maplerewards.review.plist` matching his existing Job-Watcher pattern, calling `claude -p` headless via the Agent SDK.
- Review engine: spin specialized subagents (`security-reviewer`, `code-reviewer`, plus a new `financial-math-auditor`) over the MapleRewards diff since the last reviewed commit. Or escalate to **Dynamic Workflows** (research preview, May 28 2026, up to 16 concurrent / 1,000 total subagents) for a full-repo sweep when `migrations/` or optimizer files change.
- Ingest: review writes structured JSON to `~/.claude/agent-os/reviews/maplerewards/<date>.json`, then POSTs to a new route `app/api/agent-os/reviews/route.ts`. New SQLite table `code_reviews (id, repo, date, commit_sha, grade, findings_json, severity_counts, ts)` in `db.ts`.
- Surface: new page `app/agent-os/reviews/page.tsx` — graded card per day (he wants explicit grades like 7.2/10, not superlatives), severity-ranked findings, diff-since-yesterday, "still open from N days ago" tracking. Discord webhook for the push.

**Data flow.** `Routine (cron) → claude -p over MapleRewards repo → subagent fan-out → findings.json → POST /api/agent-os/reviews → code_reviews table → /agent-os/reviews page + Discord`.

**The cool version.** A `financial-math-auditor` subagent with a hard-coded invariant library: returns >100% flagged, phantom ensemble member counts, uncapped multipliers, negative-edge bets, any optimizer output where points-per-dollar exceeds the best card's published rate. It runs as a **PreToolUse hook on MapleRewards commits** — not just a morning report, but a guardrail that blocks the class of bug _before it ships_. The daily page becomes a trend line of "math invariants held / violated" and the review can open/close items directly in his `mr.open-issues` tracker. This is the difference between "a bot that reviews code" and "a bot that has never once let a 500K-points bug reach prod again."

### 2.2 Self-improving information page

**What it does.** A page that gets smarter on its own — accumulates knowledge about his projects, corrects itself when it's wrong, and surfaces what it has learned. Not a static dashboard; a living brief.

**How it works in this stack.** The substrate already exists — he runs the Karpathy 3-layer knowledge loop (SessionEnd → daily-logs → `compile.py` every 6h → Obsidian articles). The self-improving page is the **read+feedback surface** over that loop wired into Life-OS.

- New page `app/agent-os/brief/page.tsx` rendering a synthesized "what the system knows right now" view: per-project state (MapleRewards launch blockers, polymarket win-rate status, open issues), recently-learned facts, and recently-_corrected_ facts.
- Backing store: new table `knowledge_cards (id, topic, claim, confidence, source_session, last_verified, supersedes_id, status)`. Each card is a learned assertion with a confidence score and provenance.
- The learning loop: a nightly Haiku-backed Routine reads the day's session logs + Obsidian articles, extracts new claims, dedupes against existing cards, and — the key part — runs a **contradiction check**: if a new claim conflicts with an existing card, it marks the old one superseded and links them. So the page literally rewrites itself as facts change.
- Verification, not just accumulation: a card unverified for N days gets a "stale, re-check" flag (mirrors his offer-freshness instinct). This respects his non-negotiable "verify before claiming" rule — every card shows last-verified date and source.

**Data flow.** `SessionEnd logs + Obsidian articles → nightly Haiku extractor → claim dedup + contradiction check → knowledge_cards (insert / supersede / flag-stale) → /agent-os/brief renders cards grouped by project, sorted by recency, with a "corrected itself" feed`.

**The cool version.** The page shows its own diff. A "what changed in what I know" timeline: "Tuesday I believed Polymarket capital was $87; corrected to $28 after cycle-log read." Plus an **accuracy self-score**: when a card it asserted later gets contradicted by reality, it tracks its own hit rate over time. A knowledge base that publicly grades its own reliability is genuinely novel and exactly his taste (brutal honesty, self-scoring systems).

### 2.3 Latest-AI-developments page

**What it does.** A concise, scannable page surfacing new AI capabilities relevant to _his_ stack and projects — not generic AI news. Ranked by "can I wire this into Life-OS / MapleRewards / the trading bot this week."

**How it works in this stack.** This is the canonical 2026 daily-digest reference architecture, scoped to his interests.

- Sources via web fetch / MCP: Anthropic changelog + docs, MarkTechPost, Hacker News, GitHub trending, arXiv (cs.AI/cs.LG), select RSS. Streamable-HTTP MCP servers where available.
- Curation: a **Haiku** agent (right model for always-on volume — ~$1/Mtok in, prompt caching saves up to 90% on his stable system prompt) dedupes, then ranks each item against a fixed interest vector: `{Next.js 16, React 19, Claude Code/Agent SDK, agent orchestration, Polymarket/trading, Supabase/SaaS, Canadian fintech}`. Cheap enough to run daily for cents.
- Scheduler: a Routine at 09:00. Store to `ai_digest (id, date, title, source_url, category, relevance_score, why_it_matters, action)` table.
- Surface: `app/agent-os/ai-feed/page.tsx` — terse cards (he hates fluff): title, one-line "why it matters to you," a concrete "wire it like this" action, relevance score. Top items push to Telegram/Discord.

**Data flow.** `Routine 09:00 → fetch feeds → Haiku dedup + rank vs interest vector → ai_digest table → /agent-os/ai-feed (sorted by relevance) + Telegram top-3`.

**The cool version.** Each ranked item gets an auto-generated **"applicability probe"**: the digest agent greps his actual codebase (via Greptile Q&A API or a local Glob/Grep subagent) to answer "do I have code this would replace/improve?" So instead of "Dynamic Workflows shipped," the card reads "Dynamic Workflows shipped — your `playbooks.ts` tmux-spawn approach is exactly what this replaces; here's the migration." News filtered not just by topic but by _whether his own repo is ready for it_. That crosses from "feed reader" into "personalized upgrade advisor."

---

## 3. Committed build set (all greenlit)

> Status: every feature below is now committed (greenlit by Aditya), not an optional tail. 3.5 absorbs an existing **live** automation — the Job-Watcher — which gets surfaced and hardened inside Life-OS rather than rebuilt. §5 sequences the whole set into phases.

### 3.1 Unified Morning Command Center

- **Pitch.** One widget merging all four scattered automation streams into a single scannable briefing.
- **Why him.** He explicitly runs daily-briefing (Calendar+Gmail), Job-Watcher Discord digest, Polymarket overnight P&L, and assignment deadlines — across separate Discord channels. The merge is a stated automation opportunity.
- **How.** New `app/agent-os/morning/page.tsx` + `/api/agent-os/morning` fan-out: Google Calendar MCP, Gmail MCP (4 prioritized queries), pipeline reader for overnight P&L, MapleRewards offer-expiry, today's deadlines. One Telegram push.
- **Effort: M. Impact: high.**

### 3.2 Position / P&L Truth-Verifier

- **Pitch.** Agentic check that reconciles claimed YES/NO sides and fills against on-chain/CLOB + SQLite before any P&L is reported.
- **Why him.** Trust eroded badly after Claude misidentified trade sides and a botched FOK order caused 12c slippage. "Verify before claiming" is a hard, non-negotiable rule. This bakes it into the system instead of promising it.
- **How.** New `lib/agent-os/pnl-verify.ts`; PreToolUse/PostToolUse hook on the trading bot that blocks any P&L claim until the side + fill are reconciled against `trading.db` + chain. Surfaces a red "UNVERIFIED" badge in markets UI until reconciled.
- **Effort: M. Impact: high.**

### 3.3 Offer-Freshness Watcher for MapleRewards

- **Pitch.** Scheduled diff-watch over Amex CA / TD / RBC / Scotia / BMO / Aeroplan pages → auto-update `rewards.yaml` + CPP tables → "N expiring offers" alert.
- **Why him.** MapleRewards' core data goes stale fast (Aeroplan June 1 2026 devaluation, SQC migration, Amex March 2026 nerfs); he learns devaluations from US blogs days late. Converts a manual chore into a retention/revenue feature and a Canada-first information edge.
- **How.** Routine (daily) → fetch issuer pages → Haiku diff vs last snapshot → PR against `rewards.yaml` for approval (never auto-merge financial data) → expiry alert to Telegram + Life-OS panel.
- **Effort: M. Impact: high.**

### 3.4 Bounded Agent Budget Governor

- **Pitch.** A hard, observable cap across all concurrent sessions that throttles/pauses when burn exceeds budget.
- **Why him.** He got burned by 33 sessions/day eating the plan; "runaway-automation risk" and "bounded and observable" are explicit fears. From Jun 15 2026 headless SDK usage draws a separate Agent SDK credit — making budget tracking newly load-bearing.
- **How.** Extend the existing rate-limit/token rollup (`ratelimit.ts`, `tokens/route.ts`) with a budget ceiling in `projects.json`; when 5h-window effective tokens cross threshold, the attention queue raises a "BUDGET" item and optionally a Stop-hook soft-pause on background Routines. Top-strip shows budget % alongside window %.
- **Effort: S. Impact: high.**

### 3.5 Job & Co-op Command Center — fold in the existing Job-Watcher (FLAGSHIP)

This is the feature Aditya explicitly asked to include, and it is **not built from scratch** — a complete, live automation already exists and gets surfaced + extended inside Life-OS.

**What already exists (live — do not rebuild).** Standalone Python project at `/Users/adityasahni/Desktop/Claudecode/job-watcher/` (outside this repo). Daily 08:30 macOS LaunchAgent runs `cycle` = poll → score → digest:

- **Poll** — Greenhouse / Lever / Ashby public APIs for ~50 curated employers (Stripe, Citadel, Jane Street, Wealthsimple, TD, RBC, Anthropic, …), plus optional LinkedIn/Indeed via Apify actors (never his own account — Upwork-ban lesson).
- **Filter** (`watchers/base.py`) — intern/co-op/new-grad × SWE/ML/DS/quant/SRE only; Canada or remote, US only for J-1-sponsor whitelist.
- **Score** — Claude Haiku rates each job 0-10 fit + picks a resume variant (swe/ml/quant/ds); profile hardcoded in `scorer.py`. ~$0.05/day.
- **Digest** — Discord webhook, fit ≥ 7.0, cap 15/day. Never auto-applies; submission is always manual via `cli apply <id>` (which arms a 1-week follow-up).
- **Store** — SQLite `data/jobs.db`: `jobs`, `applications` (state machine scored→surfaced→applied→replied/interviewing/rejected/ghosted), `follow_ups`, `company_meta`. Live: **131 jobs, 78 surfaced, 53 scored** (top fits Stripe SWE 9.2, Capital One Backend 9.2).
- **Sibling asset** — 4 LaTeX resume variants + `~/Desktop/Claudecode/resumes/scripts/audit.py` (ATS parse-quality + AI-detection heuristic: em-dashes, smart quotes, buzzwords, passive voice).

**What Life-OS adds (the new build) — three layers:**

1. **Surface (read).** `app/api/jobs/route.ts` reads `jobs.db` via better-sqlite3 — exactly the pattern `app/api/trades/route.ts` already uses for the polymarket DB. New `JOB_WATCHER_DIR` env var beside `POLYMARKET_AGENT_DIR`. Page `app/agent-os/jobs/page.tsx`: a **kanban over the `applications` state machine** (scored / surfaced / applied / interviewing / …), each card = fit score, suggested resume, company, one-line reason, link. Stats strip: pipeline funnel, fits/day trend, response rate.
2. **Act (the assistant).** Pick a surfaced job → ATS keyword audit against the JD → confirm/pick resume variant → draft a cover letter in his philosophy (genuine product opinion + technical insight, never recite the resume) → pass the draft through `audit.py` (AI-detection + ATS clean) → land in an **approval queue**. On approve, mark applied (write state to `jobs.db` or shell `cli apply <id>`, auto-scheduling the 1-week follow-up). **NEVER** auto-submit; **NEVER** surface the AI pipeline in any output (hard rule — no "LLM/Haiku/Apify" leakage to recruiters).
3. **Fix + finish (reliability — his documented pain).** (a) LaunchAgent stopped firing (May 8) and never runs while the Mac sleeps → Life-OS **heartbeat**: if no `cycle` ran in 24h, raise an attention-queue "JOB-WATCHER STALE" item; optionally migrate the trigger to a cloud Routine so laptop state is irrelevant. (b) Apify free-tier exhausts (~$5/mo) → cost guard + alert on 403, degrade gracefully to public boards (already resilient). (c) Build the **unbuilt `follow_ups` dispatcher** — 1-week nudges surfaced in Life-OS + Telegram. (d) Add `--json` to the CLI for clean dashboard consumption.

**Data flow.** `LaunchAgent/Routine 08:30 → cycle (poll→score→digest) → jobs.db → /api/jobs → /agent-os/jobs kanban + assistant drafting → audit.py gate → approval queue → cli apply → follow_ups dispatcher → Life-OS + Telegram reminders`.

**The cool version.** A closed-loop funnel: every surfaced job you approve produces an ATS-audited, AI-detection-clean, human-voiced cover letter and a one-click "mark applied" that arms a follow-up — and the board **scores its own conversion** (surfaced→applied→reply rate) so the Haiku fit threshold can be tuned against real outcomes over time. A self-tuning job pipeline that hides every trace of being one.

- **Effort: M (surface) + M (assistant) + S (reliability). Impact: high — active search, one live callback (Acronym/Hydro One), real money + timing on the line.**

### 3.6 Session Drift / Handoff Auto-Nudge

- **Pitch.** Detect when a concurrent session hits context limits or drifts from its stated anchor, and push one prioritized "do X next" nudge.
- **Why him.** Context/continuity loss across 3-4 sessions is a constant tax. The anchor + classifier + handoff scaffolds already exist but are dead — this activates them.
- **How.** Finally wire `classifier.ts` into the JSONL parser; compare live session focus vs its anchor; on drift, raise an attention-queue item and call the dormant `handoff-recap.ts`. Turns parallel sessions from a monitoring burden into a managed queue.
- **Effort: M. Impact: med.**

### 3.7 Friction-Free Telegram Capture

- **Pitch.** `/task /habit /workout /energy /idea` → writes straight to Supabase.
- **Why him.** Mobile-first friction-free capture is the long-standing unbuilt Life-OS gap, and it feeds the correlation engine (3.8). He prefers Telegram and one-time setup over manual repetition.
- **How.** Telegram bot webhook → `app/api/telegram/route.ts` → parse command → insert into existing Supabase tables (tasks, habit_logs, workout_sets, weight_logs, notes). He already has `TELEGRAM_BOT_TOKEN` env scaffolded.
- **Effort: S. Impact: med.**

### 3.8 Fitness / Energy / Productivity Correlation Engine

- **Pitch.** Ingest workouts, energy ratings, task completion → surface patterns ("you finish ~40% more tasks when morning energy >7").
- **Why him.** This is _the original point of Life-OS_ and it's unbuilt. The cross-module insight layer is the whole thesis.
- **How.** Weekly Routine joins `weight_logs`/`workouts`/`habit_logs`/`tasks` in Supabase, runs correlation, writes a weekly insight card. Depends on 3.7 for energy input. Render in `/agent-os/brief` (ties to the self-improving page).
- **Effort: M. Impact: med.**

### 3.9 Trading Win-Rate Gate + Auto-Resume

- **Pitch.** Scheduled Brier/calibration report on resolved trades; auto-flag when the strategy crosses the 65-70% win-rate bar he set for un-pausing the pipeline.
- **Why him.** The pipeline is PAUSED (May 19) pending exactly this threshold; he's eyeballing it manually. The half-built `brier-trend.tsx` / `city-pnl.tsx` components are waiting for a real scoring engine.
- **How.** Build the actual scoring engine reading resolved trades from `trading.db`; compute rolling Brier + win-rate per city; when threshold crossed, raise an attention item "strategy cleared 67% — review for un-pause." Finishes the stubbed P&L attribution components.
- **Effort: M. Impact: med.**

### 3.10 Codebase Q&A Panel

- **Pitch.** Ask the dashboard "where is the trades SQLite read?" / "which route handles auth?" and get cited answers across life-os + polymarket-agent + MapleRewards.
- **Why him.** Sprawling `app/` + `lib/` plus a separate polymarket-agent repo; the Supabase MCP + Greptile Q&A API make this cheap. Reduces the continuity tax.
- **How.** `app/agent-os/ask/page.tsx` using Greptile API (full-repo graph) or a local Grep/Glob subagent via Agent SDK. Vercel AI SDK generative UI to render cited code snippets inline.
- **Effort: M. Impact: med.**

### 3.11 Ruflo Bounded Benchmark (validate or retire)

- **Pitch.** One bounded benchmark task: claude-flow swarm vs manual subagents vs Dynamic Workflows on a real MapleRewards/Life-OS workload.
- **Why him.** Ruflo is configured-but-never-validated "pure unrealized potential." Dynamic Workflows (native, on by default on Max) may have made it redundant. Decide deliberately, don't let it rot.
- **How.** Pick a parallelizable task (e.g. mass component analysis), run all three, record wall-clock + token + quality into a `benchmark` card on `/agent-os/brief`. Either adopt or drop.
- **Effort: S. Impact: low-med.**

### 3.12 Academic Deadline Sentinel

- **Pitch.** Surfaces upcoming assignment deadlines (Mondays 11:59 PM) with per-course urgency, blended into the morning center.
- **Why him.** Winter 2026 term, 4 courses, assignments due Mondays, 29 color-coded calendar events. Low effort, removes a recurring "did I forget something" check.
- **How.** Read the existing color-coded Google Calendar via MCP, filter to course events, rank by due date, feed the morning command center. No new infra.
- **Effort: S. Impact: low.**

### 3.13 Benchmark Everything (standing harness)

- **Pitch.** Generalize the Ruflo validate-or-retire (3.11) into a reusable harness: run any real workload across manual subagents vs Dynamic Workflows vs claude-flow/Ruflo, record wall-clock + tokens + a quality score, render a leaderboard.
- **Why him.** He has multiple overlapping orchestration tools (subagents, Dynamic Workflows on by default, configured-but-unvalidated Ruflo) and no empirical basis to choose. He likes self-scoring systems and bounded experiments. Turns "which orchestrator?" from a vibe into a measured decision, and feeds the Budget Governor (3.4) real cost-per-approach data.
- **How.** A `benchmarks` table + `app/agent-os/bench/page.tsx`. Define a workload spec (task + grader), run it through each backend via the Agent SDK, log `{backend, wall_ms, tokens, cost, quality_score, run_at}`. 3.11 is just the first entry; any new approach or model drops in and is compared on the same workloads.
- **Effort: M. Impact: med — decision infrastructure; compounds as model/tooling churn continues.**

---

## 4. Cool factor (the wow ideas)

1. **The self-grading knowledge base (2.2 cool version).** A page that shows its own corrections over time and tracks its accuracy hit-rate. Most "self-improving" pages just append. This one supersedes, contradicts, and publicly grades its own reliability. It embodies his entire ethos — brutal honesty, self-scoring, no validation theater — in a UI surface.

2. **The financial-math guardrail that has never let a money-bug ship (2.1 cool version).** Not a reviewer that comments after the fact — a PreToolUse hook with an invariant library that _blocks the commit_ when optimizer output violates bounds. Given his exact history (abs() edge bug put 51% of capital into known-bad bets; Student-t scale bug overbet every trade), an agent that structurally cannot let that recur is the most viscerally valuable thing here.

3. **News filtered by whether your own repo is ready for it (2.3 cool version).** An AI-developments feed that greps his actual codebase and says "you have code this replaces, here's the migration." That is the AI-automation-consultant playbook — productize this exact pattern and it's sellable.

---

## 5. Committed build roadmap (everything below is greenlit)

All features are committed. Sequenced by dependency + payoff. Phases 0-2 establish the shared spine (cron→ingest→page→push + observability) that the rest reuse.

**Phase 0 — Observability gate (do first).**

- **3.4 Bounded Agent Budget Governor (S)** — hard cap before scaling always-on jobs; the Jun 15 2026 separate-SDK-credit change makes this load-bearing. Gates everything that follows.

**Phase 1 — Prove the spine (two zero-dependency Routine features).**

- **2.1 Daily MapleRewards review + `financial-math-auditor` invariant hook (M)** — #1 pain, highest payoff. Ship the invariant guardrail as the first slice.
- **2.3 Latest-AI feed with repo-readiness probe (M)** — cheap Haiku, proves cron→ingest→page→push end to end.

**Phase 2 — Fold in the existing Job-Watcher (flagship, mostly surface work).**

- **3.5 Job & Co-op Command Center (M+M+S)** — surface `jobs.db` (mirror the trades route), kanban over the application state machine, assistant drafting through `audit.py`, fix LaunchAgent staleness + build the follow-up dispatcher. Active search + a live callback make this time-sensitive; pull earlier if a deadline is hot.

**Phase 3 — Self-improving + trust loops.**

- **2.2 Self-grading knowledge brief (L)** — reuses the ingest pattern; the contradiction-check loop is the real work, substrate (knowledge loop) already exists.
- **3.2 P&L Truth-Verifier (M) + 3.9 Win-Rate Gate (M)** — unblock trading trust + the paused pipeline; finish the half-built markets components.

**Phase 4 — Merge the streams + close gaps.**

- **3.1 Morning Command Center (M) + 3.7 Telegram Capture (S)** — one briefing; Telegram unlocks the correlation engine.
- **3.3 Offer-Freshness Watcher (M)** — MapleRewards retention feature.
- **3.6 Session Drift / Handoff Auto-Nudge (M)** — activates the dead classifier/handoff scaffolds.

**Phase 5 — Decision infrastructure + longer tail.**

- **3.10 Codebase Q&A (M), 3.11 Ruflo validate-or-retire (S) → 3.13 Benchmark Everything (M), 3.8 Correlation Engine (M), 3.12 Academic Deadline Sentinel (S).**

Sequencing logic: gate spend (Phase 0), prove the reusable pipeline on two self-contained wins (Phase 1), then layer the loops that reuse it. The Job-Watcher is treated as existing foundation — Phase 2 surfaces and hardens it, never rebuilds it. Activate dead scaffolds (handoff, classifier, brier components) only once the new spine proves out.
