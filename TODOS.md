# TODOS

## Cache core_profile-done flag to skip the per-navigation gate query
**What:** The proxy gate (`src/proxy.ts`) does one `profiles.core_profile` lookup on every protected navigation. Once a user has a core_profile, cache that "done" state in a cookie or JWT claim so the query stops firing.
**Why:** Removes a redundant per-request DB round-trip in middleware once the profile exists. Only matters at scale.
**Pros:** Cuts middleware latency for the common case (returning users who already have a profile).
**Cons:** Adds cookie/claim sync and a stale-state failure mode (cookie says done but DB was reset). Not worth it pre-launch.
**Context:** Added during the student-profile-at-registration eng review (2026-06-01). The gate was deliberately put in the proxy for DRY centralization (one place, matches existing auth gating). We accepted the per-nav query as "boring and fine" at current scale. Trigger to revisit: middleware latency shows up in real measurements.
**Depends on:** Student profile core-step shipped. Revisit only when latency data justifies it.

## Apple Calendar — WebCal subscription endpoint
**What:** Serve a live `.ics` feed at `/api/calendar/ical/[token]` that Apple Calendar can subscribe to.
**Why:** Lets iPhone/Mac users get automatic deadline sync without any OAuth. ~30 min to build with CC.
**Pros:** Zero OAuth complexity, always current (Apple Calendar polls every few hours), reuses same college deadline data.
**Cons:** Slight delay vs real-time (poll interval), read-only.
**Context:** Deferred from the Google Calendar integration PR. The ical_token column can live in user_integrations as provider="apple_calendar". Use the `ical-generator` npm package.
**Depends on:** Google Calendar integration shipped (same user_integrations table).

## Token encryption at rest
**What:** AES-256 encrypt `access_token` and `refresh_token` before inserting into `user_integrations`. Decrypt server-side on read.
**Why:** Defense-in-depth. If the DB is ever exported or breached, tokens are useless without the server-side key. Protects users' Google Calendar access.
**Pros:** Significantly raises the bar for a breach. Standard practice for stored OAuth tokens.
**Cons:** Adds a server-only `ENCRYPTION_SECRET` env var, ~20 lines of crypto utility code.
**Context:** Currently blocked by "ship it first." Add a `src/lib/crypto.ts` utility wrapping Node's built-in `crypto.createCipheriv`.
**Depends on:** Google Calendar integration shipped.

## Re-tune AI quota caps and subscription prices from real cost data
**What:** Revisit the Free/Plus/Unlimited caps (35/150/unlimited) and prices ($10/$20) using real `cost_cents` and conversion data.
**Why:** Every quota number and price shipped with the freemium launch is a provisional guess. The design doc explicitly calls for tuning in the first 4-6 weeks. Real data turns the guesses into decisions.
**Pros:** Corrects margin (a Plus user could cost $4 or $14 — only data tells you) and conversion (is the 35-action wall too early or too late). Prevents shipping blind numbers permanently.
**Cons:** One more tracked item; requires actually running the analysis when the data is ready.
**Context:** The freemium plan instruments `cost_cents` per metered AI action on `api_rate_limits` rows from day one. After ~2-4 weeks of live usage: compute median and p95 cost per plan, compare against revenue, and check conversion rate at the free-tier wall. Adjust caps and prices accordingly.
**Depends on:** Student freemium monetization shipped + ~2-4 weeks of live student usage.

## Assistant context sidebar — mobile drawer/toggle
**What:** The AI assistant's right-hand context panel (tasks "What to do next", digest, research) is hidden below `lg` so the chat gets the full screen on mobile (`src/components/assistant-sidebar.tsx`). Add a toggle/drawer (e.g. a bottom sheet or slide-over) so mobile users can still reach that context.
**Why:** Made the chat usable on phones during the responsive pass (2026-06-14), but mobile users currently lose access to the tasks/digest panel entirely.
**Pros:** Restores full feature parity on mobile without cramping the chat.
**Cons:** Needs a new toggle affordance + sheet wiring; ~30 min with CC.
**Context:** Deferred from the mobile-responsive design pass. The PaywallSheet pattern (`src/components/paywall-sheet.tsx`) is a good reference for a mobile sheet.
