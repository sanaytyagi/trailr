"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PLANS, type PlanKey } from "@/lib/plans";
import { PlanCard } from "@/components/plan-card";
import { useUsage } from "@/components/usage-meter";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const PLAN_ORDER: PlanKey[] = ["free", "plus", "unlimited"];

function planIndex(key: PlanKey): number {
  return PLAN_ORDER.indexOf(key);
}

const FAQ_ITEMS = [
  {
    q: `What counts as an "AI action"?`,
    a: `One action is one AI request: a question to the assistant, generating a research brief (with each follow-up adding one), or generating a college list. Reading, editing, and saving things in Trailr never cost an action — only AI work does.`,
  },
  {
    q: "Can I change plans anytime?",
    a: "Yes. Upgrades take effect right away and your monthly cap jumps to the new tier immediately. If you downgrade, you keep your current plan until the end of the billing period, then drop to the lower tier. Manage everything from Settings.",
  },
  {
    q: "What happens when I hit my limit?",
    a: "AI features pause until your usage resets on the 1st of the month. Everything else in Trailr keeps working — your college list, essay drafts, notes, and saved briefs are all still there. If you don't want to wait, upgrade and the new cap applies immediately.",
  },
  {
    q: "How do I cancel?",
    a: "Go to Settings and cancel from the billing portal. Your plan stays active until the end of the billing period, so you don't lose anything you've already paid for. After it ends you go back to Free and keep all your data.",
  },
];

// Plus first on mobile
const MOBILE_PLANS = [PLANS[1], PLANS[0], PLANS[2]];

function PlanPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const { data: usage, loading: usageLoading, refresh: refreshUsage } = useUsage();
  const [loadingTier, setLoadingTier] = useState<PlanKey | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, [supabase]);

  // Handle post-checkout return
  useEffect(() => {
    const upgraded = searchParams.get("upgraded");
    const sessionId = searchParams.get("session_id");
    if (upgraded === "1" && sessionId) {
      fetch(`/api/billing/verify-session?session_id=${encodeURIComponent(sessionId)}`, {
        method: "POST",
      })
        .then((r) => r.json())
        .then(() => {
          toast.success("Subscription active", { description: "Your plan has been upgraded." });
          refreshUsage();
          setTimeout(() => router.push("/settings"), 1500);
        })
        .catch(() => {
          toast.error("We couldn't verify the payment yet. It should activate within a minute.");
        });
      router.replace("/plan");
    } else if (upgraded === "0") {
      toast.info("Checkout cancelled");
      router.replace("/plan");
    }
  }, [searchParams, router, refreshUsage]);

  async function handleSelect(tierKey: PlanKey) {
    if (!isLoggedIn) {
      router.push(`/auth?mode=login&next=/plan&tier=${tierKey}`);
      return;
    }
    setLoadingTier(tierKey);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierKey }),
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

  async function handleManage() {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed");
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Couldn't open billing portal", { description: msg });
    }
  }

  const currentPlan: PlanKey = usage?.plan ?? "free";
  const showPlanState = !usageLoading && isLoggedIn === true;

  function isLowerTier(planKey: PlanKey): boolean {
    return showPlanState && planIndex(planKey) < planIndex(currentPlan);
  }

  function renderCard(plan: (typeof PLANS)[number]) {
    return (
      <PlanCard
        key={plan.key}
        plan={plan}
        currentPlan={showPlanState ? currentPlan : undefined}
        loadingTier={loadingTier}
        onSelect={handleSelect}
        showManageLink={isLowerTier(plan.key)}
        onManage={handleManage}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Hero text */}
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-foreground">
          Choose a plan that fits your season
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Cancel anytime. AI actions reset on the 1st of every month.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="mx-auto max-w-6xl px-6">
        {/* Desktop: 3-column grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map(renderCard)}
        </div>

        {/* Mobile: Plus first */}
        <div className="flex flex-col gap-6 md:hidden">
          {MOBILE_PLANS.map(renderCard)}
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto max-w-6xl px-6 mt-24 pb-24">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground text-center mb-8">
          Frequently asked
        </p>
        <Accordion className="max-w-2xl mx-auto border-t border-border">
          {FAQ_ITEMS.map((item) => (
            <AccordionItem key={item.q} value={item.q} className="border-b border-border">
              <AccordionTrigger className="py-5 text-base font-medium -mx-3 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed px-3">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </main>
  );
}

export default function PlanPage() {
  return (
    <Suspense>
      <PlanPageInner />
    </Suspense>
  );
}
