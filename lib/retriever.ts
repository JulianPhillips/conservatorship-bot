import { NormalizedIntake } from "@/app/api/intake/route";
import { loadKbOnce, KbChunk, ensureKbEmbeddings } from "./kb";
import { embedBatch, cosineSim } from "./embeddings";

function keywordScore(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (lower.includes(t.toLowerCase())) score += 1;
  }
  return score;
}

export async function retrieveKbChunksForIntake(
  intake: NormalizedIntake
): Promise<KbChunk[]> {
  await ensureKbEmbeddings();
  const all = loadKbOnce();

  // Filter by preferred files first (keeps scope local + relevant)
  const preferredFiles = [
    "01_glossary_conservatorship_tn.md",
    "01_venue_and_contacts_memphis_shelby.md",
    "02_before_you_file_and_alternatives_tn.md",
    "03_conservatorship_basics_and_process_memphis_tn.md",
    "03_roles_and_money_duties_conservator_tn.md",
    "04_checklist_and_steps_to_establish_conservatorship_tn.md",
    "04_four_basic_duties_fiduciary_tn.md",
    "05_protect_from_exploitation_scams_and_where_to_get_help_tn.md",
    "06_working_with_other_fiduciaries_and_professionals_tn.md",
    "07_advocacy_how_to_protect_yourself_hospitals_and_systems.md",
    "07_documenting_problems_and_medical_interactions_tn.md",
    "07_safety_and_legal_disclaimer_tn.md",
    "08_memphis_shelby_help_and_contacts.md",
    "09_before_you_submit_checklist_tn.md",
  ];

  const pool = all.filter((c) => preferredFiles.includes(c.file));

  // Build 2–3 simple queries from intake
  const queries: string[] = [];

  queries.push(
    "Memphis Shelby County Tennessee conservatorship process where to file and court info"
  );

  if (intake.concerns.includes("money")) {
    queries.push(
      "Tennessee conservator duties money property inventory accounting keep money separate"
    );
  }

  if (intake.concerns.includes("medical") || intake.concerns.includes("safety")) {
    queries.push(
      "Tennessee conservatorship health decisions capacity functional evaluation hospitals"
    );
  }

  queries.push(
    "Tennessee documentation recording one party consent build paper trail racism hospitals"
  );

  const queryEmbeddings = await embedBatch(queries);

  // Score each chunk by max similarity to any query
  const scored: { chunk: KbChunk; score: number }[] = [];

  const keywordTerms = [
    "inventory",
    "notice of hearing",
    "guardian ad litem",
    "annual accounting",
    "adult protective services",
    "one-party consent",
  ];

  for (const chunk of pool) {
    if (!chunk.embedding) continue;
    let maxScore = 0;
    for (const qEmb of queryEmbeddings) {
      const s = cosineSim(chunk.embedding, qEmb);
      if (s > maxScore) maxScore = s;
    }
    const kwScore = keywordScore(chunk.text, keywordTerms);
    const combined = maxScore + kwScore * 0.1;
    scored.push({ chunk, score: combined });
  }

  // Sort by score descending and take top N
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 40).map((s) => s.chunk);

  return top;
}
