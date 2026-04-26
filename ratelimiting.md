# AI Feature Rate Limiting

## Storage

All rate limit tracking uses a single shared Supabase table:

```sql
api_rate_limits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)
```

Migration: `supabase/migrations/008_generate_list_rate_limit.sql`

RLS is enabled — users can only read their own rows. The service-role client used inside API routes bypasses RLS for writes, which is intentional (users must not be able to delete their own rate limit records).

Index on `(user_id, endpoint, created_at)` keeps the count query fast.

## How the check works

Every rate-limited endpoint runs this pattern before calling OpenAI:

```ts
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { count } = await supabase
  .from("api_rate_limits")
  .select("*", { count: "exact", head: true })
  .eq("user_id", user.id)
  .eq("endpoint", "<endpoint-name>")
  .gte("created_at", oneDayAgo);

if ((count ?? 0) >= LIMIT) {
  return NextResponse.json({ error: "..." }, { status: 429 });
}
```

The window is a rolling 24-hour lookback, not a calendar day reset. A record is inserted only on success — failed or errored requests do not consume quota.

## Per-endpoint limits

| Endpoint | File | Limit | Endpoint key |
|---|---|---|---|
| College list generation | `src/app/api/generate-list/route.ts` | 5 / day | `generate-list` |
| Counselor assistant chat | `src/app/api/assistant/route.ts` | 100 / day | `assistant` |
| Research brief generation | `src/app/api/assistant/research-brief/route.ts` | 25 / day | `research-brief` |
| Research brief follow-ups | `src/app/api/assistant/research-brief/followup/route.ts` | 50 / day | `research-brief-followup` |

### Rationale

- **generate-list (5)**: One-time onboarding action. A student generating their college list more than a handful of times per day is unusual.
- **assistant (100)**: The primary daily-use feature. 100 messages is generous for normal use while capping abuse from a compromised or scripted account.
- **research-brief (25)**: One brief per tracked college. A student tracking 20 colleges needs at most 20 briefs; 25 leaves headroom for regeneration.
- **research-brief-followup (50)**: A few follow-up questions per brief across multiple colleges. 50 covers heavy legitimate use.

## Character limits on free-form inputs

In addition to request-level rate limits, free-form text inputs are capped to prevent per-request token cost spikes:

| Input | Limit | Enforced at | Location |
|---|---|---|---|
| Assistant chat message | 4000 characters | UI + API | `assistant/page.tsx` (`maxLength` + counter), `assistant/route.ts` after `extractText()` |
| Research brief follow-up prompt | 1000 characters | UI + API | `brief/page.tsx` (`maxLength` + counter), `research-brief/followup/route.ts` after body parse |

Both inputs show a live `{n}/limit` counter that turns red when approaching the limit (3600 for chat, 900 for follow-ups), and `maxLength` on the element prevents typing past the limit entirely. The counter is hidden when the input is empty. The API enforces the same limits as a backstop.

Structured inputs (quiz answers, interview answers) are not capped — their individual fields are typed and bounded by the form.

## What is NOT rate limited

- `assistant/digest`, `assistant/opening`, `assistant/tasks`: These are triggered automatically by the app on page load or session start, not directly by user action. They call gpt-4o but are low-frequency by design. Rate limiting them would require careful coordination with the client to avoid confusing UX.

## Adjusting limits

Change the numeric cap in the route file. No migration needed — the table and index are endpoint-agnostic.

To raise the assistant limit to 200:

```ts
// src/app/api/assistant/route.ts
if ((msgCount ?? 0) >= 200) {
```
