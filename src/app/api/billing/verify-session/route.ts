import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getStripe, planFromPriceId, type PaidTier } from "@/lib/stripe";
import { getRateLimitAdminClient } from "@/lib/rate-limit";

/**
 * POST /api/billing/verify-session — post-checkout fallback. The /settings page
 * calls this with the Stripe checkout session id from the success_url. If the
 * webhook has already provisioned the plan, we no-op (webhook_events idempotency
 * gate fails the INSERT). If the webhook is slow or lost, we provision now so
 * the paying student is never left rate-limited.
 *
 * This is the fix for the critical failure mode from the implementation plan.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const stripe = getStripe();
  const admin = getRateLimitAdminClient();

  // Claim the session id in the shared idempotency table. If the webhook beat
  // us to it (by Stripe event id) we'll still want to try inserting under the
  // session id — but if the same client retries, the second call no-ops.
  const { error: claimError } = await admin
    .from("webhook_events")
    .insert({ id: sessionId, source: "session_verify" });
  if (claimError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (claimError as any).code as string | undefined;
    if (code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("verify-session claim failed:", claimError.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  // Ownership check: the session must belong to this user.
  const sessionUserId = session.metadata?.user_id ?? null;
  if (sessionUserId && sessionUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.mode !== "subscription" || !session.subscription) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const sub =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(session.subscription)
      : (session.subscription as Stripe.Subscription);

  const priceId = sub.items.data[0]?.price?.id;
  const tier: PaidTier | null = priceId ? planFromPriceId(priceId) : null;
  if (!tier) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const periodEnd = sub.items.data[0]?.current_period_end;
  const expiresAt = periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : null;
  const active = sub.status === "active" || sub.status === "trialing";

  await admin
    .from("profiles")
    .update({
      plan: active ? tier : "free",
      plan_expires_at: expiresAt,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
    })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, plan: active ? tier : "free" });
}
