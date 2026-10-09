import { findAlgorithms, findMetrics, findModels, sentenceSummary, titleCase } from "@/lib/analysis/text";
import type { DetectedItem, Figure, Metric, ResearchTable } from "@/types/paperalpha";

type NotebookCell = {
  cell_type?: string;
  source?: string[] | string;
  outputs?: Array<Record<string, unknown>>;
};

export function parseNotebook(raw: string, filename: string) {
  try {
    const notebook = JSON.parse(raw) as { cells?: NotebookCell[] };
    const cells = Array.isArray(notebook.cells) ? notebook.cells : [];
    const markdownCells: DetectedItem[] = [];
    const codeCells: DetectedItem[] = [];
    const importedLibraries: DetectedItem[] = [];
    const featureEngineering: DetectedItem[] = [];
    const hyperparameters: DetectedItem[] = [];
    const configuration: DetectedItem[] = [];
    const trainingProcedures: DetectedItem[] = [];
    const detectedModels: DetectedItem[] = [];
    const results: DetectedItem[] = [];
    const tables: ResearchTable[] = [];
    const figures: Figure[] = [];
    const metrics: Metric[] = [];
    const datasetReferences = new Set<string>();
    const preprocessing = new Set<string>();
    const conclusions: string[] = [];

    cells.forEach((cell, index) => {
      const cellNumber = index + 1;
      const source = sourceToString(cell.source);
      if (cell.cell_type === "markdown") {
        markdownCells.push({ label: "Markdown cell", value: sentenceSummary(source, 2) || source.slice(0, 160), trace: { sourceFile: filename, cell: cellNumber } });
        if (/conclusion|summary|finding|result/i.test(source)) conclusions.push(sentenceSummary(source, 2));
      }
      if (cell.cell_type === "code") {
        codeCells.push({ label: "Code cell", value: source.slice(0, 240), trace: { sourceFile: filename, cell: cellNumber } });
        extractImports(source).forEach((item) => importedLibraries.push({ label: "Imported library", value: item, trace: { sourceFile: filename, cell: cellNumber } }));
        extractDatasetReferences(source).forEach((item) => datasetReferences.add(item));
        findAlgorithms(source).forEach((item) => preprocessing.add(item));
        extractCueItems(source, filename, cellNumber, /(?:fit_transform|transform|StandardScaler|MinMaxScaler|OneHotEncoder|LabelEncoder|fillna|dropna|get_dummies|train_test_split|PCA|feature_selection)/gi, "Preprocessing or feature engineering").forEach((item) => featureEngineering.push(item));
        extractCueItems(source, filename, cellNumber, /(?:\.fit\(|train_test_split|epochs\s*=|batch_size\s*=|optimizer\s*=|GridSearchCV|RandomizedSearchCV|cross_val_score)/gi, "Training procedure").forEach((item) => trainingProcedures.push(item));
        extractHyperparameters(source, filename, cellNumber).forEach((item) => hyperparameters.push(item));
        extractConfiguration(source, filename, cellNumber).forEach((item) => configuration.push(item));
        findModels(source).forEach((model) => detectedModels.push({ label: "Model", value: model, trace: { sourceFile: filename, cell: cellNumber } }));
        findMetrics(source, filename, { cell: cellNumber, context: source.slice(0, 180) }).forEach((metric) => metrics.push(metric));
      }
      const outputText = extractOutputText(cell.outputs || []);
      if (outputText) {
        findMetrics(outputText, filename, { cell: cellNumber, context: outputText.slice(0, 180) }).forEach((metric) => metrics.push(metric));
        extractResultLines(outputText).forEach((value) => results.push({ label: "Output result", value, trace: { sourceFile: filename, cell: cellNumber } }));
        if (looksLikeTable(outputText)) {
          tables.push(textTable(outputText, filename, cellNumber, tables.length + 1));
        }
      }
      countImageOutputs(cell.outputs || []).forEach((mime, figureIndex) => {
        figures.push({
          id: `figure-${filename.replace(/\W+/g, "-")}-${cellNumber}-${figureIndex + 1}`,
          title: `${titleCase(mime.split("/").at(-1) || "figure")} output`,
          caption: `Figure output detected in ${filename}, cell ${cellNumber}.`,
          sourceFile: filename,
        });
      });
    });

    const markdown = markdownCells.map((item) => item.value).join("\n\n");
    const code = codeCells.map((item) => item.value).join("\n\n");
    const combined = `${markdown}\n${code}`;
    return {
      text: combined,
      summary: `${filename} includes ${cells.length} cells, ${codeCells.length} code cells, ${markdownCells.length} markdown cells, ${metrics.length} detected metrics, and ${figures.length} figure outputs.`,
      markdownCells,
      codeCells,
      importedLibraries,
      featureEngineering,
      hyperparameters,
      configuration,
      trainingProcedures,
      detectedModels,
      datasetReferences: Array.from(datasetReferences),
      preprocessing: Array.from(preprocessing),
      models: Array.from(new Set(detectedModels.map((item) => item.value))),
      metrics,
      results,
      tables,
      figures,
      conclusions: conclusions.filter(Boolean),
      warnings: cells.length === 0 ? ["No notebook cells were found."] : [],
    };
  } catch {
    return {
      text: "",
      summary: "Invalid notebook JSON.",
      markdownCells: [],
      codeCells: [],
      importedLibraries: [],
      featureEngineering: [],
      hyperparameters: [],
      configuration: [],
      trainingProcedures: [],
      detectedModels: [],
      datasetReferences: [],
      preprocessing: [],
      models: [],
      metrics: [],
      results: [],
      tables: [],
      figures: [],
      conclusions: [],
      warnings: ["The notebook could not be parsed as valid .ipynb JSON."],
    };
  }
}

function extractHyperparameters(code: string, sourceFile: string, cell: number): DetectedItem[] {
  const items: DetectedItem[] = [];
  const constructorPattern = /\b([A-Z][A-Za-z0-9_]*(?:Classifier|Regressor|CV|Search|Model|Network)?)\s*\(([^)]{3,300})\)/g;
  for (const match of code.matchAll(constructorPattern)) {
    if (match[2].includes("=")) {
      items.push({
        label: "Hyperparameters",
        value: `${match[1]}(${match[2].replace(/\s+/g, " ").trim()})`,
        trace: { sourceFile, cell, context: surroundingLine(code, match.index || 0) },
      });
    }
  }
  for (const match of code.matchAll(/\b(learning_rate|epochs|batch_size|max_depth|n_estimators|random_state|test_size|C|gamma|alpha)\s*=\s*([^,\n)]+)/g)) {
    items.push({
      label: "Hyperparameter",
      value: `${match[1]}=${match[2].trim()}`,
      trace: { sourceFile, cell, context: surroundingLine(code, match.index || 0) },
    });
  }
  return items;
}

function extractConfiguration(code: string, sourceFile: string, cell: number): DetectedItem[] {
  return Array.from(code.matchAll(/\b(config|params|parameters|settings)\s*=\s*({[\s\S]*?}|\[[\s\S]*?]|[^\n]+)/gi)).slice(0, 8).map((match) => ({
    label: "Configuration",
    value: match[0].replace(/\s+/g, " ").slice(0, 240),
    trace: { sourceFile, cell, context: surroundingLine(code, match.index || 0) },
  }));
}

function sourceToString(source: string[] | string | undefined) {
  return Array.isArray(source) ? source.join("") : source || "";
}

function extractImports(code: string) {
  return Array.from(code.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+)(?:\s+as\s+\w+)?)/gm))
    .map((match) => match[1] || match[2])
    .filter(Boolean);
}

function extractDatasetReferences(code: string) {
  return Array.from(code.matchAll(/(?:read_csv|read_excel|read_json|load_[-\w]+|Dataset|ImageFolder)\(([^)]*)\)/gi))
    .map((match) => match[1].replace(/['"`]/g, "").split(",")[0].trim())
    .filter(Boolean);
}

function extractCueItems(code: string, sourceFile: string, cell: number, pattern: RegExp, label: string): DetectedItem[] {
  return Array.from(code.matchAll(pattern)).map((match) => ({
    label,
    value: match[0],
    trace: { sourceFile, cell, context: surroundingLine(code, match.index || 0) },
  }));
}

function surroundingLine(text: string, index: number) {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? undefined : end).trim();
}

function extractOutputText(outputs: Array<Record<string, unknown>>) {
  return outputs.flatMap((output) => {
    const text = output.text;
    const data = output.data as Record<string, unknown> | undefined;
    const plain = data?.["text/plain"];
    return [text, plain].flat().filter((item): item is string => typeof item === "string");
  }).join("\n");
}

function extractResultLines(text: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) =>
    /(accuracy|precision|recall|f1|loss|score|auc|mae|mse|rmse|result|best)/i.test(line) && /\d/.test(line),
  ).slice(0, 20);
}

function countImageOutputs(outputs: Array<Record<string, unknown>>) {
  return outputs.flatMap((output) => Object.keys((output.data as Record<string, unknown> | undefined) || {}).filter((key) => key.startsWith("image/")));
}

function looksLikeTable(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  return lines.length > 1 && lines.some((line) => /\s{2,}|\|/.test(line));
}

function textTable(text: string, filename: string, cell: number, index: number): ResearchTable {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 8);
  return {
    id: `notebook-table-${index}`,
    title: `Notebook Table ${index}`,
    caption: `Table-like output detected in ${filename}, cell ${cell}.`,
    columns: ["Output"],
    rows: lines.map((line) => [line]),
    sourceFile: filename,
    trace: { sourceFile: filename, cell },
  };
}
