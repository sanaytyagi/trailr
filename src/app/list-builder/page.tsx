"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CollegeQuiz } from "@/components/list-builder/CollegeQuiz";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GeneratedCollege {
  college_id: string;
  name: string;
  tier: "Reach" | "High Match" | "Match" | "Safety";
  reason: string;
}

export default function ListBuilderPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [savedList, setSavedList] = useState<GeneratedCollege[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removedColleges, setRemovedColleges] = useState<Set<string>>(new Set());

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

      const { data } = await supabase
        .from("user_lists")
        .select("colleges")
        .eq("user_id", user.id)
        .single();

      if (data?.colleges) {
        setSavedList(data.colleges);
      }
      setLoading(false);
    }

    loadUserAndList();
  }, [supabase]);

  const handleQuizComplete = async (answers: any) => {
    if (!user) {
      router.push("/auth?mode=signin");
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
        throw new Error(responseData.error || "Failed to generate list");
      }

      const { colleges } = responseData;
      setSavedList(colleges);

      // Save to Supabase
      await supabase
        .from("user_lists")
        .upsert(
          {
            user_id: user.id,
            colleges,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
    } catch (err) {
      setError(`Failed to generate your college list: ${err instanceof Error ? err.message : "Unknown error"}`);
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveCollege = (collegeId: string) => {
    setRemovedColleges((prev) => new Set(prev).add(collegeId));
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

  if (!user && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Sign In Required</h1>
        <p className="text-muted-foreground mb-6">Create an account to build your personalized college list.</p>
        <Button onClick={() => router.push("/auth?mode=signin")}>Sign In</Button>
      </div>
    );
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
    "High Match": "bg-blue-100 text-blue-700",
    Match: "bg-green-100 text-green-700",
    Safety: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* Header with Start Over button */}
      <div className="sticky top-16 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your Personalized College List</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartOver}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Start Over
          </Button>
        </div>
      </div>

      {/* Colleges grouped by tier */}
      <div className="max-w-6xl mx-auto px-6 py-8">
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
    </div>
  );
}
