"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan, PlanKey } from "@/lib/plans";

type PlanCardProps = {
  plan: Plan;
  currentPlan?: PlanKey;
  loadingTier?: PlanKey | null;
  onSelect: (key: PlanKey) => void;
  /** When true, lower tiers show "Manage plan →" instead of a Select button. */
  showManageLink?: boolean;
  onManage?: () => void;
};

export function PlanCard({
  plan,
  currentPlan,
  loadingTier,
  onSelect,
  showManageLink,
  onManage,
}: PlanCardProps) {
  const isCurrent = currentPlan === plan.key;
  const isLoading = loadingTier === plan.key;
  const anyLoading = !!loadingTier;
  const isPlus = plan.key === "plus";

  return (
    <article
      aria-labelledby={`tier-${plan.key}`}
      aria-label={plan.popular ? `${plan.name} — recommended` : undefined}
      className={cn(
        "relative flex flex-col rounded-2xl bg-card p-8 transition-all duration-200",
        isPlus
          ? "border-2 border-primary -translate-y-2 hover:-translate-y-3 hover:shadow-lg"
          : "border border-border hover:-translate-y-1 hover:shadow-lg"
      )}
    >
      {plan.popular && (
        <div
          aria-hidden="true"
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[11px] font-semibold tracking-wider uppercase px-3 py-1 rounded-full"
        >
          Most Popular
        </div>
      )}

      {/* Tier name + positioning */}
      <h2
        id={`tier-${plan.key}`}
        className="text-[22px] font-medium leading-tight text-foreground"
      >
        {plan.name}
      </h2>
      <p className="mt-1 text-[15px] text-muted-foreground leading-snug">
        {plan.positioning}
      </p>

      {/* Price */}
      <p className="mt-6 flex items-baseline gap-1">
        <span className="sr-only">
          {plan.name}, {plan.price === 0 ? "free" : `${plan.price} dollars`} per month
        </span>
        <span aria-hidden="true" className="font-mono text-2xl tabular-nums text-foreground">
          ${plan.price}
        </span>
        <span aria-hidden="true" className="text-sm text-muted-foreground ml-1">
          / month
        </span>
      </p>

      {/* Cap hero */}
      <div className="mt-4 flex flex-col items-center text-center">
        <span className="text-[72px] leading-none font-medium tabular-nums text-primary">
          {plan.cap === null ? "∞" : plan.cap}
        </span>
        <span className="mt-1 text-sm text-muted-foreground tracking-tight">
          actions / month
        </span>
      </div>

      {/* CTA */}
      <div className="mt-6">
        {isCurrent ? (
          <button
            type="button"
            disabled
            className="w-full h-11 rounded-full text-[14px] font-semibold bg-muted text-muted-foreground border-transparent cursor-not-allowed"
          >
            Current plan
          </button>
        ) : showManageLink ? (
          <button
            type="button"
            onClick={onManage}
            disabled={anyLoading}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Manage plan →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(plan.key)}
            disabled={anyLoading}
            aria-busy={isLoading}
            className={cn(
              "w-full h-11 rounded-full text-[14px] font-semibold transition-all duration-200",
              "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isPlus
                ? "bg-primary text-primary-foreground"
                : "border-2 border-border hover:border-primary hover:text-primary"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : (
              "Select"
            )}
          </button>
        )}
      </div>

      {/* Divider + self-select line */}
      <div className="mt-8 border-t border-border" />
      <p className="mt-6 text-[14px] leading-relaxed text-muted-foreground">
        {plan.selfSelectLine}
      </p>
    </article>
  );
}
