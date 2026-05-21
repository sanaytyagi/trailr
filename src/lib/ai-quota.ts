import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export type Plan = "free" | "plus" | "unlimited";

export type MeteredEndpoint =
  | "assistant"
  | "research-brief"
  | "research-brief-followup"
  | "generate-list";

export const METERED_ENDPOINTS: readonly MeteredEndpoint[] = [
  "assistant",
  "research-brief",
  "research-brief-followup",
  "generate-list",
] as const;

export const PLAN_CAPS: Record<Plan, number> = {
  free: 35,
  plus: 40,
  unlimited: Number.POSITIVE_INFINITY,
};

// Invisible fair-use backstop on the unlimited tier for research-brief, the
// single most expensive call. Applies to all plans, but only ever bites the
// unlimited tier in practice (free/plus get blocked by PLAN_CAPS first).
export const BRIEF_FAIRUSE_CAP = 50;

type ProfileEntitlement = {
  plan: Plan;
  plan_expires_at: string | null;
};

/**
 * Resolve a profile's effective plan, accounting for expiration. A subscription
 * that has lapsed past `plan_expires_at` falls back to free until Stripe re-confirms.
 */
export function resolvePlan(profile: ProfileEntitlement | null | undefined): Plan {
  if (!profile) return "free";
  if (profile.plan === "free") return "free";
  if (!profile.plan_expires_at) return profile.plan;
  const expiresAt = new Date(profile.plan_expires_at).getTime();
  if (Number.isNaN(expiresAt)) return "free";
  return Date.now() < expiresAt ? profile.plan : "free";
}

/**
 * First instant of the current calendar month in UTC (ISO string). The quota
 * window aligns to UTC month boundaries, resetting at 00:00 UTC on the 1st.
 */
export function startOfMonthUtc(now: Date = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  ).toISOString();
}

export type QuotaResult = {
  ok: boolean;
  plan: Plan;
  used: number;
  cap: number;
  // True when blocked specifically by the research-brief fair-use backstop
  // rather than the plan cap (unlimited tier only).
  fairUseHit?: boolean;
};

/**
 * Check whether a user is within their monthly AI quota for a metered endpoint.
 * Counts billable rows in api_rate_limits since the start of the current UTC
 * calendar month. Pass a service-role client so RLS doesn't filter the count.
 *
 * Does NOT record the hit — call `recordRateLimitHit(..., { billable: true,
 * costCents })` after the operation succeeds.
 */
export async function checkAiQuota(
  client: SupabaseClient,
  userId: string,
  plan: Plan,
  endpoint: MeteredEndpoint
): Promise<QuotaResult> {
  const since = startOfMonthUtc();
  const cap = PLAN_CAPS[plan];

  // Total billable actions this month (counts against plan cap).
  const { count: totalCount } = await client
    .from("api_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("billable", true)
    .gte("created_at", since);
  const used = totalCount ?? 0;

  // Research-brief fair-use backstop: applies on all plans, but only matters
  // for unlimited (free/plus hit the plan cap first).
  if (endpoint === "research-brief") {
    const { count: briefCount } = await client
      .from("api_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("billable", true)
      .eq("endpoint", "research-brief")
      .gte("created_at", since);
    const briefUsed = briefCount ?? 0;
    if (briefUsed >= BRIEF_FAIRUSE_CAP) {
      return { ok: false, plan, used, cap, fairUseHit: true };
    }
  }

  return { ok: used < cap, plan, used, cap };
}

/**
 * HTTP 402 Payment Required response for quota_exceeded. Clients use the
 * `code` field to open the upgrade modal.
 */
export function quotaExceededResponse(result: QuotaResult): NextResponse {
  return NextResponse.json(
    {
      error: result.fairUseHit
        ? "You've hit the fair-use research-brief limit for this month. It resets on the 1st."
        : "You've reached your AI usage limit for this month. Upgrade for more.",
      code: "quota_exceeded",
      plan: result.plan,
      used: result.used,
      cap: Number.isFinite(result.cap) ? result.cap : null,
      fairUseHit: result.fairUseHit ?? false,
    },
    { status: 402 }
  );
}

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

// Per-million-token prices in USD cents (Anthropic public pricing as of 2026-05).
// Used only for cost telemetry / pricing tuning, not for billing.
const MODEL_PRICING_CENTS_PER_MTOK: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  "claude-sonnet-4-6": { input: 300, output: 1500, cacheRead: 30, cacheWrite: 375 },
  "claude-haiku-4-5": { input: 80, output: 400, cacheRead: 8, cacheWrite: 100 },
};

// Anthropic web_search is $10 per 1,000 uses = 1 cent per use.
const WEB_SEARCH_CENTS_PER_USE = 1;

/**
 * Estimate Anthropic API cost in whole cents for a single call. Returns null
 * when the model is unknown so we don't record bogus numbers.
 */
export function estimateCostCents(
  model: string,
  usage: AnthropicUsage | null | undefined,
  webSearchCount = 0
): number | null {
  const pricing = MODEL_PRICING_CENTS_PER_MTOK[model];
  if (!pricing || !usage) return null;
  const inTok = usage.input_tokens ?? 0;
  const outTok = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cents =
    (inTok * pricing.input) / 1_000_000 +
    (outTok * pricing.output) / 1_000_000 +
    (cacheRead * pricing.cacheRead) / 1_000_000 +
    (cacheWrite * pricing.cacheWrite) / 1_000_000 +
    webSearchCount * WEB_SEARCH_CENTS_PER_USE;
  return Math.max(0, Math.round(cents));
}
