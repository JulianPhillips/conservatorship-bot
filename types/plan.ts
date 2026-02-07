export type ConservatorshipPlan = {
  summary: string;
  buckets: {
    where_you_file: string[];
    before_you_file: string[];
    info_to_gather: string[];
    filing_requirements: string[];
    hearing_and_decision: string[];
    duties_after: string[];
    documentation_and_recording: string[];
    memphis_shelby_help: string[];
    safety_and_disclaimer: string[];
  };
  checklist_items: string[];
  todo: string[];
  petition_sections: {
    intro: string;
    facts: string;
    requested_powers: string;
    less_restrictive_explained: string;
  };
};
