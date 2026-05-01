import { z } from "zod";

export const quizAnswersSchema = z.object({
  state: z.string().trim().max(100),
  gpa: z.number().min(0).max(5),
  testTypes: z.array(z.enum(["SAT", "ACT"])).max(2),
  satScore: z.number().int().min(400).max(1600).nullable(),
  actScore: z.number().int().min(1).max(36).nullable(),
  major: z.string().trim().max(200),
  majorImportance: z.number().int().min(1).max(5),
  preferenceResearch: z.enum(["Research-focused", "Teaching-focused"]),
  budget: z.string().trim().max(100),
  fafsa: z.boolean(),
  loans: z.enum(["Yes", "No", "Prefer to minimize"]),
  setting: z.enum(["Urban", "Suburban", "Rural"]),
  sizes: z.array(z.enum(["Small", "Medium", "Large"])).max(3),
  schoolType: z.enum(["Public", "Private", "No preference"]),
  coopImportance: z.number().int().min(1).max(5),
  careerCultureImportance: z.number().int().min(1).max(5),
  careerCultureDescription: z.string().max(2000),
  gradSchool: z.enum(["Yes", "Maybe", "No"]),
  gradSchoolTypes: z.array(z.string().max(100)).max(10),
  careers: z.string().max(2000),
  alumniNetworkImportance: z.number().int().min(1).max(5),
  campusDiversityImportance: z.number().int().min(1).max(5),
  campusLifeImportance: z.number().int().min(1).max(5),
  otherPriorities: z.string().max(2000),
});

export const generateListRequestSchema = z.object({
  answers: quizAnswersSchema,
});

export type QuizAnswers = z.infer<typeof quizAnswersSchema>;
