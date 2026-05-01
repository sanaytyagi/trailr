import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(200),
  full_name: z.string().trim().min(1).max(120).optional(),
});

export const resetSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().url().max(500).optional(),
});

export type SigninInput = z.infer<typeof signinSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
