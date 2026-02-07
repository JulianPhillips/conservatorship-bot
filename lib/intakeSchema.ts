import { z } from "zod";

export const IntakeInputSchema = z.object({
  personName: z.string().min(1),
  personAge: z.number().int().min(0).max(120).nullable(),
  city: z.string().min(1),
  county: z.string().min(1),
  conditions: z.array(z.string()).default([]),
  relation: z.string().min(1),
  mainConcerns: z.array(z.string()).default([]),
  hasPOA: z.boolean().default(false),
  hasAlternativesTried: z.string().default(""),
  goals: z.string().default(""),
});

export type IntakeInputValidated = z.infer<typeof IntakeInputSchema>;
