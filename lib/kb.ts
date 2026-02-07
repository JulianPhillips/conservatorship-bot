import fs from "fs";
import path from "path";
import { embedBatch } from "./embeddings";

export type KbChunk = {
  id: string;
  file: string;
  text: string;
  embedding?: number[];
  heading?: string;
};

let KB_CHUNKS: KbChunk[] = [];
let KB_EMBEDDED = false;

export function loadKbOnce(): KbChunk[] {
  if (KB_CHUNKS.length) return KB_CHUNKS;

  const kbDir = path.join(process.cwd(), "kb");
  const files = fs.readdirSync(kbDir).filter((f) => f.endsWith(".md"));

  const chunks: KbChunk[] = [];

  for (const file of files) {
    const fullPath = path.join(kbDir, file);
    const content = fs.readFileSync(fullPath, "utf8");

    const parts = content
      .split(/\n(?=#{1,3}\s+)/) // split before headings
      .filter((p) => p.trim().length > 0);

    parts.forEach((part, idx) => {
      const trimmed = part.trim();
      const firstLine = trimmed.split("\n")[0] || "";
      const headingMatch = firstLine.match(/^#{1,3}\s+(.*)/);
      chunks.push({
        id: `${file}-${idx}`,
        file,
        text: trimmed,
        heading: headingMatch?.[1],
      });
    });
  }

  KB_CHUNKS = chunks;
  return KB_CHUNKS;
}

export async function ensureKbEmbeddings() {
  if (KB_EMBEDDED) return;

  const chunks = loadKbOnce();

  // Batch in groups to avoid huge payloads
  const batchSize = 32;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedBatch(batch.map((c) => c.text));
    embeddings.forEach((emb, idx) => {
      batch[idx].embedding = emb;
    });
  }

  KB_EMBEDDED = true;
}
