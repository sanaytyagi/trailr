import { z } from "zod";

export const shareEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export type ShareEmailInput = z.infer<typeof shareEmailSchema>;
