---
globs: app/**/*.{ts,tsx}
---

# Next.js 16 Rules

- This is Next.js 16 with BREAKING CHANGES — read `node_modules/next/dist/docs/` before writing code
- Default components are Server Components — add "use client" only when needed
- Data fetching: `fetch()` in Server Components, React Query in Client Components
- API routes use `route.ts` with named exports (GET, POST, etc.)
- Middleware in `middleware.ts` handles auth — do not add auth checks in individual routes
- All Supabase tables have RLS — queries fail silently without proper auth context
