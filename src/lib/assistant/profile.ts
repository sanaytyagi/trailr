import type { QuizAnswers } from "@/lib/schemas/quiz-answers";

// Shared student-profile resolution + prompt formatting for every AI surface
// (assistant, opening message, research brief + followup).
//
// A student's preference data can live in two places:
//   - profiles.core_profile        : the 3-field core captured at registration
//   - user_lists.colleges.quiz_answers : the full 24-field List Builder quiz
//
// resolveStudentProfile merges them. The full quiz is the richer, newer-or-equal
// source (registration runs once, before any quiz), so it WINS on the 3
// overlapping fields:
//
//     resolved = { ...core_profile, ...quiz_answers }
//
// This relies on coreProfileSchema using the exact quizAnswersSchema field names
// (state, gpa, major) so the spread is key-aligned. See quiz-answers.ts.
//
// formatProfileForPrompt turns the resolved profile into prompt text and OMITS
// any absent field, so a partial profile (e.g. core-only) never leaks
// "Annual budget: undefined" into the prompt.

export type ResolvedProfile = Partial<QuizAnswers> & Record<string, unknown>;

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * True when a user_lists.colleges blob already holds saved List Builder quiz
 * answers. A student who has done the full quiz already has state/gpa/major, so
 * the onboarding core step and the proxy gate must NOT push them through it again
 * just because profiles.core_profile happens to be null (e.g. existing accounts
 * that predate the core_profile backfill). Pure + isomorphic: used in the proxy
 * (server), onboarding, and the completion nudge (client).
 */
export function hasFullQuiz(collegesBlob: unknown): boolean {
  const blob = asObject(collegesBlob);
  return !!blob && !!asObject(blob.quiz_answers);
}

/**
 * Merge the core profile and the full quiz answers into one object the AI
 * surfaces can read. Quiz answers win on overlapping fields. Returns null when
 * neither source has any data.
 */
export function resolveStudentProfile(
  coreProfile: unknown,
  quizAnswers: unknown
): ResolvedProfile | null {
  const core = asObject(coreProfile);
  const quiz = asObject(quizAnswers);

  if (!core && !quiz) return null;

  const merged: Record<string, unknown> = { ...(core ?? {}) };
  // Overlay quiz values, but never let an undefined quiz field clobber a real
  // core value. Explicit nulls (e.g. satScore) are real answers and kept.
  if (quiz) {
    for (const [k, val] of Object.entries(quiz)) {
      if (val !== undefined) merged[k] = val;
    }
  }

  // All-empty guard: an object with only empty-string / null values is no data.
  const hasAny = Object.values(merged).some((v) => present(v));
  if (!hasAny) return null;

  return merged as ResolvedProfile;
}

// A field is "present" (worth rendering) when it is not undefined, not null, and
// not an empty string or empty array.
function present(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function testScores(p: ResolvedProfile): string | null {
  const types = p.testTypes;
  if (!Array.isArray(types) || types.length === 0) return null;
  return types
    .map((t) => (t === "SAT" ? `SAT ${p.satScore ?? "n/a"}` : `ACT ${p.actScore ?? "n/a"}`))
    .join(", ");
}

/**
 * Render the resolved profile as prompt text. `verbosity: "full"` matches the
 * assistant's detailed block; `"compact"` matches the opening message's terse
 * block. Absent fields are omitted entirely. When there is no data, returns
 * `emptyText`.
 */
export function formatProfileForPrompt(
  profile: ResolvedProfile | null,
  verbosity: "full" | "compact",
  emptyText = "(no preference data yet — student hasn't shared their profile)"
): string {
  if (!profile) return emptyText;
  const p = profile;
  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    if (present(value)) lines.push(`${label}: ${value}`);
  };

  const tests = testScores(p);
  const sizes = Array.isArray(p.sizes) ? p.sizes.join(verbosity === "full" ? ", " : "/") : p.sizes;
  const gradTypes =
    Array.isArray(p.gradSchoolTypes) && p.gradSchoolTypes.length > 0
      ? ` (${p.gradSchoolTypes.join(", ")})`
      : "";

  if (verbosity === "full") {
    push("State", p.state);
    if (present(p.gpa)) push("GPA", `${p.gpa}/4.0`);
    if (tests) lines.push(`Test scores: ${tests}`);
    push("Intended major", p.major);
    if (present(p.majorImportance)) lines.push(`Major ranking importance: ${p.majorImportance}/5`);
    push("Preferred teaching style", p.preferenceResearch);
    if (present(p.budget)) lines.push(`Annual budget: ${p.budget}`);
    if (typeof p.fafsa === "boolean") lines.push(`Applying for financial aid (FAFSA): ${p.fafsa ? "Yes" : "No"}`);
    push("Open to loans", p.loans);
    push("Preferred campus setting", p.setting);
    if (present(sizes)) lines.push(`Preferred school size(s): ${sizes}`);
    push("School type preference", p.schoolType);
    if (present(p.coopImportance)) lines.push(`Career services / co-op importance: ${p.coopImportance}/5`);
    if (present(p.careerCultureImportance)) lines.push(`Career culture importance: ${p.careerCultureImportance}/5`);
    push("Career culture description", p.careerCultureDescription);
    if (present(p.gradSchool)) lines.push(`Grad school plans: ${p.gradSchool}${gradTypes}`);
    push("Target careers/industries", p.careers);
    if (present(p.alumniNetworkImportance)) lines.push(`Alumni network importance: ${p.alumniNetworkImportance}/5`);
    if (present(p.campusDiversityImportance)) lines.push(`Campus diversity importance: ${p.campusDiversityImportance}/5`);
    if (present(p.campusLifeImportance)) lines.push(`Campus life importance: ${p.campusLifeImportance}/5`);
    push("Other priorities", p.otherPriorities);
  } else {
    if (present(p.gpa) || tests) {
      const parts = [present(p.gpa) ? `GPA: ${p.gpa}/4.0` : null, tests ? `Tests: ${tests}` : null].filter(Boolean);
      lines.push(parts.join(", "));
    }
    push("Intended major", p.major);
    push("Target careers", p.careers);
    if (present(p.gradSchool)) lines.push(`Grad school: ${p.gradSchool}${gradTypes}`);
    const prefParts = [
      present(p.setting) ? `${p.setting} setting` : null,
      present(sizes) ? `${sizes} school` : null,
      present(p.schoolType) ? `${p.schoolType} institution` : null,
    ].filter(Boolean);
    if (prefParts.length) lines.push(`Preferences: ${prefParts.join(", ")}`);
    const budgetParts = [
      present(p.budget) ? `Budget: ${p.budget}` : null,
      typeof p.fafsa === "boolean" ? `FAFSA: ${p.fafsa ? "Yes" : "No"}` : null,
      present(p.loans) ? `Loans: ${p.loans}` : null,
    ].filter(Boolean);
    if (budgetParts.length) lines.push(budgetParts.join(", "));
    const priorityParts = [
      present(p.majorImportance) ? `major ranking ${p.majorImportance}/5` : null,
      present(p.coopImportance) ? `career services ${p.coopImportance}/5` : null,
      present(p.alumniNetworkImportance) ? `alumni network ${p.alumniNetworkImportance}/5` : null,
    ].filter(Boolean);
    if (priorityParts.length) lines.push(`Key priorities: ${priorityParts.join(", ")}`);
    push("Other priorities", p.otherPriorities);
    push("Career culture", p.careerCultureDescription);
  }

  return lines.length > 0 ? lines.join("\n") : emptyText;
}
