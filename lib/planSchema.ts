import { z } from "zod";

export const ConservatorshipPlanSchema = z.object({
  summary: z.string(),
  buckets: z.object({
    where_you_file: z.array(z.string()),
    before_you_file: z.array(z.string()),
    info_to_gather: z.array(z.string()),
    filing_requirements: z.array(z.string()),
    hearing_and_decision: z.array(z.string()),
    duties_after: z.array(z.string()),
    documentation_and_recording: z.array(z.string()),
    memphis_shelby_help: z.array(z.string()),
    safety_and_disclaimer: z.array(z.string()),
  }),
  checklist_items: z.array(z.string()),
  todo: z.array(z.string()),
  petition_sections: z.object({
    intro: z.string(),
    facts: z.string(),
    requested_powers: z.string(),
    less_restrictive_explained: z.string(),
  }),
});

export type ConservatorshipPlanValidated = z.infer<
  typeof ConservatorshipPlanSchema
>;
