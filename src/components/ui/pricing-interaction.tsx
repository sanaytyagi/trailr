"use client";

import NumberFlow from "@number-flow/react";
import React from "react";
import { cn } from "@/lib/utils";

export type PricingTierKey = "free" | "plus" | "unlimited";

type Tier = {
  key: PricingTierKey;
  name: string;
  price: number;
  cap: string;
  popularBadge?: boolean;
};

const TIERS: Tier[] = [
  { key: "free", name: "Free", price: 0, cap: "35 AI actions / month" },
  { key: "plus", name: "Plus", price: 10, cap: "150 AI actions / month", popularBadge: true },
  { key: "unlimited", name: "Unlimited", price: 20, cap: "Unlimited AI actions" },
];

export function PricingInteraction({
  initialTier = "plus",
  currentPlan,
  ctaLabel = "Continue",
  loadingTier = null,
  onSelect,
}: {
  initialTier?: PricingTierKey;
  /** The user's current plan — that card gets a "Current plan" badge and is disabled. */
  currentPlan?: PricingTierKey;
  ctaLabel?: string;
  /** When a tier key is provided, the CTA shows a loading state for that tier. */
  loadingTier?: PricingTierKey | null;
  onSelect: (tier: PricingTierKey) => void;
}) {
  const initialIndex = Math.max(
    0,
    TIERS.findIndex((t) => t.key === initialTier)
  );
  const [active, setActive] = React.useState(initialIndex);

  const activeTier = TIERS[active];
  const isCurrent = currentPlan === activeTier.key;
  const isFreeSelected = activeTier.key === "free";

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-3">
      <div className="w-full flex flex-col gap-3">
        {TIERS.map((tier, idx) => {
          const selected = active === idx;
          const isCurrentTier = currentPlan === tier.key;
          return (
            <button
              key={tier.key}
              type="button"
              onClick={() => setActive(idx)}
              className={cn(
                "w-full flex justify-between items-center cursor-pointer rounded-2xl border-2 bg-card p-4 text-left transition-colors duration-200",
                selected ? "border-primary" : "border-border hover:bg-muted/40"
              )}
            >
              <div className="flex flex-col items-start min-w-0">
                <p className="font-semibold text-base flex items-center gap-2 text-foreground">
                  {tier.name}
                  {tier.popularBadge && (
                    <span className="py-0.5 px-2 rounded-md bg-primary/10 text-primary text-[11px] font-semibold">
                      Popular
                    </span>
                  )}
                  {isCurrentTier && (
                    <span className="py-0.5 px-2 rounded-md bg-muted text-muted-foreground text-[11px] font-semibold">
                      Current
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-sm mt-0.5 flex items-center">
                  <span className="text-foreground font-medium flex items-center">
                    $
                    <NumberFlow
                      className="text-foreground font-medium"
                      value={tier.price}
                    />
                  </span>
                  <span className="mx-1">/</span>
                  <span>month</span>
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  <span className="truncate">{tier.cap}</span>
                </p>
              </div>
              <div
                className="border-2 size-5 rounded-full shrink-0 p-0.5 flex items-center justify-center transition-colors"
                style={{
                  borderColor: selected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.5)",
                }}
              >
                <div
                  className="size-2.5 rounded-full bg-primary"
                  style={{
                    opacity: selected ? 1 : 0,
                    transition: "opacity 0.2s",
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={isCurrent || isFreeSelected || !!loadingTier}
        onClick={() => onSelect(activeTier.key)}
        className={cn(
          "rounded-full bg-primary text-sm font-semibold text-primary-foreground w-full p-3",
          "transition-transform duration-200 active:scale-[0.98]",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        )}
      >
        {loadingTier === activeTier.key
          ? "Redirecting…"
          : isCurrent
            ? "Current plan"
            : isFreeSelected
              ? "Free — no upgrade needed"
              : `${ctaLabel} — Get ${activeTier.name}`}
      </button>
    </div>
  );
}
