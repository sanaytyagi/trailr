"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizAnswers {
  state: string;
  gpa: number;
  testType: "SAT" | "ACT" | "Neither";
  testScore: number | null;
  major: string;
  majorImportance: number;
  preferenceResearch: "Research-focused" | "Teaching-focused";
  budget: string;
  fafsa: boolean;
  loans: "Yes" | "No" | "Prefer to minimize";
  setting: "Urban" | "Suburban" | "Rural";
  size: "Small" | "Medium" | "Large";
  schoolType: "Public" | "Private" | "No preference";
  coopImportance: number;
  startupImportance: number;
  gradSchool: "Yes" | "Maybe" | "No";
  careers: string;
  alumniNetworkImportance: number;
  onCampusHousing: boolean;
}

interface CollegeQuizProps {
  onComplete: (answers: QuizAnswers) => void;
  isLoading?: boolean;
  onExit?: () => void;
}

const STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

const BUDGET_OPTIONS = ["Under $30k", "$30k–$50k", "$50k–$70k", "$70k+", "Unsure"];

export function CollegeQuiz({ onComplete, isLoading, onExit }: CollegeQuizProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [answers, setAnswers] = useState<QuizAnswers>({
    state: "",
    gpa: 3.5,
    testType: "Neither",
    testScore: null,
    major: "",
    majorImportance: 3,
    preferenceResearch: "Research-focused",
    budget: "Unsure",
    fafsa: true,
    loans: "Yes",
    setting: "Suburban",
    size: "Medium",
    schoolType: "No preference",
    coopImportance: 3,
    startupImportance: 2,
    gradSchool: "Maybe",
    careers: "",
    alumniNetworkImportance: 3,
    onCampusHousing: true,
  });

  // Step 0 is the intro slide; steps 1–17 are the quiz questions
  const totalSteps = 18;
  // Don't show progress on intro slide; start progress from step 1
  const progress = step === 0 ? 0 : (step / (totalSteps - 1)) * 100;

  const updateAnswer = (key: keyof QuizAnswers, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const transition = (nextStep: number) => {
    setVisible(false);
    setTimeout(() => {
      setStep(nextStep);
      setVisible(true);
    }, 200);
  };

  const handleNext = () => {
    if (step < totalSteps - 1) transition(step + 1);
    else onComplete(answers);
  };

  const handleBack = () => {
    if (step === 0) {
      onExit?.();
    } else {
      transition(step - 1);
    }
  };

  const renderQuestion = () => {
    switch (step) {
      case 0:
        return (
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-4">Build Your College List</h2>
            <p className="text-base text-muted-foreground mb-4">
              To generate a personalized college list, we need to learn a bit about you — your academic profile, preferences, and goals.
            </p>
            <p className="text-base text-muted-foreground mb-10">
              This takes about 2 minutes and covers things like your GPA, intended major, budget, and campus preferences. The more honest you are, the better your matches will be.
            </p>
            <NextButton onClick={handleNext} label="Let's get started" />
          </div>
        );
      case 1:
        return (
          <StepShell
            question="What state do you currently live in?"
            subtext="We'll find schools and programs that fit your region."
          >
            <select
              value={answers.state}
              onChange={(e) => updateAnswer("state", e.target.value)}
              className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Select a state...</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {answers.state && <NextButton onClick={handleNext} />}
          </StepShell>
        );
      case 2:
        return (
          <StepShell
            question="What is your current or expected GPA?"
            subtext="On a 4.0 scale. Be honest — it helps us find realistic matches."
          >
            <input
              type="number"
              min="0"
              max="4"
              step="0.1"
              value={answers.gpa || ""}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                updateAnswer("gpa", isNaN(val) ? 0 : val);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 3:
        return (
          <StepShell
            question="Have you taken the SAT or ACT?"
            subtext="Select the test(s) you've taken."
          >
            <div className="grid grid-cols-3 gap-3 mt-8">
              {(["SAT", "ACT"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    updateAnswer("testType", type as any);
                    if (type !== "Neither") updateAnswer("testScore", null);
                  }}
                  className={cn(
                    "rounded-2xl border-2 py-4 text-sm font-semibold transition-all",
                    answers.testType === type
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {type}
                </button>
              ))}
              <button
                onClick={() => {
                  updateAnswer("testType", "Neither");
                  updateAnswer("testScore", null);
                }}
                className={cn(
                  "rounded-2xl border-2 py-4 text-sm font-semibold transition-all",
                  answers.testType === "Neither"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                )}
              >
                Haven't tested
              </button>
            </div>
            {answers.testType !== "Neither" && (
              <input
                type="number"
                placeholder="Enter your score"
                value={answers.testScore || ""}
                onChange={(e) => updateAnswer("testScore", parseInt(e.target.value) || null)}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                className="w-full mt-4 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            )}
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 4:
        return (
          <StepShell
            question="What is your intended major?"
            subtext="Or the field(s) that interest you if undecided."
          >
            <input
              type="text"
              placeholder="e.g. Computer Science"
              value={answers.major}
              onChange={(e) => updateAnswer("major", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 5:
        return (
          <StepShell
            question="How important is major-specific ranking?"
            subtext="1 = not important, 5 = very important"
          >
            <div className="flex gap-3 mt-8">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => updateAnswer("majorImportance", n)}
                  className={cn(
                    "h-14 w-14 rounded-2xl border-2 font-semibold transition-all",
                    answers.majorImportance === n
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 6:
        return (
          <StepShell
            question="Research or teaching-focused?"
            subtext="Prefer hands-on research or classroom teaching?"
          >
            <div className="grid grid-cols-2 gap-3 mt-8">
              {(["Research-focused", "Teaching-focused"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => updateAnswer("preferenceResearch", type)}
                  className={cn(
                    "rounded-2xl border-2 py-4 text-sm font-semibold transition-all",
                    answers.preferenceResearch === type
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 7:
        return (
          <StepShell
            question="What's your college budget?"
            subtext="Annual cost including tuition, room, and board."
          >
            <select
              value={answers.budget}
              onChange={(e) => updateAnswer("budget", e.target.value)}
              className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              {BUDGET_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 8:
        return (
          <StepShell
            question="Will you apply for financial aid?"
            subtext="Via FAFSA (Federal Student Aid)"
          >
            <div className="grid grid-cols-2 gap-3 mt-8">
              {["Yes", "No"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => updateAnswer("fafsa", opt === "Yes")}
                  className={cn(
                    "rounded-2xl border-2 py-4 text-sm font-semibold transition-all",
                    (answers.fafsa && opt === "Yes") || (!answers.fafsa && opt === "No")
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 9:
        return (
          <StepShell
            question="Open to student loans?"
            subtext="Are you willing to take on debt to pay for college?"
          >
            <div className="flex flex-col gap-2 mt-8">
              {(["Yes", "No", "Prefer to minimize"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => updateAnswer("loans", opt)}
                  className={cn(
                    "rounded-2xl border-2 py-3 text-sm font-semibold transition-all text-left px-4",
                    answers.loans === opt
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 10:
        return (
          <StepShell
            question="Preferred campus setting?"
            subtext="Urban, suburban, or rural area?"
          >
            <div className="grid grid-cols-3 gap-3 mt-8">
              {(["Urban", "Suburban", "Rural"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => updateAnswer("setting", opt)}
                  className={cn(
                    "rounded-2xl border-2 py-4 text-sm font-semibold transition-all",
                    answers.setting === opt
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 11:
        return (
          <StepShell
            question="Preferred student body size?"
            subtext="How many students should the school have?"
          >
            <div className="grid grid-cols-3 gap-3 mt-8">
              {(["Small", "Medium", "Large"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => updateAnswer("size", opt)}
                  className={cn(
                    "rounded-2xl border-2 py-4 text-sm font-semibold transition-all",
                    answers.size === opt
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 12:
        return (
          <StepShell
            question="Public or private school?"
            subtext="Any preference between public universities and private colleges?"
          >
            <div className="flex flex-col gap-2 mt-8">
              {(["Public", "Private", "No preference"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => updateAnswer("schoolType", opt)}
                  className={cn(
                    "rounded-2xl border-2 py-3 text-sm font-semibold transition-all text-left px-4",
                    answers.schoolType === opt
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 13:
        return (
          <StepShell
            question="Co-op/internship support?"
            subtext="1 = not important, 5 = very important"
          >
            <div className="flex gap-3 mt-8">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => updateAnswer("coopImportance", n)}
                  className={cn(
                    "h-14 w-14 rounded-2xl border-2 font-semibold transition-all",
                    answers.coopImportance === n
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 14:
        return (
          <StepShell
            question="Startup/entrepreneurship culture?"
            subtext="1 = not important, 5 = very important"
          >
            <div className="flex gap-3 mt-8">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => updateAnswer("startupImportance", n)}
                  className={cn(
                    "h-14 w-14 rounded-2xl border-2 font-semibold transition-all",
                    answers.startupImportance === n
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 15:
        return (
          <StepShell
            question="Considering graduate school?"
            subtext="Are you planning to continue your education?"
          >
            <div className="grid grid-cols-3 gap-3 mt-8">
              {(["Yes", "Maybe", "No"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => updateAnswer("gradSchool", opt)}
                  className={cn(
                    "rounded-2xl border-2 py-4 text-sm font-semibold transition-all",
                    answers.gradSchool === opt
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 16:
        return (
          <StepShell
            question="What industries interest you?"
            subtext="Fields or careers you're thinking about."
          >
            <input
              type="text"
              placeholder="e.g. Tech, Finance, Healthcare..."
              value={answers.careers}
              onChange={(e) => updateAnswer("careers", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      case 17:
        return (
          <StepShell
            question="Tech alumni network importance?"
            subtext="1 = not important, 5 = very important"
          >
            <div className="flex gap-3 mt-8">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => updateAnswer("alumniNetworkImportance", n)}
                  className={cn(
                    "h-14 w-14 rounded-2xl border-2 font-semibold transition-all",
                    answers.alumniNetworkImportance === n
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <NextButton onClick={handleNext} />
          </StepShell>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Top bar: back button + step counter */}
      <div className="flex items-center justify-between px-6 pt-5 min-h-[40px]">
        <button
          onClick={handleBack}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        {step > 0 && (
          <span className="text-xs text-muted-foreground">
            {step} / {totalSteps - 1}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div
          className={cn(
            "w-full max-w-lg transition-all duration-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          )}
        >
          {renderQuestion()}
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
  subtext: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-3xl font-bold text-foreground mb-2">{question}</h2>
      <p className="text-base text-muted-foreground mb-6">{subtext}</p>
      {children}
    </div>
  );
}

function NextButton({ onClick, label = "Next" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}
