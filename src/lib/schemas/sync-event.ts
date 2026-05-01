import { z } from "zod";

export const syncEventSchema = z.object({
  college_id: z.string().uuid(),
  college_name: z.string().trim().min(1).max(200),
  deadline: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/),
    z.null(),
  ]),
});

export type SyncEventInput = z.infer<typeof syncEventSchema>;
