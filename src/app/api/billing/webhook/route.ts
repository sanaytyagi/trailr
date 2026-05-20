import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planFromPriceId, type PaidTier } from "@/lib/stripe";
import { getRateLimitAdminClient } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/billing/webhook — Stripe sends subscription lifecycle events here.
 *
 * - Signature is verified against the RAW body (req.text(), never req.json()).
 * - Idempotency via webhook_events: first writer (webhook OR session-verify
 *   fallback in /settings) inserts a row keyed by event id; the loser sees the
 *   PK conflict and no-ops.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("Stripe webhook signature verification failed:", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = getRateLimitAdminClient();

  // Idempotency gate: try to claim this event id. Conflict = already processed.
  const { error: claimError } = await admin
    .from("webhook_events")
    .insert({ id: event.id, source: "webhook" });
  if (claimError) {
    // 23505 = unique violation = already processed. Anything else is unexpected.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (claimError as any).code as string | undefined;
    if (code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Failed to claim webhook event:", claimError.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await provisionFromSession(session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncFromSubscription(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await downgradeToFree(sub);
        break;
      }
      default:
        // No-op for events we don't care about.
        break;
    }
  } catch (err) {
    console.error(`Webhook handler ${event.type} failed:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function provisionFromSession(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || !session.subscription) return;
  const stripe = getStripe();
  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;
  const sub = await stripe.subscriptions.retrieve(subId);
  await syncFromSubscription(sub);
}

async function syncFromSubscription(sub: Stripe.Subscription) {
  const admin = getRateLimitAdminClient();
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const priceId = sub.items.data[0]?.price?.id;
  const tier: PaidTier | null = priceId ? planFromPriceId(priceId) : null;
  if (!tier) {
    console.warn("Subscription has unknown price id:", priceId);
    return;
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
    .eq("stripe_customer_id", customerId);
}

async function downgradeToFree(sub: Stripe.Subscription) {
  const admin = getRateLimitAdminClient();
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  await admin
    .from("profiles")
    .update({
      plan: "free",
      plan_expires_at: null,
      subscription_status: sub.status,
      cancel_at_period_end: false,
    })
    .eq("stripe_customer_id", customerId);
}
