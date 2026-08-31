# Security Policy

**Stack:** Next.js 16.2.4, Supabase Auth + Postgres (RLS), Anthropic API, Stripe, Google Calendar OAuth

## Reporting a Vulnerability

Email **sanaytyagi@gmail.com** with a description of the issue and, if possible, steps to reproduce.
Please do **not** open a public GitHub issue for a suspected vulnerability.

Expect an acknowledgement within a few days. Please give a reasonable window to ship a fix before
any public disclosure.

## Posture Summary

Trailr handles student application data, so the following controls are in place:

- **Authentication** — Supabase Auth. Every protected API route validates the session server-side via
  `supabase.auth.getUser()`. Sign-in, sign-up, and password reset are rate limited per IP + email.
- **Authorization** — Postgres Row Level Security on all user-data tables, plus role gating on
  student-only and counselor-only endpoints. Resource ownership is checked at the route level.
- **Rate limiting** — Every API route is rate limited, backed by a Postgres table with a rolling
  window. Limited routes return `429` with a `Retry-After` header.
- **Input validation** — All request bodies pass through an explicit size cap and a zod schema before
  reaching any handler. Oversized payloads get `413`, malformed ones `400`.
- **Injection** — All database access goes through the Supabase SDK with parameterized queries. No
  string-interpolated SQL anywhere in the codebase.
- **Secrets** — No secrets in source or in git history. All sensitive values are read from the
  environment at runtime and are server-only. The two `NEXT_PUBLIC_*` values (Supabase project URL and
  anon key) are public by Supabase's design and are scoped by RLS.
- **Dependencies** — Versions are pinned; `npm audit` is reviewed periodically.

## Data Handling

- Users can delete their account from Settings, which removes their rows across all tables.
- See the [Privacy Policy](src/app/privacy/page.tsx) and [Terms of Service](src/app/terms/page.tsx)
  for what is collected and which third-party processors are involved.
