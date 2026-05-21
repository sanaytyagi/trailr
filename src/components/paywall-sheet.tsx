"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getPlan, recommendedUpgrade, type PlanKey } from "@/lib/plans";

type PaywallContext = "assistant" | "essay" | "research-brief" | "list-builder";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: PaywallContext;
  currentPlan: PlanKey;
  usage?: { used: number; cap: number | null; resetDate?: string };
};

const COPY: Record<PaywallContext, { subline: (recommended: PlanKey) => string }> = {
  assistant: {
    subline: (r) =>
      r === "unlimited"
        ? "You were chatting with the assistant. Unlimited gives you unlimited actions per month so you can keep going."
        : "You were chatting with the assistant. Plus gives you 150 actions per month so you can keep going.",
  },
  essay: {
    subline: (r) =>
      r === "unlimited"
        ? "You were drafting an essay. Unlimited removes your monthly cap entirely."
        : "You were drafting an essay. Plus unlocks 150 actions a month so you can keep writing.",
  },
  "research-brief": {
    subline: (r) =>
      r === "unlimited"
        ? "You were researching a college. Unlimited removes your monthly cap entirely."
        : "You were researching a college. Plus gives you 150 actions per month to keep digging.",
  },
  "list-builder": {
    subline: (r) =>
      r === "unlimited"
        ? "You were building your college list. Unlimited removes your monthly cap entirely."
        : "You were building your college list. Plus gives you 150 actions per month to keep going.",
  },
};

function getResetLabel(resetDate?: string): string {
  if (!resetDate) {
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return nextMonth.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  }
  return new Date(resetDate).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function PaywallSheet({ open, onOpenChange, context, currentPlan, usage }: Props) {
  const [loading, setLoading] = useState(false);

  // Edge case: shouldn't fire for unlimited users
  if (currentPlan === "unlimited") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Something looks off</DialogTitle>
            <DialogDescription>
              Your account shows an unexpected limit. Open billing to check your subscription.
            </DialogDescription>
          </DialogHeader>
          <Link
            href="/settings"
            className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
          >
            Open settings →
          </Link>
        </DialogContent>
      </Dialog>
    );
  }

  const recommended = recommendedUpgrade(currentPlan);
  const recommendedPlan = getPlan(recommended);
  const subline = COPY[context].subline(recommended);
  const resetLabel = getResetLabel(usage?.resetDate);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: recommended }),
      });
      const data = await res.json().catch(() => ({} as { url?: string; error?: string }));
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? `Checkout failed (${res.status})`);
      }
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Couldn't start checkout", { description: msg });
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        {/* Headline */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Sparkles className="size-5 text-primary shrink-0" />
            You&apos;ve used all your AI actions this month
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {subline}
          </DialogDescription>
        </DialogHeader>

        {/* Inline recommended tier card */}
        <div
          role="group"
          aria-label={`Recommended plan: ${recommendedPlan.name}`}
          className="mt-6 rounded-xl border-2 border-primary bg-primary/5 p-5"
        >
          {/* Tier name + price */}
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-base text-foreground">{recommendedPlan.name}</span>
            <span className="font-mono text-2xl tabular-nums text-foreground">
              ${recommendedPlan.price}
              <span className="text-sm font-sans text-muted-foreground ml-1">/mo</span>
            </span>
          </div>

          {/* Cap hero */}
          <div className="mt-4 flex flex-col items-center text-center">
            <span className="text-[48px] leading-none font-medium tabular-nums text-primary">
              {recommendedPlan.cap === null ? "∞" : recommendedPlan.cap}
            </span>
            <span className="mt-1 text-sm text-muted-foreground tracking-tight">
              actions / month
            </span>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            aria-busy={loading}
            className="mt-4 w-full h-11 rounded-full bg-primary text-primary-foreground text-[14px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : (
              `Upgrade to ${recommendedPlan.name}`
            )}
          </button>
        </div>

        {/* Compare link */}
        <Link
          href="/plan"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Compare all plans →
        </Link>

        {/* Reset footer */}
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Your usage resets on {resetLabel}.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
