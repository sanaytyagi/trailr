import { z } from "zod";

const partSchema = z.object({
  type: z.string().max(40),
  text: z.string().max(8000).optional(),
}).passthrough();

const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(partSchema).max(40),
}).passthrough();

export const assistantRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(50),
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
