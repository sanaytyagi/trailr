import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRateLimitAdminClient } from "@/lib/rate-limit";
import {
  PLAN_CAPS,
  resolvePlan,
  startOfMonthUtc,
  type Plan,
} from "@/lib/ai-quota";

/**
 * GET /api/usage — current-month AI usage for the signed-in user. Used by the
 * usage meter in /settings and the upgrade modal.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: profile } = await db
    .from("profiles")
    .select("plan, plan_expires_at, subscription_status, cancel_at_period_end")
    .eq("id", user.id)
    .single() as {
      data: {
        plan: Plan;
        plan_expires_at: string | null;
        subscription_status: string | null;
        cancel_at_period_end: boolean;
      } | null;
    };

  const effectivePlan = resolvePlan(profile);
  const cap = PLAN_CAPS[effectivePlan];

  const admin = getRateLimitAdminClient();
  const { count } = await admin
    .from("api_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("billable", true)
    .gte("created_at", startOfMonthUtc());

  return NextResponse.json({
    plan: effectivePlan,
    used: count ?? 0,
    cap: Number.isFinite(cap) ? cap : null,
    plan_expires_at: profile?.plan_expires_at ?? null,
    subscription_status: profile?.subscription_status ?? null,
    cancel_at_period_end: profile?.cancel_at_period_end ?? false,
  });
}
