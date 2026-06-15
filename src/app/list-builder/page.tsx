"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, RotateCcw, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CollegeQuiz } from "@/components/list-builder/CollegeQuiz";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAcceptanceRate } from "@/lib/utils";
import { PaywallSheet } from "@/components/paywall-sheet";
import { useUsage } from "@/components/usage-meter";

interface GeneratedCollege {
  college_id: string;
  name: string;
  tier: "Reach" | "High Match" | "Match" | "Safety";
  reason: string;
}

interface SearchResult {
  id: string;
  name: string;
  location: string;
  acceptance_rate: number | null;
}

export default function ListBuilderPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [savedList, setSavedList] = useState<GeneratedCollege[] | null>(null);
  const [savedQuizAnswers, setSavedQuizAnswers] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { data: usage, refresh: refreshUsage } = useUsage();
  const [removedColleges, setRemovedColleges] = useState<Set<string>>(new Set());

  // Add college state
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<SearchResult[]>([]);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const [addSearchLoading, setAddSearchLoading] = useState(false);
  const [pendingCollege, setPendingCollege] = useState<{ id: string; name: string } | null>(null);

  // Add to tracker state
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [addingToTracker, setAddingToTracker] = useState(false);

  const addInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Load user and check for saved list
  useEffect(() => {
    async function loadUserAndList() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await (supabase as any)
        .from("user_lists")
        .select("colleges")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.colleges) {
        const raw = data.colleges;
        if (Array.isArray(raw)) {
          setSavedList(raw);
        } else if (raw && typeof raw === "object" && Array.isArray((raw as any).list)) {
          setSavedList((raw as any).list);
          setSavedQuizAnswers((raw as any).quiz_answers ?? null);
        }
      }
      setLoading(false);
    }

    loadUserAndList();
  }, [supabase]);

  // Debounced search for add-college input
  useEffect(() => {
    if (!addQuery.trim()) {
      setAddResults([]);
      setAddSearchLoading(false);
      return;
    }

    setAddSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/colleges/search?q=${encodeURIComponent(addQuery)}`);
        const data = await res.json();
        setAddResults(data.colleges ?? []);
      } catch {
        setAddResults([]);
      } finally {
        setAddSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [addQuery]);

  const handleQuizComplete = async (answers: any) => {
    if (!user) {
      router.push("/auth?mode=login");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 402 && responseData.code === "quota_exceeded") {
          setUpgradeOpen(true);
          throw new Error(responseData.error ?? "You've reached your monthly AI limit.");
        }
        throw new Error(responseData.error || "Failed to generate list");
      }

      const { colleges } = responseData;
      setSavedList(colleges);
      setSavedQuizAnswers(answers);

      // Save to Supabase
      await (supabase as any)
        .from("user_lists")
        .upsert(
          {
            user_id: user.id,
            colleges: { list: colleges, quiz_answers: answers },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      // Backfill the 3-field core profile so it stays consistent with the full
      // quiz. The resolver reads { ...core_profile, ...quiz_answers } (quiz wins),
      // so this keeps profiles.core_profile fresh for anything that reads it
      // directly (e.g. the onboarding gate, the completion nudge).
      if (answers?.state && answers?.major != null && answers?.gpa != null) {
        await supabase
          .from("profiles")
          .update({
            core_profile: {
              state: answers.state,
              gpa: answers.gpa,
              major: answers.major,
            },
          })
          .eq("id", user.id);
      }
    } catch (err) {
      setError(`Failed to generate your college list: ${err instanceof Error ? err.message : "Unknown error"}`);
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveCollege = async (collegeId: string) => {
    setRemovedColleges((prev) => new Set(prev).add(collegeId));
    if (!user || !savedList) return;
    const updated = savedList.filter((c) => c.college_id !== collegeId);
    setSavedList(updated);
    await (supabase as any)
      .from("user_lists")
      .upsert(
        { user_id: user.id, colleges: { list: updated, quiz_answers: savedQuizAnswers }, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
  };

  const handleStartOver = async () => {
    if (!user) return;

    await supabase
      .from("user_lists")
      .delete()
      .eq("user_id", user.id);

    setSavedList(null);
    setRemovedColleges(new Set());
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    setAddDropdownOpen(false);
    setPendingCollege({ id: result.id, name: result.name });
    setAddQuery("");
    setAddResults([]);
  };

  const handleAddWithTier = async (tier: GeneratedCollege["tier"]) => {
    if (!pendingCollege || !user || !savedList) return;

    const updated = [
      ...savedList,
      { college_id: pendingCollege.id, name: pendingCollege.name, tier, reason: "Manually added" },
    ];
    setSavedList(updated);
    setRemovedColleges((prev) => {
      const next = new Set(prev);
      next.delete(pendingCollege.id);
      return next;
    });
    setPendingCollege(null);

    await (supabase as any)
      .from("user_lists")
      .upsert(
        { user_id: user.id, colleges: { list: updated, quiz_answers: savedQuizAnswers }, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
  };

  const handleAddToTracker = async () => {
    if (!user || !savedList) return;
    setAddingToTracker(true);

    const visibleList = savedList.filter((c) => !removedColleges.has(c.college_id));

    // Delete all existing user_colleges rows for this user
    await supabase.from("user_colleges").delete().eq("user_id", user.id);

    // Bulk insert
    if (visibleList.length > 0) {
      const tierToCategory: Record<string, string> = {
        "Reach": "reach",
        "High Match": "high_match",
        "Match": "target",
        "Safety": "safety",
      };
      const rows = visibleList.map((c) => ({
        user_id: user.id,
        college_id: c.college_id,
        application_status: "not_started",
        application_round: "unknown",
        admissions_category: tierToCategory[c.tier] ?? null,
        notes: "",
      }));
      await (supabase as any).from("user_colleges").insert(rows);
    }

    router.push("/tracker");
  };

  if (!user && !loading) {
    if (typeof window !== "undefined") router.replace("/auth?mode=login");
    return null;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!savedList) {
    return (
      <div className="h-[calc(100vh-4rem)]">
        <CollegeQuiz onComplete={handleQuizComplete} isLoading={generating} onExit={() => router.back()} />
        {error && (
          <div className="fixed bottom-4 left-4 right-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <Button size="sm" variant="outline" onClick={() => setError(null)} className="ml-2">
              Dismiss
            </Button>
          </div>
        )}
        {generating && (
          <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center z-50">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-white text-lg font-medium">Building your personalized college list…</p>
          </div>
        )}
      </div>
    );
  }

  const tiers = ["Reach", "High Match", "Match", "Safety"] as const;
  const tierColors = {
    Reach: "bg-red-100 text-red-700",
    "High Match": "bg-yellow-100 text-yellow-700",
    Match: "bg-blue-100 text-blue-700",
    Safety: "bg-green-100 text-green-700",
  };

  const visibleIds = new Set(
    savedList.filter((c) => !removedColleges.has(c.college_id)).map((c) => c.college_id)
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* Sticky header */}
      <div className="sticky top-16 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          {confirmReplace ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                This will replace your current tracker list with {savedList.filter((c) => !removedColleges.has(c.college_id)).length} colleges. Are you sure?
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmReplace(false)}
                  disabled={addingToTracker}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddToTracker}
                  disabled={addingToTracker}
                  className="gap-1.5"
                >
                  {addingToTracker ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Your Personalized College List</h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartOver}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Start Over
                </Button>
                <Button
                  size="sm"
                  onClick={() => setConfirmReplace(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add to Tracker
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Add college search */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            {addSearchLoading ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
            <input
              ref={addInputRef}
              type="text"
              placeholder="Add a college to your list…"
              value={addQuery}
              onChange={(e) => { setAddQuery(e.target.value); setAddDropdownOpen(true); }}
              onFocus={() => setAddDropdownOpen(true)}
              onBlur={() => setTimeout(() => setAddDropdownOpen(false), 150)}
              className={cn(
                "h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4",
                "text-sm placeholder:text-muted-foreground text-foreground",
                "outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
              )}
            />

            {/* Search dropdown */}
            {addDropdownOpen && (addResults.length > 0 || (addQuery.length >= 2 && !addSearchLoading)) && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-md">
                {addResults.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">No colleges found.</div>
                ) : (
                  <ul className="max-h-64 overflow-y-auto py-1">
                    {addResults.map((result) => {
                      const alreadyVisible = visibleIds.has(result.id);
                      return (
                        <li key={result.id}>
                          <button
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                              alreadyVisible
                                ? "cursor-default opacity-50"
                                : "hover:bg-muted cursor-pointer"
                            )}
                            onClick={() => !alreadyVisible && handleSelectSearchResult(result)}
                            disabled={alreadyVisible}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{result.name}</p>
                              {result.location && (
                                <p className="text-xs text-muted-foreground">
                                  {result.location}
                                  {result.acceptance_rate !== null && (
                                    <span className="ml-2 font-mono">
                                      {formatAcceptanceRate(result.acceptance_rate)} acceptance
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            {alreadyVisible && <Check className="h-4 w-4 shrink-0 text-primary" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Tier picker card */}
          {pendingCollege && (
            <div className="mt-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">
                  Add <span className="text-primary">{pendingCollege.name}</span> as:
                </p>
                <button
                  onClick={() => setPendingCollege(null)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["Reach", "High Match", "Match", "Safety"] as const).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => handleAddWithTier(tier)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:opacity-80",
                      tier === "Reach" && "bg-red-100 text-red-700 border-red-200",
                      tier === "High Match" && "bg-yellow-100 text-yellow-700 border-yellow-200",
                      tier === "Match" && "bg-blue-100 text-blue-700 border-blue-200",
                      tier === "Safety" && "bg-green-100 text-green-700 border-green-200"
                    )}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Colleges grouped by tier */}
        {tiers.map((tier) => {
          const tierColleges = savedList.filter((c) => c.tier === tier && !removedColleges.has(c.college_id));
          if (tierColleges.length === 0) return null;

          return (
            <div key={tier} className="mb-12">
              <h2 className="text-xl font-semibold mb-4">{tier} Schools</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {tierColleges.map((college) => (
                  <div
                    key={college.college_id}
                    className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors relative"
                  >
                    <button
                      onClick={() => handleRemoveCollege(college.college_id)}
                      className="absolute top-3 right-3 p-1 hover:bg-muted rounded transition-colors"
                      aria-label="Remove from list"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                    <div className="pr-8">
                      <h3 className="font-semibold text-lg mb-1">{college.name}</h3>
                      <Badge className={cn("mb-3", tierColors[tier])}>
                        {tier}
                      </Badge>
                      <p className="text-sm text-muted-foreground leading-relaxed">{college.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <PaywallSheet
        open={upgradeOpen}
        onOpenChange={(o) => {
          setUpgradeOpen(o);
          if (!o) refreshUsage();
        }}
        context="list-builder"
        currentPlan={usage?.plan ?? "free"}
        usage={usage ? { used: usage.used, cap: usage.cap } : undefined}
      />
    </div>
  );
}
