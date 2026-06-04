import { describe, it, expect } from "vitest";
import { resolveStudentProfile, formatProfileForPrompt, type ResolvedProfile } from "./profile";

const core: ResolvedProfile = { state: "California", gpa: 3.8, major: "Computer Science" };

const fullQuiz: ResolvedProfile = {
  state: "New York",
  gpa: 3.5,
  testTypes: ["SAT"],
  satScore: 1400,
  actScore: null,
  major: "Biology",
  majorImportance: 4,
  preferenceResearch: "Research-focused",
  budget: "$40k/year",
  fafsa: true,
  loans: "Prefer to minimize",
  setting: "Urban",
  sizes: ["Medium", "Large"],
  schoolType: "Public",
  coopImportance: 3,
  careerCultureImportance: 2,
  careerCultureDescription: "",
  gradSchool: "Maybe",
  gradSchoolTypes: [],
  careers: "Medicine",
  alumniNetworkImportance: 5,
  campusDiversityImportance: 4,
  campusLifeImportance: 3,
  otherPriorities: "",
};

describe("resolveStudentProfile", () => {
  it("returns null when neither source has data", () => {
    expect(resolveStudentProfile(null, null)).toBeNull();
    expect(resolveStudentProfile(undefined, undefined)).toBeNull();
    expect(resolveStudentProfile({}, {})).toBeNull();
  });

  it("returns core fields when only core_profile exists", () => {
    expect(resolveStudentProfile(core, null)).toEqual(core);
  });

  it("returns quiz fields when only quiz_answers exists", () => {
    expect(resolveStudentProfile(null, fullQuiz)).toEqual(fullQuiz);
  });

  it("lets the full quiz win on overlapping fields when both exist", () => {
    const merged = resolveStudentProfile(core, fullQuiz)!;
    // overlap → quiz wins
    expect(merged.state).toBe("New York");
    expect(merged.gpa).toBe(3.5);
    expect(merged.major).toBe("Biology");
    // quiz-only field still present
    expect(merged.budget).toBe("$40k/year");
  });

  it("does not let an undefined quiz field clobber a real core value", () => {
    const merged = resolveStudentProfile(core, { major: undefined, budget: "$10k" })!;
    expect(merged.major).toBe("Computer Science"); // core preserved
    expect(merged.budget).toBe("$10k");
  });

  it("ignores non-object inputs", () => {
    expect(resolveStudentProfile("nonsense", 42)).toBeNull();
    expect(resolveStudentProfile([1, 2], null)).toBeNull();
  });
});

describe("formatProfileForPrompt", () => {
  it("returns the empty text when profile is null", () => {
    expect(formatProfileForPrompt(null, "full", "NONE")).toBe("NONE");
  });

  it("never leaks 'undefined' for a core-only (partial) profile", () => {
    const out = formatProfileForPrompt(core, "full");
    expect(out).not.toContain("undefined");
    expect(out).toContain("State: California");
    expect(out).toContain("GPA: 3.8/4.0");
    expect(out).toContain("Intended major: Computer Science");
    // fields the core profile lacks must be omitted, not blanked
    expect(out).not.toContain("Annual budget");
    expect(out).not.toContain("importance");
  });

  it("renders the full set when all fields are present", () => {
    const out = formatProfileForPrompt(fullQuiz, "full");
    expect(out).toContain("Annual budget: $40k/year");
    expect(out).toContain("Test scores: SAT 1400");
    expect(out).toContain("Applying for financial aid (FAFSA): Yes");
    expect(out).not.toContain("undefined");
  });

  it("compact verbosity omits absent fields without 'undefined'", () => {
    const out = formatProfileForPrompt(core, "compact");
    expect(out).not.toContain("undefined");
    expect(out).toContain("GPA: 3.8/4.0");
    expect(out).toContain("Intended major: Computer Science");
    expect(out).not.toContain("Budget");
  });

  it("falls back to empty text when the profile has no renderable fields", () => {
    // an object with only blank values resolves to null upstream, but guard anyway
    expect(formatProfileForPrompt({ careerCultureDescription: "" }, "full", "NONE")).toBe("NONE");
  });
});
