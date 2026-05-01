# Security Posture

**Audit baseline:** commit `63b18a0` (HEAD on `main`, 2026-05-01)
**Stack:** Next.js 16.2.4, Supabase Auth + Postgres (RLS), OpenAI, Google Calendar OAuth

This document captures the current security state of the codebase plus the hardening pass tracked in
`/Users/sanay/.claude/plans/add-rate-limiting-to-humble-knuth.md`. It is meant as living documentation:
re-run the verification commands at the bottom whenever you want to re-confirm the posture.

---

## 1. Rate Limiting

Storage: Supabase table `api_rate_limits` (see `supabase/migrations/008_generate_list_rate_limit.sql`).
Rolling window, RLS-protected (users can read only their own rows). The hardening pass extends the table
with a `key` column so the same table can hold both per-user and per-IP+email entries (auth wrappers).

| Route | Method | Status (HEAD) | Window | Max | Key |
|---|---|---|---|---|---|
| `/api/auth/signin` | POST | **NEW** | 15 min | 5 | `ip+email` |
| `/api/auth/signup` | POST | **NEW** | 15 min | 5 | `ip+email` |
| `/api/auth/reset` | POST | **NEW** | 15 min | 5 | `ip+email` |
| `/api/assistant` | POST | already limited | 24 h | 100 | `user.id` |
| `/api/assistant/research-brief` | POST | already limited | 24 h | 25 | `user.id` |
| `/api/assistant/research-brief/followup` | POST | already limited | 24 h | 50 | `user.id` |
| `/api/generate-list` | POST | already limited | 24 h | 5 | `user.id` |
| `/api/assistant/digest` | GET | unrate-limited (cached 7d, by design) | — | — | — |
| `/api/assistant/opening` | GET | unrate-limited (idempotent guard, by design) | — | — | — |
| `/api/assistant/tasks` | GET | unrate-limited (idempotent, by design) | — | — | — |
| `/api/delete-account` | DELETE | **NEW** | 24 h | 3 | `user.id` |
| `/api/validate-share-email` | POST | **NEW** | 1 h | 20 | `user.id` |
| `/api/colleges/search` | GET | **NEW** | 1 h | 120 | `user.id` |
| `/api/colleges/[slug]` | GET | **NEW** | 1 h | 240 | `user.id` |
| `/api/calendar/google/connect` | GET | **NEW** | 1 h | 10 | `user.id` |
| `/api/calendar/google/callback` | GET | **NEW** | 1 h | 10 | `ip` (pre-auth) |
| `/api/calendar/google/disconnect` | POST | **NEW** | 1 h | 10 | `user.id` |
| `/api/calendar/google/status` | GET | **NEW** | 1 h | 120 | `user.id` |
| `/api/calendar/google/sync-all` | POST | **NEW** | 1 h | 20 | `user.id` |
| `/api/calendar/google/sync-event` | POST | **NEW** | 1 h | 60 | `user.id` |

All limited routes return `429` with a `Retry-After` header on excess.

**Note on auth:** Supabase also enforces server-side throttles (default ~30/hr per IP for sign-in, configurable in
the Supabase dashboard). The 5/15min wrapper sits in front and is the stricter ceiling.

---

## 2. Secret Management

- `.env.local` is on disk locally but **not** tracked by git.
  - `.gitignore` lines 34-35 cover `.env*` and `.env.local`.
  - Confirmed via `git ls-files | grep -i env` (empty).
- No hardcoded secrets in source. All sensitive values come from `process.env.*`:
  - `OPENAI_API_KEY` (server-only)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only, used in `delete-account`, `validate-share-email`)
  - `GOOGLE_CLIENT_SECRET` (server-only)
  - `COLLEGE_SCORECARD_API_KEY` (server-only, currently unused in `src/`)
- `NEXT_PUBLIC_*` vars (intentionally exposed to client):
  - `NEXT_PUBLIC_SUPABASE_URL` — public project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon JWT scoped by RLS
  Both safe by Supabase design.
- Historical leaks: `git log --all -S 'sk-' -S 'AKIA' -S 'service_role'` returns no literal secrets, only env-var references.

---

## 3. Input Validation & Payload Guards

| Route | JSON parse | Body size cap | Schema | Char limits |
|---|---|---|---|---|
| `/api/auth/*` (new) | safe-parse helper | 4 KB | zod (email, password, redirectTo) | email ≤ 254 |
| `/api/assistant` | safe-parse helper | 256 KB | zod (messages array, ≤ 50 msgs) | content ≤ 4000 |
| `/api/assistant/research-brief` | already zod (`dossierSchema`) | 100 KB | `src/lib/research-brief/schema.ts` | enforced by schema |
| `/api/assistant/research-brief/followup` | already zod (`followupItemsSchema`) | 100 KB | same | enforced |
| `/api/generate-list` | safe-parse helper | 100 KB | zod (`QuizAnswers`) | per-field |
| `/api/validate-share-email` | safe-parse helper | 4 KB | zod (email) | email ≤ 254 |
| `/api/colleges/search` | n/a (GET) | n/a | query param guard | `q` ≤ 200 |
| `/api/calendar/google/sync-event` | safe-parse helper | 4 KB | zod (uuid, name ≤ 200, ISO date) | enforced |

Helpers added by the hardening pass:
- `src/lib/parse-json-body.ts` — reads body with explicit size cap, returns `413` if exceeded, `400` on malformed JSON.
- `src/lib/rate-limit.ts` — single source of truth for rate-limit checks/records.
- `src/lib/schemas/*.ts` — zod schemas colocated by domain.

---

## 4. OWASP Top 10 Posture

| ID | Category | Status | Evidence |
|---|---|---|---|
| A01 | Broken Access Control | OK | `supabase.auth.getUser()` on all protected routes; role-gating on student-only endpoints; brief-ownership check at `research-brief/followup/route.ts`; RLS on all tables. |
| A02 | Cryptographic Failures | OK | OAuth state cookie `secure=true` in prod (`calendar/google/connect/route.ts`), Supabase JWT validated server-side. |
| A03 | Injection | OK | Supabase SDK uses parameterized queries; no string-interpolated SQL; `colleges/search` uses parameterized `.ilike`. |
| A04 | Insecure Design | Hardened | Rate limits now cover every endpoint; body size caps + zod schemas reject oversized/malformed payloads. |
| A05 | Security Misconfiguration | OK | Next.js 16.2.4 (3 high CVEs patched in `a782013`); no debug endpoints exposed. |
| A06 | Vulnerable Components | OK | `npm audit fix --force` was run in `a782013`. Re-run quarterly. |
| A07 | ID & Auth Failures | OK | Supabase Auth (PBKDF2/bcrypt by Supabase); 5/15min wrapper on signin/signup/reset. |
| A08 | Software/Data Integrity | OK | Pinned package versions; Supabase migrations under version control. |
| A09 | Logging & Monitoring | Partial | Errors logged via `console.error`; no structured audit log of rate-limit hits or auth failures. **Residual risk — see below.** |
| A10 | SSRF | OK | No user-controlled URLs in server fetches; OAuth callbacks use hardcoded redirect targets. |

---

## 5. Residual Risks (not addressed in this pass)

1. **CSRF on non-OAuth POSTs.** Supabase session cookies are `SameSite=Lax`, which mitigates cross-site
   form submission but not all CSRF vectors. Consider adding double-submit tokens if a richer threat model
   emerges (e.g. embedding the app in third-party iframes).
2. **No MFA enforcement.** Supabase supports MFA but it's not required. Worth enabling for counselor accounts
   given they can see multiple students' data.
3. **No audit log for rate-limit hits or auth failures.** The `api_rate_limits` table records *successful*
   calls only. If you want to detect brute-force attempts, add a `denied` flag or a separate
   `auth_audit` table.
4. **Service-role key on hot paths.** `validate-share-email` and `delete-account` use the service role.
   Both routes are auth-gated and rate-limited, but a logic bug would have full DB access. Consider
   moving the privileged work into a Supabase Edge Function with stricter input contracts.

---

## 6. Verification Commands

Re-run any time. All safe / read-only except where noted.

```sh
# 1. Confirm no env files tracked
git ls-files | grep -i env  # expect: empty

# 2. Secret scan across full history
git log --all -p -S 'sk-' -S 'AKIA' -S 'service_role' -- '*.ts' '*.tsx' '*.js' '*.json' \
  | grep -E '(sk-[A-Za-z0-9]{16}|AKIA[0-9A-Z]{16})' || echo "clean"

# 3. List NEXT_PUBLIC_* usages (should only be SUPABASE_URL / SUPABASE_ANON_KEY)
grep -rn 'NEXT_PUBLIC_' src/

# 4. Rate-limit smoke test (against running dev server)
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/signin \
    -H 'Content-Type: application/json' -d '{"email":"x@x.com","password":"wrong"}'
done   # expect: ...,200,200,200,200,200,429

# 5. Body-size guard
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/assistant \
  -H 'Content-Type: application/json' --data-binary "@<(yes a | head -c 300000)"
# expect: 413

# 6. Malformed JSON
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/generate-list \
  -H 'Content-Type: application/json' -d 'not json'
# expect: 400

# 7. Build + lint
npm run lint && npm run build
```

---

## 7. Reporting a Vulnerability

Email: sanaytyagi@gmail.com. Please do not file public GitHub issues for suspected vulnerabilities.
