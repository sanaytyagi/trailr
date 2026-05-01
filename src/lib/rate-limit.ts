import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export type RateLimitInput = {
  endpoint: string;
  windowSeconds: number;
  max: number;
} & ({ userId: string; key?: never } | { userId?: never; key: string });

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Returns a Supabase admin client (service role). Used for rate-limit ops on
 * pre-auth routes where there is no user session, and the inserted row has
 * user_id NULL + a key field.
 */
let adminClientSingleton: SupabaseClient | null = null;
export function getRateLimitAdminClient(): SupabaseClient {
  if (adminClientSingleton) return adminClientSingleton;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Rate limit admin client requires SUPABASE env vars");
  }
  adminClientSingleton = createServiceClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClientSingleton;
}

/**
 * Check whether the caller is within the rate limit. Does NOT record the hit —
 * call recordRateLimitHit() after the protected operation succeeds.
 *
 * Pass a Supabase client that has the appropriate role:
 * - For authed routes: pass the user-context client (server.ts createClient).
 * - For pre-auth routes (auth wrappers): pass getRateLimitAdminClient().
 */
export async function checkRateLimit(
  client: SupabaseClient,
  input: RateLimitInput
): Promise<RateLimitResult> {
  const { endpoint, windowSeconds, max } = input;
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  let query = client
    .from("api_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("endpoint", endpoint)
    .gte("created_at", since);

  if ("userId" in input && input.userId) {
    query = query.eq("user_id", input.userId);
  } else if ("key" in input && input.key) {
    query = query.eq("key", input.key);
  }

  const { count } = await query;
  const used = count ?? 0;
  const remaining = Math.max(0, max - used);
  return {
    ok: used < max,
    remaining,
    retryAfterSeconds: used < max ? 0 : windowSeconds,
  };
}

/**
 * Record a successful invocation. Insert errors are swallowed (logged) so a
 * transient DB hiccup never blocks the user-facing response.
 */
export async function recordRateLimitHit(
  client: SupabaseClient,
  input: { endpoint: string; userId?: string; key?: string }
): Promise<void> {
  if (!input.userId && !input.key) return;
  const row: { endpoint: string; user_id?: string; key?: string } = {
    endpoint: input.endpoint,
  };
  if (input.userId) row.user_id = input.userId;
  if (input.key) row.key = input.key;
  const { error } = await client.from("api_rate_limits").insert(row);
  if (error) {
    console.error(`recordRateLimitHit(${input.endpoint}) failed:`, error.message);
  }
}

/**
 * Build a 429 JSON response with Retry-After header.
 */
export function rateLimitedResponse(
  result: RateLimitResult,
  message = "Too many requests. Please try again later."
): NextResponse {
  return NextResponse.json(
    { error: message, retryAfter: result.retryAfterSeconds },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    }
  );
}

/**
 * Extract the requester's IP from common proxy headers. Falls back to "unknown"
 * which is safe — all "unknown" callers get bucketed together and rate-limited
 * as a group, which fails closed.
 */
export function getClientIp(req: NextRequest | Request): string {
  const headers = "headers" in req ? req.headers : new Headers();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
