import type { Metric } from "@/types/paperalpha";

const MODEL_TERMS = [
  "random forest",
  "randomforest",
  "logistic regression",
  "support vector",
  "svm",
  "xgboost",
  "lightgbm",
  "cnn",
  "lstm",
  "transformer",
  "bert",
  "decision tree",
  "k-means",
  "linear regression",
  "neural network",
];

const ALGORITHM_TERMS = [
  "normalization",
  "standardization",
  "train_test_split",
  "cross validation",
  "grid search",
  "pca",
  "feature selection",
  "tokenization",
  "augmentation",
  "imputation",
];

const METRIC_PATTERN =
  /\b(accuracy|precision|recall|f1(?:-score)?|mae|mse|rmse|r2|r²|roc-auc|auc|map|silhouette score)\b\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?%?)/gi;

export function splitList(input: string) {
  return input
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function sentenceSummary(text: string, max = 2) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max)
    .join(" ");
}

export function findTerms(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term));
}

export function findModels(text: string) {
  return findTerms(text, MODEL_TERMS).map((term) => {
    if (term.toUpperCase() === "SVM") return "SVM";
    if (term === "randomforest") return "Random Forest";
    return titleCase(term);
  });
}

export function findAlgorithms(text: string) {
  return findTerms(text, ALGORITHM_TERMS).map(titleCase);
}

export function findMetrics(text: string, sourceFile: string, location?: { cell?: number; line?: number; context?: string }): Metric[] {
  const metrics: Metric[] = [];
  for (const match of text.matchAll(METRIC_PATTERN)) {
    metrics.push({
      name: titleCase(match[1].replace("r²", "R2")),
      value: match[2],
      sourceFile,
      cell: location?.cell,
      line: location?.line,
      context: location?.context,
    });
  }
  return metrics;
}

export function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}
