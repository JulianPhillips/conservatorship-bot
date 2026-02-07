import { ConservatorshipPlanSchema } from "@/lib/planSchema";

test("ConservatorshipPlanSchema validates a minimal valid plan", () => {
  const sample = {
    summary: "test",
    buckets: {
      where_you_file: [],
      before_you_file: [],
      info_to_gather: [],
      filing_requirements: [],
      hearing_and_decision: [],
      duties_after: [],
      documentation_and_recording: [],
      memphis_shelby_help: [],
      safety_and_disclaimer: [],
    },
    checklist_items: [],
    todo: [],
    petition_sections: {
      intro: "a",
      facts: "b",
      requested_powers: "c",
      less_restrictive_explained: "d",
    },
  };

  const result = ConservatorshipPlanSchema.safeParse(sample);
  expect(result.success).toBe(true);
});
