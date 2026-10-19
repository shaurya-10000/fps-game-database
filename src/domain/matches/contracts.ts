import { z } from "zod";

export const matchAcceptanceResponseSchema = z.object({
  matchId: z.string().min(1),
  status: z.literal("completed"),
  accepted: z.boolean(),
}).strict(); // Strict prevents unexpected fields from sneaking in
