"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PricingInteraction,
  type PricingTierKey,
} from "@/components/ui/pricing-interaction";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user's current plan; that card gets a "Current" badge. */
  currentPlan?: PricingTierKey;
  /** Pre-select a tier (e.g. "plus" when they hit the free cap). */
  initialTier?: PricingTierKey;
  /** Optional headline override (e.g. "You've reached your monthly limit"). */
  title?: string;
  description?: string;
};

export function UpgradeModal({
  open,
  onOpenChange,
  currentPlan = "free",
  initialTier = "plus",
  title = "Upgrade your plan",
  description = "Unlock more AI actions every month. Cancel anytime.",
}: Props) {
  const [loadingTier, setLoadingTier] = useState<PricingTierKey | null>(null);

  async function handleSelect(tier: PricingTierKey) {
    if (tier === "free") return;
    setLoadingTier(tier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json().catch(() => ({} as { url?: string; error?: string }));
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? `Checkout failed (${res.status})`);
      }
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Couldn't start checkout", { description: msg });
      setLoadingTier(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="pt-2">
          <PricingInteraction
            currentPlan={currentPlan}
            initialTier={initialTier}
            loadingTier={loadingTier}
            onSelect={handleSelect}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
