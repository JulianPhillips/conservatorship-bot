import { cosineSim } from "@/lib/embeddings";

test("cosineSim returns 1 for identical vectors", () => {
  const a = [1, 2, 3];
  const b = [1, 2, 3];
  expect(cosineSim(a, b)).toBeCloseTo(1);
});

test("cosineSim returns value between -1 and 1", () => {
  const a = [1, 0];
  const b = [0, 1];
  const s = cosineSim(a, b);
  expect(s).toBeGreaterThanOrEqual(-1);
  expect(s).toBeLessThanOrEqual(1);
});
