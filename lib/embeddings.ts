const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL!;

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];

  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "ConservatorshipBot-Embeddings",
    },
    body: JSON.stringify({
      model: OPENROUTER_EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("OpenRouter embeddings error", res.status, text);
    throw new Error(`OpenRouter embeddings error: ${res.status}`);
  }

  const data = await res.json();
  return data.data.map((d: any) => d.embedding as number[]);
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
