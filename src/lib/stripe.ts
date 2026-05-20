import Stripe from "stripe";
import type { Plan } from "@/lib/ai-quota";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  stripeSingleton = new Stripe(key);
  return stripeSingleton;
}

export type PaidTier = Exclude<Plan, "free">;

/**
 * Map a paid tier to its Stripe Price ID. Configure in the dashboard, then
 * expose via env. Throws if a tier's price id is missing.
 */
export function getPriceId(tier: PaidTier): string {
  const id =
    tier === "plus"
      ? process.env.STRIPE_PRICE_PLUS
      : process.env.STRIPE_PRICE_UNLIMITED;
  if (!id) throw new Error(`Missing STRIPE_PRICE_${tier.toUpperCase()} env var`);
  return id;
}

/**
 * Reverse map: given a Stripe price id (from a webhook event), return the
 * corresponding plan. Returns null for unknown prices (defensive: don't
 * mis-provision on a price we don't recognize).
 */
export function planFromPriceId(priceId: string): PaidTier | null {
  if (priceId === process.env.STRIPE_PRICE_PLUS) return "plus";
  if (priceId === process.env.STRIPE_PRICE_UNLIMITED) return "unlimited";
  return null;
}

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  return url.replace(/\/$/, "");
}
