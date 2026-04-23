# TODOS

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
