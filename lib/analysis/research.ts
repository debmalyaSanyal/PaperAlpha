import { analyzeCsv } from "@/lib/analysis/csv";
import { analyzeXlsx } from "@/lib/analysis/xlsx";
import { findAlgorithms, findMetrics, findModels, sentenceSummary, splitList } from "@/lib/analysis/text";
import { getExtension, validateResearchFile } from "@/lib/parsing/file-validation";
import { parseNotebook } from "@/lib/parsing/notebook";
import { analyzePythonCode } from "@/lib/parsing/python";
import type { DatasetAnalysis, DetectedItem, Figure, Metric, ResearchAnalysis, ResearchBasics, ResearchMaterial, ResearchTable } from "@/types/paperalpha";

async function readText(file: File) {
  return (await readBuffer(file)).toString("utf8").replace(/\0/g, "");
}

async function readBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

function fileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`.replace(/[^\w.-]+/g, "-");
}

export async function analyzeResearchFiles(files: File[], basics: ResearchBasics): Promise<ResearchAnalysis> {
  const materials: ResearchMaterial[] = [];
  const tables: ResearchTable[] = [];
  const figures: Figure[] = [];
  const metrics: Metric[] = [];
  const datasetAnalyses: DatasetAnalysis[] = [];
  const importedLibraries: DetectedItem[] = [];
  const featureEngineering: DetectedItem[] = [];
  const hyperparameters: DetectedItem[] = [];
  const configuration: DetectedItem[] = [];
  const detectedModels: DetectedItem[] = [];
  const trainingProcedures: DetectedItem[] = [];
  const results: DetectedItem[] = [];
  const potentialIssues: DetectedItem[] = [];
  const conclusions: string[] = [];
  const models = new Set<string>();
  const algorithms = new Set<string>();
  const datasets = new Set<string>();
  const warnings: string[] = [];

  for (const file of files) {
    const validation = validateResearchFile(file);
    const extension = getExtension(file.name);
    if (!validation.valid) {
      materials.push({
        id: fileId(file),
        filename: file.name,
        fileType: extension,
        size: file.size,
        status: "unsupported",
        warnings: [validation.reason],
      });
      warnings.push(`${file.name}: ${validation.reason}`);
      continue;
    }

    let extractedText = "";
    let summary = "";
    const materialWarnings: string[] = [];

    if (extension === ".ipynb") {
      const result = parseNotebook(await readText(file), file.name);
      extractedText = result.text;
      summary = result.summary;
      result.models.forEach((model) => models.add(model));
      result.preprocessing.forEach((item) => algorithms.add(item));
      result.metrics.forEach((metric) => metrics.push(metric));
      result.importedLibraries.forEach((item) => importedLibraries.push(item));
      result.featureEngineering.forEach((item) => featureEngineering.push(item));
      result.hyperparameters.forEach((item) => hyperparameters.push(item));
      result.configuration.forEach((item) => configuration.push(item));
      result.trainingProcedures.forEach((item) => trainingProcedures.push(item));
      result.detectedModels.forEach((item) => detectedModels.push(item));
      result.datasetReferences.forEach((item) => datasets.add(item));
      result.results.forEach((item) => results.push(item));
      result.tables.forEach((table) => tables.push(table));
      result.figures.forEach((figure) => figures.push(figure));
      conclusions.push(...result.conclusions);
      materialWarnings.push(...result.warnings);
    } else if (extension === ".py") {
      const result = analyzePythonCode(await readText(file), file.name);
      extractedText = result.text;
      summary = result.summary;
      result.models.forEach((model) => models.add(model));
      result.algorithms.forEach((algorithm) => algorithms.add(algorithm));
      result.metrics.forEach((metric) => metrics.push(metric));
      result.importedLibraries.forEach((item) => importedLibraries.push(item));
      result.featureEngineering.forEach((item) => featureEngineering.push(item));
      result.hyperparameters.forEach((item) => hyperparameters.push(item));
      result.configuration.forEach((item) => configuration.push(item));
      result.trainingProcedures.forEach((item) => trainingProcedures.push(item));
      result.evaluation.forEach((item) => results.push(item));
      result.detectedModels.forEach((item) => detectedModels.push(item));
      result.datasetReferences.forEach((item) => datasets.add(item));
    } else if (extension === ".csv") {
      extractedText = await readText(file);
      const result = analyzeCsv(extractedText, file.name);
      summary = result.summary;
      if (result.table) tables.push(result.table);
      if (result.datasetAnalysis) datasetAnalyses.push(result.datasetAnalysis);
      datasets.add(file.name);
      materialWarnings.push(...result.warnings);
    } else if (extension === ".xlsx") {
      const result = analyzeXlsx(await readBuffer(file), file.name);
      summary = result.summary;
      if (result.table) tables.push(result.table);
      if (result.datasetAnalysis) datasetAnalyses.push(result.datasetAnalysis);
      datasets.add(file.name);
      materialWarnings.push(...result.warnings);
    } else if ([".txt", ".md", ".json"].includes(extension)) {
      extractedText = await readText(file);
      summary = sentenceSummary(extractedText, 3) || `${file.name} was read but no summary text could be extracted.`;
      findModels(extractedText).forEach((model) => models.add(model));
      findAlgorithms(extractedText).forEach((algorithm) => algorithms.add(algorithm));
      findMetrics(extractedText, file.name).forEach((metric) => metrics.push(metric));
      if (/limitation|missing|insufficient|future work/i.test(extractedText)) {
        potentialIssues.push({ label: "Potential issue", value: sentenceSummary(extractedText, 1), trace: { sourceFile: file.name } });
      }
    } else if ([".png", ".jpg", ".jpeg"].includes(extension)) {
      summary = `${file.name} is registered as a figure/image asset. Browser-side previews can be used as supporting material.`;
      figures.push({
        id: `figure-${figures.length + 1}`,
        title: file.name,
        caption: `Image supplied by the researcher: ${file.name}.`,
        sourceFile: file.name,
      });
    } else {
      summary = `${file.name} is accepted for metadata tracking. Full text extraction for ${extension} is a documented future adapter in this zero-budget MVP.`;
      materialWarnings.push(`Deep extraction for ${extension} is not available in the TypeScript-only MVP.`);
    }

    materials.push({
      id: fileId(file),
      filename: file.name,
      fileType: extension,
      size: file.size,
      status: "processed",
      summary,
      extractedText,
      warnings: materialWarnings,
    });
  }

  const combinedText = materials.map((material) => material.extractedText || material.summary || "").join("\n");
  findModels(combinedText).forEach((model) => models.add(model));
  findAlgorithms(combinedText).forEach((algorithm) => algorithms.add(algorithm));

  return {
    title: basics.title || "[Information not provided]",
    domain: basics.domain || "[Information not provided]",
    problem: basics.problem || "[Information not provided]",
    objectives: splitList(basics.objectives),
    researchQuestions: splitList(basics.questions),
    hypothesis: basics.hypothesis || undefined,
    keywords: splitList(basics.keywords),
    datasets: Array.from(datasets),
    datasetAnalyses,
    importedLibraries,
    preprocessing: Array.from(algorithms).filter((item) => /normal|standard|split|feature|imputation|token/i.test(item)),
    featureEngineering,
    hyperparameters,
    configuration,
    algorithms: Array.from(algorithms),
    models: Array.from(models),
    detectedModels: detectedModels.length ? detectedModels : Array.from(models).map((model) => ({ label: "Model", value: model, trace: { sourceFile: "combined analysis" } })),
    trainingProcedures,
    experiments: metrics.length
      ? [{ name: "Detected Experiment Results", models: Array.from(models), metrics, sourceFile: metrics[0]?.sourceFile || "uploaded material" }]
      : [],
    metrics,
    results,
    figures,
    tables,
    potentialIssues,
    limitations: [],
    conclusions: [...(basics.summary ? [basics.summary] : []), ...conclusions].filter(Boolean),
    references: [],
    sourceFiles: materials,
    warnings,
  };
}

export function buildDemoAnalysis(): ResearchAnalysis {
  const basics = {
    title: "Machine Learning Based Diabetes Prediction",
    topic: "Diabetes prediction using clinical diagnostic features",
    problem: "Early diabetes risk screening needs interpretable models that can work with tabular health indicators.",
    objectives: "Compare machine learning classifiers\nIdentify important clinical features\nReport transparent evaluation metrics",
    questions: "Which model performs best for diabetes prediction?\nWhich dataset features contribute to the prediction?",
    hypothesis: "Tree-based classifiers can provide strong predictive performance on tabular diabetes data.",
    keywords: "diabetes prediction, machine learning, random forest, healthcare analytics",
    domain: "Healthcare AI",
    summary: "The demo project compares Logistic Regression, Random Forest, and SVM on a diabetes dataset using accuracy, precision, recall, and F1-score.",
  };

  return {
    title: basics.title,
    domain: basics.domain,
    problem: basics.problem,
    objectives: splitList(basics.objectives),
    researchQuestions: splitList(basics.questions),
    hypothesis: basics.hypothesis,
    keywords: splitList(basics.keywords),
    datasets: ["diabetes_demo.csv"],
    datasetAnalyses: [
      {
        filename: "diabetes_demo.csv",
        rows: 768,
        columns: 9,
        columnAnalyses: [
          { name: "Glucose", type: "numeric", missing: 0, unique: 136, mean: 120.9, min: 0, max: 199 },
          { name: "BMI", type: "numeric", missing: 0, unique: 248, mean: 32, min: 0, max: 67.1 },
          { name: "Outcome", type: "categorical", missing: 0, unique: 2, topValues: [{ value: "0", count: 500 }, { value: "1", count: 268 }] },
        ],
        classBalance: [{ label: "0", count: 500, percentage: 65.1 }, { label: "1", count: 268, percentage: 34.9 }],
        trace: { sourceFile: "diabetes_demo.csv" },
      },
    ],
    importedLibraries: [{ label: "Imported library", value: "sklearn", trace: { sourceFile: "demo-notebook.ipynb", cell: 3 } }],
    preprocessing: ["Missing value review", "Feature scaling", "Train-test split"],
    featureEngineering: [{ label: "Feature engineering", value: "Feature scaling", trace: { sourceFile: "demo-notebook.ipynb", cell: 6 } }],
    hyperparameters: [{ label: "Hyperparameter", value: "n_estimators=100", trace: { sourceFile: "demo-notebook.ipynb", cell: 8 } }],
    configuration: [{ label: "Configuration", value: "test_size=0.2, random_state=42", trace: { sourceFile: "demo-notebook.ipynb", cell: 7 } }],
    algorithms: ["Logistic Regression", "Random Forest", "SVM"],
    models: ["Logistic Regression", "Random Forest", "SVM"],
    detectedModels: ["Logistic Regression", "Random Forest", "SVM"].map((model) => ({ label: "Model", value: model, trace: { sourceFile: "demo-notebook.ipynb", cell: 8 } })),
    trainingProcedures: [{ label: "Training procedure", value: "train_test_split and classifier.fit", trace: { sourceFile: "demo-notebook.ipynb", cell: 7 } }],
    metrics: [
      { name: "Accuracy", value: "0.86", sourceFile: "demo-results.md" },
      { name: "Precision", value: "0.84", sourceFile: "demo-results.md" },
      { name: "Recall", value: "0.82", sourceFile: "demo-results.md" },
      { name: "F1-score", value: "0.83", sourceFile: "demo-results.md" },
    ],
    results: [{ label: "Detected result", value: "Random Forest Accuracy: 0.86", trace: { sourceFile: "demo-results.md", cell: 12 } }],
    experiments: [
      {
        name: "Classifier comparison",
        models: ["Logistic Regression", "Random Forest", "SVM"],
        metrics: [
          { name: "Random Forest Accuracy", value: "0.86", sourceFile: "demo-results.md" },
          { name: "SVM Accuracy", value: "0.82", sourceFile: "demo-results.md" },
          { name: "Logistic Regression Accuracy", value: "0.79", sourceFile: "demo-results.md" },
        ],
        sourceFile: "demo-results.md",
      },
    ],
    potentialIssues: [{ label: "Demo limitation", value: "Demo data is illustrative and requires real validation before publication.", trace: { sourceFile: "demo-results.md" } }],
    figures: [
      { id: "fig-1", title: "Model Accuracy Comparison", caption: "Accuracy comparison generated from demo metrics.", sourceFile: "demo-results.md" },
    ],
    tables: [
      {
        id: "table-1",
        title: "Model Comparison",
        caption: "Demo metrics supplied with the sample project.",
        columns: ["Model", "Accuracy", "Precision", "Recall", "F1"],
        rows: [
          ["Random Forest", "0.86", "0.84", "0.82", "0.83"],
          ["SVM", "0.82", "0.80", "0.78", "0.79"],
          ["Logistic Regression", "0.79", "0.77", "0.75", "0.76"],
        ],
        sourceFile: "demo-results.md",
      },
    ],
    limitations: ["Demo data is illustrative and should not be presented as a real clinical validation study."],
    conclusions: ["Random Forest has the strongest supplied demo metrics, but clinical deployment would require external validation."],
    references: [],
    sourceFiles: [
      {
        id: "demo",
        filename: "diabetes_demo.csv",
        fileType: ".csv",
        size: 4096,
        status: "processed",
        summary: "Demo dataset with glucose, BMI, age, insulin, and outcome fields.",
        extractedText: basics.summary,
        warnings: [],
      },
    ],
    warnings: ["Demo mode uses supplied sample data. It is not a claim about a real unpublished experiment."],
  };
}
