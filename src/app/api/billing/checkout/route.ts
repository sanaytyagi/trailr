import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRateLimitAdminClient } from "@/lib/rate-limit";
import { getStripe, getPriceId, getAppUrl, type PaidTier } from "@/lib/stripe";
import { parseJsonBody } from "@/lib/parse-json-body";

/**
 * POST /api/billing/checkout — create a Stripe Checkout Session for a paid
 * tier and return its URL. The caller redirects the browser to that URL.
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

  const parsed = await parseJsonBody<{ tier?: string }>(req, 1024);
  if (!parsed.ok) return parsed.response;
  const tier = parsed.data.tier;
  if (tier !== "plus" && tier !== "unlimited") {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: profile } = await db
    .from("profiles")
    .select("id, email, full_name, stripe_customer_id")
    .eq("id", user.id)
    .single() as {
      data: {
        id: string;
        email: string;
        full_name: string | null;
        stripe_customer_id: string | null;
      } | null;
    };
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    const stripe = getStripe();
    const admin = getRateLimitAdminClient();

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        name: profile.full_name ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const appUrl = getAppUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: getPriceId(tier as PaidTier), quantity: 1 }],
      success_url: `${appUrl}/settings?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings?upgraded=0`,
      allow_promotion_codes: true,
      metadata: { user_id: user.id, tier },
      subscription_data: {
        metadata: { user_id: user.id, tier },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    console.error("Billing checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
