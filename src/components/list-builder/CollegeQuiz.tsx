"use client";

import { useState } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizAnswers {
  state: string;
  gpa: number;
  testTypes: ("SAT" | "ACT")[];
  satScore: number | null;
  actScore: number | null;
  major: string;
  majorImportance: number;
  preferenceResearch: "Research-focused" | "Teaching-focused";
  budget: string;
  fafsa: boolean;
  loans: "Yes" | "No" | "Prefer to minimize";
  setting: "Urban" | "Suburban" | "Rural";
  sizes: ("Small" | "Medium" | "Large")[];
  schoolType: "Public" | "Private" | "No preference";
  coopImportance: number;
  careerCultureImportance: number;
  careerCultureDescription: string;
  gradSchool: "Yes" | "Maybe" | "No";
  gradSchoolTypes: string[];
  careers: string;
  alumniNetworkImportance: number;
  campusDiversityImportance: number;
  campusLifeImportance: number;
  otherPriorities: string;
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
const GRAD_SCHOOL_TYPES = ["Masters", "PhD", "Medical School", "Law School", "Business School", "Unsure"];

export function CollegeQuiz({ onComplete, isLoading, onExit }: CollegeQuizProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [answers, setAnswers] = useState<QuizAnswers>({
    state: "",
    gpa: 3.5,
    testTypes: [],
    satScore: null,
    actScore: null,
    major: "",
    majorImportance: 3,
    preferenceResearch: "Research-focused",
    budget: "Unsure",
    fafsa: true,
    loans: "Yes",
    setting: "Suburban",
    sizes: ["Medium"],
    schoolType: "No preference",
    coopImportance: 3,
    careerCultureImportance: 3,
    careerCultureDescription: "",
    gradSchool: "Maybe",
    gradSchoolTypes: [],
    careers: "",
    alumniNetworkImportance: 3,
    campusDiversityImportance: 3,
    campusLifeImportance: 3,
    otherPriorities: "",
  });

  // Step 0 = intro, steps 1–20 = questions
  const totalSteps = 21;
  const progress = step === 0 ? 0 : (step / (totalSteps - 1)) * 100;

  const updateAnswer = (key: keyof QuizAnswers, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTestType = (type: "SAT" | "ACT") => {
    setAnswers((prev) => {
      const current = prev.testTypes;
      if (current.includes(type)) {
        const next = current.filter((t) => t !== type);
        return {
          ...prev,
          testTypes: next,
          satScore: type === "SAT" ? null : prev.satScore,
          actScore: type === "ACT" ? null : prev.actScore,
        };
      }
      return { ...prev, testTypes: [...current, type] };
    });
  };

  const toggleSize = (size: "Small" | "Medium" | "Large") => {
    setAnswers((prev) => {
      const current = prev.sizes;
      if (current.includes(size)) {
        return { ...prev, sizes: current.filter((s) => s !== size) };
      }
      return { ...prev, sizes: [...current, size] };
    });
  };

  const toggleGradType = (type: string) => {
    setAnswers((prev) => {
      const current = prev.gradSchoolTypes;
      if (current.includes(type)) {
        return { ...prev, gradSchoolTypes: current.filter((t) => t !== type) };
      }
      return { ...prev, gradSchoolTypes: [...current, type] };
    });
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
    if (step === 0) onExit?.();
    else transition(step - 1);
  };

  const renderQuestion = () => {
    switch (step) {
      // ── Intro ─────────────────────────────────────────────────────────────
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

      // ── Q1: State ─────────────────────────────────────────────────────────
      case 1:
        return (
          <StepShell
            question="What state do you currently live in?"
            subtext="We'll use this to factor in in-state tuition and regional fit."
          >
            <select
              value={answers.state}
              onChange={(e) => updateAnswer("state", e.target.value)}
              className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Select a state...</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {answers.state && <NextButton onClick={handleNext} />}
          </StepShell>
        );

      // ── Q2: GPA ───────────────────────────────────────────────────────────
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

      // ── Q3: Test scores ───────────────────────────────────────────────────
      case 3:
        return (
          <StepShell
            question="Have you taken the SAT or ACT?"
            subtext="Select all that apply. Score inputs will appear for each selected test."
          >
            <div className="grid grid-cols-3 gap-3 mt-8">
              {(["SAT", "ACT"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => toggleTestType(type)}
                  className={cn(
                    "rounded-2xl border-2 py-4 text-sm font-semibold transition-all",
                    answers.testTypes.includes(type)
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {type}
                </button>
              ))}
              <button
                onClick={() => {
                  updateAnswer("testTypes", []);
                  updateAnswer("satScore", null);
                  updateAnswer("actScore", null);
                }}
                className={cn(
                  "rounded-2xl border-2 py-4 text-sm font-semibold transition-all",
                  answers.testTypes.length === 0
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                )}
              >
                Haven't tested yet
              </button>
            </div>
            {answers.testTypes.includes("SAT") && (
              <input
                type="number"
                placeholder="SAT score (400–1600)"
                value={answers.satScore || ""}
                onChange={(e) => updateAnswer("satScore", parseInt(e.target.value) || null)}
                className="w-full mt-4 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            )}
            {answers.testTypes.includes("ACT") && (
              <input
                type="number"
                placeholder="ACT score (1–36)"
                value={answers.actScore || ""}
                onChange={(e) => updateAnswer("actScore", parseInt(e.target.value) || null)}
                className="w-full mt-4 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            )}
            <NextButton onClick={handleNext} />
          </StepShell>
        );

      // ── Q4: Major ─────────────────────────────────────────────────────────
      case 4:
        return (
          <StepShell
            question="What is your intended major or field of study?"
            subtext="If undecided, what subjects interest you most?"
          >
            <input
              type="text"
              placeholder="e.g. Computer Science, Biology, Undecided"
              value={answers.major}
              onChange={(e) => updateAnswer("major", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <NextButton onClick={handleNext} />
          </StepShell>
        );

      // ── Q5: Major ranking importance ──────────────────────────────────────
      case 5:
        return (
          <StepShell
            question="How important is it that your school is highly ranked in your intended major?"
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

      // ── Q6: Research vs teaching ──────────────────────────────────────────
      case 6:
        return (
          <StepShell
            question="Do you prefer a research-focused university or a teaching-focused college?"
            subtext="Research universities emphasize labs and graduate study; teaching colleges prioritize undergrad instruction."
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

      // ── Q7: Budget ────────────────────────────────────────────────────────
      case 7:
        return (
          <StepShell
            question="What is your approximate annual budget for college?"
            subtext="Including tuition, room, and board."
          >
            <select
              value={answers.budget}
              onChange={(e) => updateAnswer("budget", e.target.value)}
              className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              {BUDGET_OPTIONS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <NextButton onClick={handleNext} />
          </StepShell>
        );

      // ── Q8: FAFSA ─────────────────────────────────────────────────────────
      case 8:
        return (
          <StepShell
            question="Will you be applying for financial aid via FAFSA?"
            subtext="The Free Application for Federal Student Aid determines your eligibility for grants and loans."
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

      // ── Q9: Loans ─────────────────────────────────────────────────────────
      case 9:
        return (
          <StepShell
            question="Are you open to taking on student loans?"
            subtext="This helps us factor in cost and financial fit."
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

      // ── Q10: Setting ──────────────────────────────────────────────────────
      case 10:
        return (
          <StepShell
            question="What campus setting do you prefer?"
            subtext="Think about the type of environment where you'd feel most at home."
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

      // ── Q11: Student body size ────────────────────────────────────────────
      case 11:
        return (
          <StepShell
            question="What student body size do you prefer?"
            subtext="Select all that you'd be comfortable with."
          >
            <div className="grid grid-cols-3 gap-3 mt-8">
              {(["Small", "Medium", "Large"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => toggleSize(opt)}
                  className={cn(
                    "rounded-2xl border-2 py-4 text-sm font-semibold transition-all",
                    answers.sizes.includes(opt)
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  <div>{opt}</div>
                  <div className="text-xs font-normal mt-1 opacity-70">
                    {opt === "Small" ? "under 5k" : opt === "Medium" ? "5k–15k" : "15k+"}
                  </div>
                </button>
              ))}
            </div>
            {answers.sizes.length > 0 && <NextButton onClick={handleNext} />}
          </StepShell>
        );

      // ── Q12: Public vs private ────────────────────────────────────────────
      case 12:
        return (
          <StepShell
            question="Do you have a preference between public and private institutions?"
            subtext="Public universities are typically larger with lower in-state tuition; private colleges are often smaller and more selective."
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

      // ── Q13: Career services / co-op ──────────────────────────────────────
      case 13:
        return (
          <StepShell
            question="How important is strong career services, co-op, or internship placement support?"
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

      // ── Q14: Career culture importance ────────────────────────────────────
      case 14:
        return (
          <StepShell
            question="How important is it that your school has a strong culture around your intended career field?"
            subtext="e.g. entrepreneurship, research labs, clinical rotations, studio culture, pre-law societies"
          >
            <div className="flex gap-3 mt-8">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => updateAnswer("careerCultureImportance", n)}
                  className={cn(
                    "h-14 w-14 rounded-2xl border-2 font-semibold transition-all",
                    answers.careerCultureImportance === n
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Optional: describe what that culture looks like for you"
              value={answers.careerCultureDescription}
              onChange={(e) => updateAnswer("careerCultureDescription", e.target.value)}
              className="w-full mt-4 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <NextButton onClick={handleNext} />
          </StepShell>
        );

      // ── Q15: Grad school ──────────────────────────────────────────────────
      case 15:
        return (
          <StepShell
            question="Are you considering graduate or professional school after undergrad?"
            subtext="This helps us weigh research opportunities and academic rigor."
          >
            <div className="grid grid-cols-3 gap-3 mt-8">
              {(["Yes", "Maybe", "No"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    updateAnswer("gradSchool", opt);
                    if (opt === "No") updateAnswer("gradSchoolTypes", []);
                  }}
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
            {(answers.gradSchool === "Yes" || answers.gradSchool === "Maybe") && (
              <div className="mt-6">
                <p className="text-sm font-medium text-foreground mb-3">
                  What type? <span className="text-muted-foreground font-normal">(select all that apply)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {GRAD_SCHOOL_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleGradType(type)}
                      className={cn(
                        "rounded-2xl border-2 py-3 text-sm font-semibold transition-all",
                        answers.gradSchoolTypes.includes(type)
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <NextButton onClick={handleNext} />
          </StepShell>
        );

      // ── Q16: Career interests ─────────────────────────────────────────────
      case 16:
        return (
          <StepShell
            question="What industries or career paths are you currently drawn to?"
            subtext="Even broadly — e.g. medicine, journalism, education, finance, engineering"
          >
            <input
              type="text"
              placeholder="e.g. Tech, Finance, Healthcare, Law..."
              value={answers.careers}
              onChange={(e) => updateAnswer("careers", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <NextButton onClick={handleNext} />
          </StepShell>
        );

      // ── Q17: Alumni network ───────────────────────────────────────────────
      case 17:
        return (
          <StepShell
            question="How important is it that your school has a strong alumni network in your intended industry?"
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

      // ── Q18: Campus diversity ─────────────────────────────────────────────
      case 18:
        return (
          <StepShell
            question="How important is campus diversity — ethnic, cultural, and socioeconomic?"
            subtext="1 = not important, 5 = very important"
          >
            <div className="flex gap-3 mt-8">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => updateAnswer("campusDiversityImportance", n)}
                  className={cn(
                    "h-14 w-14 rounded-2xl border-2 font-semibold transition-all",
                    answers.campusDiversityImportance === n
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

      // ── Q19: Campus life ──────────────────────────────────────────────────
      case 19:
        return (
          <StepShell
            question="How important is campus life — clubs, organizations, traditions, and school spirit?"
            subtext="1 = not important, 5 = very important"
          >
            <div className="flex gap-3 mt-8">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => updateAnswer("campusLifeImportance", n)}
                  className={cn(
                    "h-14 w-14 rounded-2xl border-2 font-semibold transition-all",
                    answers.campusLifeImportance === n
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

      // ── Q20: Other priorities ─────────────────────────────────────────────
      case 20:
        return (
          <StepShell
            question="Do you have any other priorities or dealbreakers we should know about?"
            subtext="Optional — e.g. 'I need a strong music program', 'I want to be near family', 'I have a specific religious preference'"
          >
            <textarea
              placeholder="Share anything else that matters to you..."
              value={answers.otherPriorities}
              onChange={(e) => updateAnswer("otherPriorities", e.target.value)}
              rows={4}
              className="w-full mt-8 rounded-xl border border-input bg-muted/50 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
            <NextButton onClick={handleNext} label="Generate My List" />
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

      {/* Top bar */}
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
