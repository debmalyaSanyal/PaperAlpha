import { tokenize } from "@/lib/analysis/text";
import type { SimilarityMatch, SimilarityResult } from "@/types/paperalpha";

function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  a.forEach((value, key) => {
    dot += value * (b.get(key) || 0);
    aNorm += value * value;
  });
  b.forEach((value) => {
    bNorm += value * value;
  });
  if (!aNorm || !bNorm) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function vectorize(text: string) {
  const vector = new Map<string, number>();
  for (const token of tokenize(text)) {
    vector.set(token, (vector.get(token) || 0) + 1);
  }
  return vector;
}

export function analyzeSimilarity(text: string, sources: Array<{ title: string; text: string }>): SimilarityResult {
  const targetVector = vectorize(text);
  const matches: SimilarityMatch[] = sources
    .filter((source) => source.text.trim().length > 0)
    .map((source) => ({
      source: source.title,
      passage: source.text.replace(/\s+/g, " ").slice(0, 240),
      similarity: Math.round(cosine(targetVector, vectorize(source.text)) * 100),
    }))
    .filter((match) => match.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);

  const overall = matches.length ? Math.round(matches.reduce((sum, match) => sum + match.similarity, 0) / matches.length) : 0;
  return {
    overall,
    matches,
    explanation: "This is an automated similarity estimate based on local TF-style cosine overlap. It is not an official plagiarism certification.",
  };
}
