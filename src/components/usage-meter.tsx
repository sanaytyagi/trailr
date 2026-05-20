"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type UsageData = {
  plan: "free" | "plus" | "unlimited";
  used: number;
  cap: number | null; // null = unlimited
  plan_expires_at: string | null;
  subscription_status: string | null;
  cancel_at_period_end: boolean;
};

const PLAN_LABEL: Record<UsageData["plan"], string> = {
  free: "Free",
  plus: "Plus",
  unlimited: "Unlimited",
};

export function UsageMeter({
  data,
  loading,
  className,
}: {
  data: UsageData | null;
  loading?: boolean;
  className?: string;
}) {
  if (loading || !data) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading usage…</span>
      </div>
    );
  }

  const isUnlimited = data.cap === null;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((data.used / data.cap!) * 100));
  const nearCap = !isUnlimited && pct >= 80;
  const overCap = !isUnlimited && data.used >= data.cap!;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground">
            {PLAN_LABEL[data.plan]} plan
          </span>
          {data.cancel_at_period_end && data.plan_expires_at && (
            <span className="text-xs text-muted-foreground truncate">
              · cancels {new Date(data.plan_expires_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <span
          className={cn(
            "text-sm tabular-nums",
            overCap ? "text-destructive font-semibold" : nearCap ? "text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          {isUnlimited ? (
            <>Unlimited usage</>
          ) : (
            <>
              {data.used} / {data.cap}
            </>
          )}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              overCap ? "bg-destructive" : nearCap ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        AI actions reset on the 1st of each month (UTC).
      </p>
    </div>
  );
}

/** Convenience hook for fetching /api/usage. */
export function useUsage(): { data: UsageData | null; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UsageData | null) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { data, loading, refresh: () => setTick((t) => t + 1) };
}
