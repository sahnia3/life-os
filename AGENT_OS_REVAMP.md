# Agent OS — Revamp Plan (Round 3)

## Diagnosis (from research across 16 tools + design + hooks)

The dashboard is **forgettable because it's a passive viewer, not a control plane**. Every serious tool in this space (claude-squad 7.5k★, omnara, claude-control, vibe-kanban 26k★) converges on: authoritative event ingestion via **Claude Code hooks**, an **attention queue** ("who needs me?"), and **mission-control aesthetics** (Linear-grade density). We poll JSONL; they get pushed structured events. That's the gap.

## What we steal (ranked by stickiness)

1. **HTTP hook substrate** — Claude Code supports `type:"http"` hooks that POST structured JSON to a URL with zero shell glue. Events: `SessionStart`, `Stop`, `StopFailure`, `Notification` (matchers `permission_prompt`, `idle_prompt`), `PreToolUse`, `PostToolUse`, `SubagentStop`, `PreCompact`. This replaces JSONL-polling with real-time push and is the substrate everything else rides on.
2. **"Who Needs Me?" attention queue** — single ranked list across all sessions of agents blocked on permission/input, with the actual question. The #1 multi-session pain ("didn't notice it was waiting 20 min").
3. **Authoritative status** — Working / Idle / Waiting / Errored / Finished from hooks, not CPU/JSONL heuristics.
4. **Browser push notifications** — permission_prompt → urgent, idle_prompt → medium, Stop → done chime, StopFailure(rate_limit) → critical.
5. **Mission-control visual revamp** — Linear neutral ramp (`#08090a→#0f1011→#161718`, hairline `#23252a` inset rings, no drop shadows), Inter+mono, `tabular-nums` everywhere, negative letter-spacing, bento grid, 8px status dots w/ pulse, sparklines, tighter density (p-3, rounded-md, 13px base).
6. **Command palette (⌘K)** + single-key nav (1–9 jump to session, j/k, g/G) + inline kbd hints.
7. **Top status strip** — aggregate: N working / N waiting / N error / total burn / window % — mono, always visible.
8. **Cross-session file-collision detector** — PreToolUse aggregates `file_path` across sessions; warn when two agents touch the same file.
9. **Live tool-call activity stream** — already partly built; restyle as append-only mono ticker.
10. **Cost/burn aggregate** — already have rate-limit; add per-session burn velocity.

## Build order

- **A. Hook substrate**: `POST /api/agent-os/hook` ingest → `hook_events` SQLite table + in-memory live state + SSE broadcast. Installer script merges an `http` hook block into `~/.claude/settings.json` (with timestamped backup) and a non-invasive fallback doc. Watcher keeps working as fallback.
- **B. Attention queue**: derive blocked sessions from `Notification`/`Stop`; render as the hero panel.
- **C. Visual revamp**: Linear token layer in `globals.css`, restyle `AppShell`/cards/StatusDot/TokenMeter, bento grid on `/agent-os`, top status strip.
- **D. Command palette**: `cmdk` ⌘K with Sessions/Actions/Nav groups + keyboard nav.
- **E. Push notifications**: Web Notifications API on attention-queue changes; optional ntfy webhook passthrough.
- **F. Collision detector**: PreToolUse file-path aggregation panel.

All additive — existing watcher/Today/Projects/terminal-embed keep working. Hooks are an enhancement layer that upgrades fidelity from "polled guess" to "pushed truth".
