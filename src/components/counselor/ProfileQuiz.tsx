"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TagInput } from "./TagInput";
import { CollegeTagSearch } from "./CollegeTagSearch";
import { ActivityCardList, type ActivityCard } from "./ActivityCardList";
import { cn } from "@/lib/utils";
import { ArrowRight, ArrowLeft, Loader2, GraduationCap } from "lucide-react";
import type { StudentProfile } from "@/types/counselor";

interface ProfileQuizProps {
  onComplete: () => void;
  initialProfile?: StudentProfile;
  onCancel?: () => void;
}

interface QuizState {
  grade: number | null;
  gpa_unweighted: string;
  gpa_weighted: string;
  testTypes: Set<"sat" | "act">;
  sat: string;
  act: string;
  ap_courses: string[];
  intended_major: string;
  activities: ActivityCard[];
  awards: ActivityCard[];
  target_colleges: string[];
}

const TOTAL_STEPS = 10;

function parseActivityCards(strings: string[] | undefined): ActivityCard[] {
  if (!strings || strings.length === 0) return [{ title: "", description: "" }];
  return strings.map((s) => {
    const idx = s.indexOf(": ");
    return idx !== -1
      ? { title: s.slice(0, idx), description: s.slice(idx + 2) }
      : { title: s, description: "" };
  });
}

export function ProfileQuiz({ onComplete, initialProfile, onCancel }: ProfileQuizProps) {
  const router = useRouter();
  const [step, setStep] = useState(initialProfile ? 1 : 0);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<QuizState>(() => {
    if (!initialProfile) return {
      grade: null,
      gpa_unweighted: "",
      gpa_weighted: "",
      testTypes: new Set<"sat" | "act">(),
      sat: "",
      act: "",
      ap_courses: [],
      intended_major: "",
      activities: [{ title: "", description: "" }],
      awards: [{ title: "", description: "" }],
      target_colleges: [],
    };
    const testTypes = new Set<"sat" | "act">();
    if (initialProfile.sat) testTypes.add("sat");
    if (initialProfile.act) testTypes.add("act");
    return {
      grade: initialProfile.grade ? Number(initialProfile.grade) : null,
      gpa_unweighted: initialProfile.gpa_unweighted != null ? String(initialProfile.gpa_unweighted) : "",
      gpa_weighted: initialProfile.gpa_weighted != null ? String(initialProfile.gpa_weighted) : "",
      testTypes,
      sat: initialProfile.sat != null ? String(initialProfile.sat) : "",
      act: initialProfile.act != null ? String(initialProfile.act) : "",
      ap_courses: initialProfile.ap_courses ?? [],
      intended_major: initialProfile.intended_major ?? "",
      activities: parseActivityCards(initialProfile.activities),
      awards: parseActivityCards(initialProfile.awards),
      target_colleges: initialProfile.target_colleges ?? [],
    };
  });

  function transition(nextStep: number) {
    setVisible(false);
    setError("");
    setTimeout(() => {
      setStep(nextStep);
      setVisible(true);
    }, 200);
  }

  function advance() {
    transition(step + 1);
  }

  function back() {
    transition(step - 1);
  }

  function skip() {
    transition(step + 1);
  }

  function validateAndAdvance() {
    setError("");

    if (step === 2) {
      const v = parseFloat(state.gpa_unweighted);
      if (isNaN(v) || v < 0 || v > 4) {
        setError("Please enter a GPA between 0.00 and 4.00.");
        return;
      }
    }

    if (step === 3) {
      const v = parseFloat(state.gpa_weighted);
      if (isNaN(v) || v < 0 || v > 5) {
        setError("Please enter a GPA between 0.00 and 5.00.");
        return;
      }
    }

    if (step === 4) {
      if (state.testTypes.has("sat")) {
        const v = parseInt(state.sat);
        if (isNaN(v) || v < 400 || v > 1600) {
          setError("Please enter a valid SAT score (400–1600).");
          return;
        }
      }
      if (state.testTypes.has("act")) {
        const v = parseInt(state.act);
        if (isNaN(v) || v < 1 || v > 36) {
          setError("Please enter a valid ACT score (1–36).");
          return;
        }
      }
    }

    if (step === 9) {
      if (state.target_colleges.length === 0) {
        setError("Please add at least one target college.");
        return;
      }
    }

    advance();
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const profileData = {
        user_id: user.id,
        grade: state.grade!,
        gpa_unweighted: state.gpa_unweighted ? parseFloat(state.gpa_unweighted) : null,
        gpa_weighted: state.gpa_weighted ? parseFloat(state.gpa_weighted) : null,
        sat: state.testTypes.has("sat") && state.sat ? parseInt(state.sat) : null,
        act: state.testTypes.has("act") && state.act ? parseInt(state.act) : null,
        ap_courses: state.ap_courses,
        intended_major: state.intended_major || null,
        activities: state.activities
          .filter((a) => a.title.trim())
          .map((a) => a.description.trim() ? `${a.title.trim()}: ${a.description.trim()}` : a.title.trim()),
        awards: state.awards
          .filter((a) => a.title.trim())
          .map((a) => a.description.trim() ? `${a.title.trim()}: ${a.description.trim()}` : a.title.trim()),
        target_colleges: state.target_colleges,
      };

      const { error: dbError } = await supabase
        .from("student_profiles")
        .upsert(profileData, { onConflict: "user_id" });

      if (dbError) throw dbError;

      onComplete();
    } catch {
      setError("Something went wrong — please try again.");
      setSaving(false);
    }
  }

  // Progress only counts question steps 1–9 (not confirmation)
  const progress = step >= TOTAL_STEPS ? 100 : ((step - 1) / (TOTAL_STEPS - 2)) * 100;
  const showProgress = true;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: showProgress ? `${progress}%` : "0%" }}
        />
      </div>

      {/* Top bar: back button + step counter */}
      <div className="flex items-center justify-between px-6 pt-5 min-h-[40px]">
        {step > 1 && step <= TOTAL_STEPS ? (
          <button
            onClick={back}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : step === 1 ? (
          <button
            onClick={onCancel ?? (() => transition(0))}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {onCancel ? "Cancel" : "Back"}
          </button>
        ) : step === 0 ? (
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <div />
        )}
        <span className="text-xs text-muted-foreground">
          {step >= 1 && step < TOTAL_STEPS ? `${step} / ${TOTAL_STEPS - 1}` : ""}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div
          className={cn(
            "w-full max-w-lg transition-all duration-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          )}
        >
          {/* Step 0 — Intro */}
          {step === 0 && (
            <div className="text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-4xl font-bold text-foreground mb-3">Before we get started</h2>
              <p className="text-base text-muted-foreground max-w-sm mx-auto mb-10">
                We need a bit of info about you so your counselor can give you advice that's actually specific to your situation. Takes about 2 minutes.
              </p>
              <button
                onClick={advance}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Let's go
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {/* Step 1 — Grade */}
          {step === 1 && (
            <StepShell
              question="What grade are you in?"
              subtext="We'll calibrate your plan based on how much time you have."
            >
              <div className="grid grid-cols-2 gap-3 mt-8">
                {[9, 10, 11, 12].map((g) => (
                  <button
                    key={g}
                    onClick={() => setState((s) => ({ ...s, grade: g }))}
                    className={cn(
                      "rounded-2xl border-2 py-6 text-lg font-semibold transition-all",
                      state.grade === g
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                    )}
                  >
                    {g}th Grade
                  </button>
                ))}
              </div>
              {state.grade !== null && <NextButton onClick={advance} />}
            </StepShell>
          )}

          {/* Step 2 — Unweighted GPA */}
          {step === 2 && (
            <StepShell
              question="What's your unweighted GPA?"
              subtext="On a 4.0 scale. Be honest — accurate info means accurate advice."
            >
              <input
                type="number"
                min={0}
                max={4}
                step={0.01}
                placeholder="e.g. 3.85"
                value={state.gpa_unweighted}
                onChange={(e) => setState((s) => ({ ...s, gpa_unweighted: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && validateAndAdvance()}
                className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {error && <p className="text-sm text-destructive mt-2">{error}</p>}
              <NextButton onClick={validateAndAdvance} />
            </StepShell>
          )}

          {/* Step 3 — Weighted GPA */}
          {step === 3 && (
            <StepShell
              question="What's your weighted GPA?"
              subtext="If your school doesn't use a weighted scale, enter the same number as before."
            >
              <input
                type="number"
                min={0}
                max={5}
                step={0.01}
                placeholder="e.g. 4.20"
                value={state.gpa_weighted}
                onChange={(e) => setState((s) => ({ ...s, gpa_weighted: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && validateAndAdvance()}
                className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {error && <p className="text-sm text-destructive mt-2">{error}</p>}
              <NextButton onClick={validateAndAdvance} />
            </StepShell>
          )}

          {/* Step 4 — Testing */}
          {step === 4 && (
            <StepShell
              question="Have you taken the SAT or ACT?"
              subtext="Select all that apply."
            >
              <div className="grid grid-cols-3 gap-3 mt-8">
                {(["SAT", "ACT"] as const).map((label) => {
                  const key = label.toLowerCase() as "sat" | "act";
                  const selected = state.testTypes.has(key);
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        setState((s) => {
                          const next = new Set(s.testTypes);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return { ...s, testTypes: next };
                        });
                      }}
                      className={cn(
                        "rounded-2xl border-2 py-5 text-sm font-semibold transition-all",
                        selected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  onClick={() => setState((s) => ({ ...s, testTypes: new Set(), sat: "", act: "" }))}
                  className={cn(
                    "rounded-2xl border-2 py-5 text-sm font-semibold transition-all",
                    state.testTypes.size === 0
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  Haven't tested yet
                </button>
              </div>

              {state.testTypes.has("sat") && (
                <input
                  type="number"
                  min={400}
                  max={1600}
                  placeholder="SAT score (400–1600)"
                  value={state.sat}
                  onChange={(e) => setState((s) => ({ ...s, sat: e.target.value }))}
                  className="w-full mt-4 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              )}
              {state.testTypes.has("act") && (
                <input
                  type="number"
                  min={1}
                  max={36}
                  placeholder="ACT score (1–36)"
                  value={state.act}
                  onChange={(e) => setState((s) => ({ ...s, act: e.target.value }))}
                  className="w-full mt-4 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              )}

              {error && <p className="text-sm text-destructive mt-2">{error}</p>}
              <NextButton onClick={validateAndAdvance} />
            </StepShell>
          )}

          {/* Step 5 — AP/IB Courses */}
          {step === 5 && (
            <StepShell
              question="What AP or IB courses have you taken or are currently taking?"
              subtext="Include courses you're taking this year. Type one, press Enter or comma to add it."
            >
              <div className="mt-8">
                <TagInput
                  tags={state.ap_courses}
                  onChange={(tags) => setState((s) => ({ ...s, ap_courses: tags }))}
                  placeholder="e.g. AP Calculus BC"
                  max={20}
                />
              </div>
              <NextButton onClick={advance} />
              <SkipButton onClick={skip} />
            </StepShell>
          )}

          {/* Step 6 — Intended Major */}
          {step === 6 && (
            <StepShell
              question="What do you want to study in college?"
              subtext="Undecided is completely fine — just give us your best guess right now."
            >
              <input
                type="text"
                placeholder="e.g. Computer Science, Biology, Undecided"
                value={state.intended_major}
                onChange={(e) => setState((s) => ({ ...s, intended_major: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && advance()}
                className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <NextButton onClick={advance} />
              <SkipButton onClick={skip} />
            </StepShell>
          )}

          {/* Step 7 — Activities */}
          {step === 7 && (
            <StepShell
              question="What do you spend your time on outside of class?"
              subtext="Add one card per activity. Be specific about your role, not just the activity name."
            >
              <div className="mt-6 max-h-[50vh] overflow-y-auto pr-1">
                <ActivityCardList
                  cards={state.activities}
                  onChange={(cards) => setState((s) => ({ ...s, activities: cards }))}
                  titlePlaceholder="Activity title (e.g. Robotics Club)"
                  descriptionPlaceholder="Your role and what you did (e.g. President — led 12-person team to regional finals)"
                  addLabel="Add activity"
                  max={10}
                />
              </div>
              <NextButton onClick={advance} />
              <SkipButton onClick={skip} />
            </StepShell>
          )}

          {/* Step 8 — Awards */}
          {step === 8 && (
            <StepShell
              question="Any notable awards or achievements?"
              subtext="Add one card per award. Skip if none yet — many students don't have any at this stage."
            >
              <div className="mt-6 max-h-[50vh] overflow-y-auto pr-1">
                <ActivityCardList
                  cards={state.awards}
                  onChange={(cards) => setState((s) => ({ ...s, awards: cards }))}
                  titlePlaceholder="Award name (e.g. National Merit Semifinalist)"
                  descriptionPlaceholder="Context — when, where, what it was for (optional)"
                  addLabel="Add award"
                  max={10}
                />
              </div>
              <NextButton onClick={advance} />
              <SkipButton onClick={skip} />
            </StepShell>
          )}

          {/* Step 9 — Target Colleges */}
          {step === 9 && (
            <StepShell
              question="Which colleges are you aiming for?"
              subtext="Add every school on your list — reaches, matches, and safeties. We'll evaluate each one honestly."
            >
              <div className="mt-6">
                <CollegeTagSearch
                  colleges={state.target_colleges}
                  onChange={(colleges) => setState((s) => ({ ...s, target_colleges: colleges }))}
                  max={15}
                />
              </div>
              {error && <p className="text-sm text-destructive mt-2">{error}</p>}
              <NextButton onClick={validateAndAdvance} />
            </StepShell>
          )}

          {/* Step 10 — Confirmation */}
          {step === 10 && (
            <div className="text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                <span className="text-3xl">🎓</span>
              </div>
              <h2 className="text-4xl font-bold text-foreground mb-3">You're all set.</h2>
              <p className="text-base text-muted-foreground mb-10">
                Your counselor is ready. Let's build your plan.
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground",
                  "hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Get my plan
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              {error && <p className="text-sm text-destructive mt-4">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepShell({
  question,
  subtext,
  children,
}: {
  question: string;
  subtext?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-[28px] font-bold leading-snug text-foreground">{question}</h2>
      {subtext && (
        <p className="mt-2 text-base text-muted-foreground">{subtext}</p>
      )}
      {children}
    </div>
  );
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      Next
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 block text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Skip
    </button>
  );
}
