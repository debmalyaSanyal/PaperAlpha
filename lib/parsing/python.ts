import { findAlgorithms, findMetrics, findModels } from "@/lib/analysis/text";

export function analyzePythonCode(text: string, filename: string) {
  const imports = Array.from(text.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm))
    .map((match) => ({ value: match[1] || match[2], line: lineNumber(text, match.index || 0) }))
    .filter((item) => Boolean(item.value));
  const functions = Array.from(text.matchAll(/^\s*def\s+([a-zA-Z_]\w*)/gm)).map((match) => match[1]);
  const classes = Array.from(text.matchAll(/^\s*class\s+([a-zA-Z_]\w*)/gm)).map((match) => match[1]);
  const models = findModels(text);
  const metrics = Array.from(text.split(/\r?\n/)).flatMap((line, index) => findMetrics(line, filename, { line: index + 1, context: line.trim() }));
  const detectedModels = models.map((model) => ({
    label: "Model",
    value: model,
    trace: { sourceFile: filename, line: firstLineMatching(text, model), context: model },
  }));
  const datasetReferences = Array.from(text.matchAll(/(?:read_csv|read_excel|read_json|load_[-\w]+|Dataset|ImageFolder)\(([^)]*)\)/gi))
    .map((match) => match[1].replace(/['"`]/g, "").split(",")[0].trim())
    .filter(Boolean);
  const comments = Array.from(text.matchAll(/^\s*#\s*(.+)$/gm)).map((match) => match[1]);
  const featureEngineering = detectLines(text, filename, /fit_transform|StandardScaler|MinMaxScaler|OneHotEncoder|LabelEncoder|fillna|dropna|get_dummies|PCA|SelectKBest|feature/i, "Feature engineering");
  const trainingProcedures = detectLines(text, filename, /\.fit\(|train_test_split|epochs\s*=|batch_size\s*=|GridSearchCV|RandomizedSearchCV|cross_val_score/i, "Training procedure");
  const evaluation = detectLines(text, filename, /classification_report|confusion_matrix|accuracy_score|precision_score|recall_score|f1_score|mean_squared_error|roc_auc_score|evaluate|predict/i, "Evaluation");
  const hyperparameters = extractHyperparameters(text, filename);
  const configuration = extractConfiguration(text, filename);

  return {
    text,
    summary: `${filename} imports ${imports.slice(0, 8).map((item) => item.value).join(", ") || "no libraries detected"}, defines ${functions.length} functions and ${classes.length} classes, and references ${models.join(", ") || "no known model names"}.`,
    imports: imports.map((item) => item.value),
    importedLibraries: imports.map((item) => ({ label: "Imported library", value: item.value, trace: { sourceFile: filename, line: item.line } })),
    functions,
    classes,
    models,
    detectedModels,
    datasetReferences,
    comments,
    algorithms: findAlgorithms(text),
    metrics,
    featureEngineering,
    hyperparameters,
    configuration,
    trainingProcedures,
    evaluation,
  };
}

function extractHyperparameters(text: string, filename: string) {
  const items = [];
  for (const match of text.matchAll(/\b([A-Z][A-Za-z0-9_]*(?:Classifier|Regressor|CV|Search|Model|Network)?)\s*\(([^)]{3,300})\)/g)) {
    if (match[2].includes("=")) {
      items.push({
        label: "Hyperparameters",
        value: `${match[1]}(${match[2].replace(/\s+/g, " ").trim()})`,
        trace: { sourceFile: filename, line: lineNumber(text, match.index || 0), context: surroundingLine(text, match.index || 0) },
      });
    }
  }
  for (const match of text.matchAll(/\b(learning_rate|epochs|batch_size|max_depth|n_estimators|random_state|test_size|C|gamma|alpha)\s*=\s*([^,\n)]+)/g)) {
    items.push({
      label: "Hyperparameter",
      value: `${match[1]}=${match[2].trim()}`,
      trace: { sourceFile: filename, line: lineNumber(text, match.index || 0), context: surroundingLine(text, match.index || 0) },
    });
  }
  return items;
}

function extractConfiguration(text: string, filename: string) {
  return Array.from(text.matchAll(/\b(config|params|parameters|settings)\s*=\s*({[\s\S]*?}|\[[\s\S]*?]|[^\n]+)/gi)).slice(0, 8).map((match) => ({
    label: "Configuration",
    value: match[0].replace(/\s+/g, " ").slice(0, 240),
    trace: { sourceFile: filename, line: lineNumber(text, match.index || 0), context: surroundingLine(text, match.index || 0) },
  }));
}

function surroundingLine(text: string, index: number) {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? undefined : end).trim();
}

function lineNumber(text: string, index: number) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function firstLineMatching(text: string, value: string) {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => line.toLowerCase().includes(value.toLowerCase().replace(/\s/g, "")) || line.toLowerCase().includes(value.toLowerCase()));
  return index === -1 ? undefined : index + 1;
}

function detectLines(text: string, filename: string, pattern: RegExp, label: string) {
  return text.split(/\r?\n/).flatMap((line, index) =>
    pattern.test(line)
      ? [{ label, value: line.trim(), trace: { sourceFile: filename, line: index + 1, context: line.trim() } }]
      : [],
  );
}
