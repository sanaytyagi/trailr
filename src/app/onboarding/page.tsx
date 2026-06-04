"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, BookOpen, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { coreProfileSchema } from "@/lib/schemas/quiz-answers";
import { hasFullQuiz } from "@/lib/assistant/profile";
import { US_STATES } from "@/lib/us-states";

// Counselor role is hidden pre-launch. Set NEXT_PUBLIC_COUNSELOR_ENABLED=true to restore.
const COUNSELOR_ENABLED = process.env.NEXT_PUBLIC_COUNSELOR_ENABLED === "true";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Onboarding has two steps:
//   "role" — pick student/counselor (only shown when COUNSELOR_ENABLED)
//   "core" — capture the 3-field core profile (state, GPA, major) that powers
//            every AI surface. Required for students; counselors skip it.
//
// A student is sent here (by src/proxy.ts) whenever their profiles.core_profile
// is null, so existing accounts also complete it once. The save is a plain
// client-side update to profiles.core_profile — no AI call, no quota spent.
type Step = "loading" | "role" | "core";

export default function OnboardingPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [step, setStep] = useState<Step>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core-profile form state.
  const [state, setState] = useState("");
  const [gpa, setGpa] = useState("");
  const [major, setMajor] = useState("");

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth?mode=signin");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, core_profile")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile check error:", profileError.message);
      }

      if (profile) {
        // Counselors never need a core profile.
        if (profile.role === "counselor") {
          router.push("/counselor");
          return;
        }
        // Student with a core profile already → done.
        if (profile.core_profile) {
          router.push("/tracker");
          return;
        }
        // Student missing the core profile, but if they already completed the
        // full List Builder quiz they have state/gpa/major — backfill and let
        // them in rather than re-asking.
        if (await backfillFromQuizIfPresent(user.id)) {
          router.push("/tracker");
          return;
        }
        // Genuinely no data → capture the core profile.
        setStep("core");
        return;
      }

      // No profile row yet.
      if (!COUNSELOR_ENABLED) {
        // Counselor role hidden pre-launch: create the student profile, then
        // capture the core profile (do NOT bounce to /tracker yet).
        const created = await createProfile("student");
        if (created) setStep("core");
        return;
      }

      setStep("role");
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router]);

  // If the student already completed the full List Builder quiz, derive the
  // 3-field core profile from it and save it, so they're never re-asked. Returns
  // true when the quiz was present (caller should send them into the app),
  // false when there's no quiz data (caller should show the core step).
  async function backfillFromQuizIfPresent(userId: string): Promise<boolean> {
    const { data: listRow } = await supabase
      .from("user_lists")
      .select("colleges")
      .eq("user_id", userId)
      .maybeSingle();

    const blob = listRow?.colleges as { quiz_answers?: Record<string, unknown> } | null;
    if (!hasFullQuiz(blob)) return false;

    const q = blob!.quiz_answers!;
    const parsed = coreProfileSchema.safeParse({
      state: typeof q.state === "string" ? q.state.trim() : q.state,
      gpa: typeof q.gpa === "number" ? q.gpa : Number(q.gpa),
      major: typeof q.major === "string" ? q.major.trim() : q.major,
    });
    if (parsed.success) {
      await supabase.from("profiles").update({ core_profile: parsed.data }).eq("id", userId);
    }
    // Even if the 3 fields couldn't be parsed, the student has done the quiz —
    // the AI reads quiz_answers directly, so don't trap them in the core step.
    return true;
  }

  // Creates the profile row. Returns true if the caller should proceed to the
  // core step (student, profile now exists). Handles the already-exists races by
  // redirecting. Returns false when it has already navigated away.
  async function createProfile(role: "student" | "counselor"): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check first — profile may already exist (returning user, or RLS hid it).
    const { data: existing } = await supabase
      .from("profiles")
      .select("role, core_profile")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) {
      if (existing.role === "counselor") {
        router.push("/counselor");
        return false;
      }
      if (existing.core_profile) {
        router.push("/tracker");
        return false;
      }
      return true; // student, needs core profile
    }

    const inviteCode = role === "counselor" ? generateInviteCode() : null;
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email!,
      full_name: (user.user_metadata?.name as string) ?? null,
      role,
      invite_code: inviteCode,
    });

    if (insertError) {
      // Duplicate key means the profile appeared between check and insert.
      if (insertError.code === "23505") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, core_profile")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.role === "counselor") {
          router.push("/counselor");
          return false;
        }
        if (profile?.core_profile) {
          router.push("/tracker");
          return false;
        }
        return true;
      }
      console.error("Failed to create profile:", insertError.message);
      setError("Failed to set up your account. Please try again.");
      return false;
    }

    if (role === "counselor") {
      router.push("/counselor");
      return false;
    }
    return true;
  }

  async function handleSelectRole(role: "student" | "counselor") {
    setSubmitting(true);
    setError(null);
    const proceed = await createProfile(role);
    setSubmitting(false);
    if (proceed) setStep("core");
  }

  async function handleSubmitCore(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = coreProfileSchema.safeParse({
      state: state.trim(),
      gpa: gpa === "" ? NaN : Number(gpa),
      major: major.trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please fill in all three fields.");
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth?mode=signin");
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ core_profile: parsed.data })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to save core profile:", updateError.message);
      setError("Couldn't save your profile. Please try again.");
      setSubmitting(false);
      return;
    }

    // Write has landed; the proxy gate will now let the student through.
    router.push("/tracker");
  }

  if (step === "loading") {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (step === "core") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-3">A few quick things</h1>
            <p className="text-muted-foreground text-lg">
              This takes 30 seconds and lets your AI assistant give advice that
              actually fits you. You can fill in the rest later in List Builder.
            </p>
          </div>

          <form onSubmit={handleSubmitCore} className="space-y-6">
            <div>
              <label htmlFor="state" className="block text-sm font-medium mb-2">
                What state do you live in?
              </label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="">Select a state...</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="gpa" className="block text-sm font-medium mb-2">
                What is your current or expected GPA? (out of 4.0)
              </label>
              <input
                id="gpa"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="5"
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                placeholder="3.5"
                className="w-full rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label htmlFor="major" className="block text-sm font-medium mb-2">
                What do you want to study?
              </label>
              <input
                id="major"
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="e.g. Computer Science, Undecided, Biology"
                maxLength={200}
                className="w-full rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue to Trailr
            </button>
          </form>
        </div>
      </div>
    );
  }

  // step === "role"
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6">
      <div className="max-w-2xl w-full text-center mb-10">
        <h1 className="text-3xl font-bold mb-3">Welcome to Trailr</h1>
        <p className="text-muted-foreground text-lg">How will you be using the app?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-2xl w-full">
        <button
          onClick={() => handleSelectRole("student")}
          disabled={submitting}
          className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-8 text-center hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-1">I&apos;m a Student</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Track your college applications, get AI-powered advice, and build your college list.
            </p>
          </div>
        </button>

        {COUNSELOR_ENABLED && (
          <button
            onClick={() => handleSelectRole("counselor")}
            disabled={submitting}
            className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-8 text-center hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">I&apos;m a Counselor</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Monitor your students&apos; progress, view their college lists, and add personalized notes.
              </p>
            </div>
          </button>
        )}
      </div>

      {error && <p className="mt-6 text-sm text-destructive text-center">{error}</p>}

      {submitting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}
