# Production Deployment Checklist

Audit of [college-tracker](.) (Next.js 16.2.4 + Supabase + Anthropic + Stripe + Google Calendar) for items that need to be configured, changed, or verified before going live.

Generated 2026-05-20. Cross-reference [SECURITY.md](SECURITY.md), [ratelimiting.md](ratelimiting.md), and [TODOS.md](TODOS.md) — items already tracked there are flagged but not duplicated in detail.

---

## 1. Environment Variables

The app currently reads these at runtime. All must be set in the production environment (Vercel project settings) before deploy:

**Server-only (must be secret):**
- `ANTHROPIC_API_KEY` — used by [src/app/api/assistant/*](src/app/api/assistant/) and cron jobs
- `SUPABASE_SERVICE_ROLE_KEY` — used by [src/lib/supabase/admin.ts](src/lib/supabase) and rate-limit admin client
- `STRIPE_SECRET_KEY` — live key, not test key, in prod
- `STRIPE_WEBHOOK_SECRET` — must match the live webhook endpoint signing secret
- `STRIPE_PRICE_PLUS`, `STRIPE_PRICE_UNLIMITED` — live mode price IDs (NOT test mode)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — production OAuth client
- `GOOGLE_REDIRECT_URI` — must point at the prod domain (`https://<prod>/api/calendar/google/callback`)
- `CRON_SECRET` — random high-entropy string; verify [vercel.json](vercel.json) cron jobs send it

**Public (exposed to client, safe by design):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` — **must be the production URL** (used in [src/lib/stripe.ts:41](src/lib/stripe.ts#L41) for Checkout success/cancel URLs; wrong value here breaks billing redirects)
- `NEXT_PUBLIC_COUNSELOR_ENABLED` — confirm intended value for launch

**Action:** Diff `.env.local` against the Vercel prod env list — every key above present, no test-mode values leaking through.

---

## 2. Stripe — Live Mode Cutover

The billing flow at [src/app/api/billing/](src/app/api/billing/) currently has placeholder/test plumbing. Before launch:

- [ ] Create live-mode Products + Prices in Stripe dashboard ($10/mo Plus, $20/mo Unlimited — matches [src/lib/plans.ts](src/lib/plans.ts))
- [ ] Set `STRIPE_PRICE_PLUS` / `STRIPE_PRICE_UNLIMITED` to the live price IDs
- [ ] Register live webhook endpoint at `https://<prod>/api/billing/webhook`, subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` (verify against [src/app/api/billing/webhook/route.ts](src/app/api/billing/webhook/route.ts))
- [ ] Copy live webhook signing secret into `STRIPE_WEBHOOK_SECRET`
- [ ] Test full purchase loop end-to-end against the deployed URL using a real card before announcing
- [ ] Decide on Stripe Tax / billing address collection — currently not configured in the Checkout session
- [ ] Confirm `allow_promotion_codes: true` ([checkout/route.ts](src/app/api/billing/checkout/route.ts)) is intentional for launch

---

## 3. Supabase

- [ ] All 11 migrations in [supabase/migrations/](supabase/migrations/) applied to the prod project, in order
- [ ] RLS verified on every user-data table (run `select tablename, rowsecurity from pg_tables where schemaname='public';`)
- [ ] `auth.users` email confirmations / SMTP configured (Supabase default SMTP is rate-limited and unsuitable for prod — connect SendGrid/Resend/Postmark)
- [ ] Supabase project auth rate limits reviewed in dashboard (defaults are low; the 5/15min app-side wrapper from [SECURITY.md](SECURITY.md#1-rate-limiting) is in addition to these, not a replacement)
- [ ] Auth redirect URLs in Supabase dashboard include the prod domain (otherwise OAuth + email confirm links break)
- [ ] Production DB backups enabled (paid tier — Supabase free tier has 7-day PITR off)
- [ ] Service-role key rotated if it was ever shared in chats/screenshares

---

## 4. Google Calendar OAuth

- [ ] Google Cloud Console OAuth consent screen published (not in "Testing" mode — Testing mode limits to 100 users and expires tokens after 7 days)
- [ ] Authorized redirect URIs include `https://<prod>/api/calendar/google/callback`
- [ ] Authorized JavaScript origins include `https://<prod>`
- [ ] Scopes match what the app requests; if calendar scopes are sensitive, app verification may be required by Google
- [ ] **TODO: Token encryption at rest** — tracked in [TODOS.md](TODOS.md). Currently `access_token`/`refresh_token` are stored in plaintext in `user_integrations`. Strongly recommended before public launch.

---

## 5. Cron / Background Jobs

[vercel.json](vercel.json) declares two crons:
- `/api/cron/digest-submit` — Mondays 13:00 UTC
- `/api/cron/digest-collect` — every 6 hours

Verify:
- [ ] `CRON_SECRET` env var set in Vercel; the auth check at [digest-submit/route.ts:15](src/app/api/cron/digest-submit/route.ts) will 401 every invocation without it
- [ ] Vercel project is on a plan that supports crons (Hobby has limits)
- [ ] `maxDuration = 300` (5 min) requires Pro plan; verify
- [ ] Monitor first few executions in Vercel logs — these process all students with active LLM calls, so first prod run could be expensive

---

## 6. Code-Level Items to Fix Before Deploy

- [ ] **Uncommitted work:** `git status` shows 14 modified files + new `src/app/plan/`, `src/components/paywall-sheet.tsx`, `src/components/plan-card.tsx`, `src/lib/plans.ts`. Decide what ships vs. what gets held back. Do not deploy from a dirty tree.
- [ ] [next.config.ts](next.config.ts) is empty — consider adding: `poweredByHeader: false`, security headers (CSP, HSTS, X-Frame-Options), image domains if Next/Image is used for external URLs
- [ ] No security headers middleware exists. Recommend at minimum: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
- [ ] [src/components/agentation-wrapper.tsx](src/components/agentation-wrapper.tsx) — dev-only tool. The `NODE_ENV !== "development"` guard is correct, but `agentation` is listed in `devDependencies` so this is fine. Confirm it tree-shakes out of the prod bundle.
- [ ] 38 `console.log` / `console.error` calls across the codebase. Most are error logs (acceptable), but audit for any that leak PII or secrets into Vercel logs.
- [ ] No structured error tracking (Sentry / Axiom / etc.). Errors only go to Vercel logs — acceptable for v1 but plan for it.
- [ ] [tsconfig.tsbuildinfo](tsconfig.tsbuildinfo) is tracked — should be in `.gitignore` (minor)

---

## 7. Security Residual Risks (from SECURITY.md §5)

Re-review before launch — none are blockers but each is worth a conscious decision:

1. **CSRF on non-OAuth POSTs** — relying on Supabase `SameSite=Lax` cookies. Acceptable for v1.
2. **No MFA enforcement** — particularly relevant for counselor accounts who see multiple students' data. Consider requiring before counselor onboarding.
3. **No audit log for auth failures / rate-limit hits** — brute force won't be detected. Add when traffic justifies it.
4. **Service-role key used on hot paths** ([delete-account](src/app/api/delete-account/), [validate-share-email](src/app/api/validate-share-email/)) — auth-gated and rate-limited, but a logic bug = full DB access.

Run the verification block in [SECURITY.md §6](SECURITY.md#6-verification-commands) one final time against the production build.

---

## 8. Legal / Compliance

- [ ] [src/app/privacy/](src/app/privacy/) and [src/app/terms/](src/app/terms/) pages exist — re-read for accuracy (do they mention Stripe, Google, Anthropic, all third parties actually used?)
- [ ] User deletion flow ([api/delete-account](src/app/api/delete-account/)) confirmed to delete from all tables (GDPR/CCPA right-to-delete)
- [ ] Cookie/analytics disclosure if any analytics is added
- [ ] Since this serves students (potentially minors under 18), confirm COPPA does not apply (it only applies to under-13, but worth verifying signup flow has no under-13 path)

---

## 9. Performance / Cost

- [ ] LLM cost ceiling — quotas are enforced ([ratelimiting.md](ratelimiting.md)) but no hard $ cap at the Anthropic account level. Set a billing alert in the Anthropic console.
- [ ] Supabase connection pooling configured (Next.js serverless functions can exhaust connections — use the pooler URL, not direct)
- [ ] Run `npm run build` clean (no type errors, no eslint failures) on the exact commit being deployed
- [ ] `npm audit` — re-run, address any high/critical
- [ ] Run [/benchmark](/) or Lighthouse on the deploy preview before promoting to prod

---

## 10. Post-Deploy Smoke Tests

After cutover, validate against the live URL:

1. Sign up new user → confirm email arrives
2. Sign in / sign out
3. Complete onboarding quiz → generate college list
4. Open assistant → send a message → response streams
5. Generate a research brief for a college
6. Connect Google Calendar → sync a deadline → verify event in calendar
7. Purchase Plus tier → verify webhook fires → quota expanded in [/settings](src/app/settings/)
8. Open Stripe billing portal → cancel → verify downgrade on period end
9. Delete account → verify all rows removed
10. Hit `/api/cron/digest-submit` with the correct `CRON_SECRET` header → verify execution

---

## Items Already Tracked in TODOS.md (do not re-file)

- Apple Calendar WebCal subscription endpoint
- Token encryption at rest (recommended for launch — see §4)
- Re-tune AI quota caps + subscription prices from real cost data (post-launch)
