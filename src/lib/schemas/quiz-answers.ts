import { z } from "zod";

export const quizAnswersSchema = z.object({
  state: z.string().trim().max(100, "State must be 100 characters or fewer"),
  gpa: z.number().min(0, "GPA can't be negative").max(5, "GPA must be 5.0 or below"),
  testTypes: z.array(z.enum(["SAT", "ACT"])).max(2, "Select at most 2 test types"),
  satScore: z.number().int().min(400, "SAT score must be at least 400").max(1600, "SAT score must be at most 1600").nullable(),
  actScore: z.number().int().min(1, "ACT score must be at least 1").max(36, "ACT score must be at most 36").nullable(),
  major: z.string().trim().max(200, "Major must be 200 characters or fewer"),
  majorImportance: z.number().int().min(1, "Rate this between 1 and 5").max(5, "Rate this between 1 and 5"),
  preferenceResearch: z.enum(["Research-focused", "Teaching-focused"]),
  budget: z.string().trim().max(100, "Budget must be 100 characters or fewer"),
  fafsa: z.boolean(),
  loans: z.enum(["Yes", "No", "Prefer to minimize"]),
  setting: z.enum(["Urban", "Suburban", "Rural"]),
  sizes: z.array(z.enum(["Small", "Medium", "Large"])).max(3, "Select at most 3 sizes"),
  schoolType: z.enum(["Public", "Private", "No preference"]),
  coopImportance: z.number().int().min(1, "Rate this between 1 and 5").max(5, "Rate this between 1 and 5"),
  careerCultureImportance: z.number().int().min(1, "Rate this between 1 and 5").max(5, "Rate this between 1 and 5"),
  careerCultureDescription: z.string().max(2000, "Please keep this under 2000 characters"),
  gradSchool: z.enum(["Yes", "Maybe", "No"]),
  gradSchoolTypes: z.array(z.string().max(100, "Each entry must be 100 characters or fewer")).max(10, "Select at most 10 grad school types"),
  careers: z.string().max(2000, "Please keep this under 2000 characters"),
  alumniNetworkImportance: z.number().int().min(1, "Rate this between 1 and 5").max(5, "Rate this between 1 and 5"),
  campusDiversityImportance: z.number().int().min(1, "Rate this between 1 and 5").max(5, "Rate this between 1 and 5"),
  campusLifeImportance: z.number().int().min(1, "Rate this between 1 and 5").max(5, "Rate this between 1 and 5"),
  otherPriorities: z.string().max(2000, "Please keep this under 2000 characters"),
});

export const generateListRequestSchema = z.object({
  answers: quizAnswersSchema,
});

export type QuizAnswers = z.infer<typeof quizAnswersSchema>;

// Tiny required core captured at registration (onboarding 3-field step).
// Field names MUST be a strict subset of quizAnswersSchema so the resolver's
// { ...core_profile, ...quiz_answers } merge stays key-aligned (see
// src/lib/assistant/profile.ts). state/gpa/major are the three high-signal fields
// that make the AI feel personalized without a 24-question wall at signup.
export const coreProfileSchema = z.object({
  state: z.string().trim().min(1, "Please select your state").max(100),
  gpa: z.number().min(0, "Please enter your GPA").max(5, "GPA must be 5.0 or below"),
  major: z.string().trim().min(1, "Please tell us what you want to study").max(200),
});

export type CoreProfile = z.infer<typeof coreProfileSchema>;
