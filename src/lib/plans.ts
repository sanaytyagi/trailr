export type PlanKey = "free" | "plus" | "unlimited";

export type Plan = {
  key: PlanKey;
  name: string;
  price: number;
  cap: number | null; // null = unlimited
  positioning: string;
  popular?: boolean;
  selfSelectLine: string;
};

export const PLANS: Plan[] = [
  {
    key: "free",
    name: "Free",
    price: 0,
    cap: 35,
    positioning: "Try it out.",
    selfSelectLine: "Fits if you're starting your search.",
  },
  {
    key: "plus",
    name: "Plus",
    price: 10,
    cap: 100,
    positioning: "Cover the full application season.",
    popular: true,
    selfSelectLine: "Fits if you're in the thick of applying.",
  },
  {
    key: "unlimited",
    name: "Unlimited",
    price: 20,
    cap: null,
    positioning: "Use it as much as you want.",
    selfSelectLine: "Fits if you're a power user.",
  },
];

export function getPlan(key: PlanKey): Plan {
  return PLANS.find((p) => p.key === key)!;
}

/** The tier to recommend upgrading to from the given plan. */
export function recommendedUpgrade(currentPlan: PlanKey): PlanKey {
  if (currentPlan === "free") return "plus";
  if (currentPlan === "plus") return "unlimited";
  return "unlimited";
}
