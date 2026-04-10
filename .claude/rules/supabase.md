---
globs: "**/*.{ts,tsx,sql}"
---

# Supabase Rules

- Browser client: `lib/supabase/client.ts` (uses @supabase/ssr)
- Server client: `lib/supabase/server.ts` (uses cookies from next/headers)
- Admin client: `lib/supabase/admin.ts` (service role key — use sparingly)
- New tables must have RLS policies — enable RLS and add per-user SELECT/INSERT/UPDATE/DELETE policies
- Schema changes go in new migration files in `supabase/migrations/` — never edit existing ones
- Foreign keys should CASCADE on delete where appropriate
