@AGENTS.md

## Knowledge Base

Full project context (8 modules, tech stack, design system, status): `~/Desktop/obsidian/my working/knowledge/concepts/personal-dashboard.md`
Read the QUICK_CONTEXT block at the top before exploring the codebase.

## Stack

- **Next.js 16.2.2** (App Router) + React 19 + TypeScript (strict)
- **Supabase**: PostgreSQL + Auth (Google OAuth) + RLS
- **Styling**: Tailwind CSS 4 + shadcn/ui + Framer Motion
- **State**: React Query (server), Zustand (UI), next-themes
- **Root**: `/Users/adityasahni/Desktop/Claudecode/life-os/`

## Commands

```bash
npm run dev       # Dev server (port 3001)
npm run build     # Production build
npm run lint      # ESLint
npm start         # Production server
```

## Architecture

```
App Router (layout.tsx → Providers → AppShell → page.tsx)
  ├── Server Components (default) — Supabase server client via cookies
  ├── Client Components ("use client") — Supabase browser client
  ├── API Routes (app/api/*/route.ts) — some query polymarket-agent SQLite directly
  └── Middleware (middleware.ts) — auth check, redirect to /login
```

### Key Paths

- `app/layout.tsx` — Root layout (fonts, metadata, Providers wrapper)
- `app/page.tsx` — Dashboard home (/)
- `components/layout/app-shell.tsx` — Sidebar + BottomNav + Framer Motion transitions
- `components/layout/sidebar.tsx` — Desktop nav (collapsible via Zustand)
- `lib/supabase/client.ts` — Browser Supabase client (@supabase/ssr)
- `lib/supabase/server.ts` — Server Supabase client (cookies)
- `stores/sidebar-store.ts` — Persisted to localStorage
- `middleware.ts` — Auth guard (skips if Supabase env vars missing)

### Pages

`/` dashboard, `/tasks` kanban, `/calendar`, `/fitness`, `/ideas`, `/markets`, `/assistant` AI chat, `/login`, `/signup`

### API Routes

- `api/agents/status/` — Agent run metrics (reads polymarket SQLite)
- `api/agents/events/` — SSE stream of agent events
- `api/trades/` — Trade data from polymarket-agent SQLite

### Supabase Migrations (7 files)

1. `00001_foundation.sql` — profiles + auth trigger
2. `00002_tasks.sql` — tasks, subtasks (kanban)
3. `00003_notes.sql` — notes/ideas with tags
4. `00004_fitness_habits.sql` — weight_logs, workouts, workout_sets, habits, habit_logs
5. `00005_calendar.sql` — events
6. `00006_ai_chat.sql` — AI chat messages
7. `00007_markets.sql` — trades, analyses, portfolio_snapshots

## Never Edit

- `.next/`, `node_modules/` — build output / dependencies
- `package-lock.json` — lock file
- `next-env.d.ts` — auto-generated TS definitions

## Env Vars Required

```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
POLYMARKET_AGENT_DIR=/Users/adityasahni/Desktop/Claudecode/polymarket-agent
# Optional: ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
```

## Gotchas

- **Next.js 16 breaking changes** — read `node_modules/next/dist/docs/` before writing code
- **Tailwind CSS 4** — different from v3, new PostCSS plugin format
- API routes read polymarket-agent's SQLite directly — that DB must exist
- Middleware gracefully skips auth if Supabase env vars missing (local dev)
- All Supabase tables have RLS — queries fail silently without auth context
- Custom CSS variables in `globals.css` (--bg-surface, --border-mid, etc.)

## Known Issues

See `known-issues/` directory for documented bugs and resolutions.
