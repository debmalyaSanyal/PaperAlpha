import { describe, expect, it } from "vitest";

import { PRESET_NAMES, resolveProjectFormat } from "@/lib/formats/registry";
import { analyzeCsv } from "@/lib/analysis/csv";
import { buildCitations } from "@/lib/citations/manager";
import { buildDocumentXml, createDocx } from "@/lib/export/docx";
import { CrossrefProvider, OpenAlexProvider } from "@/lib/literature/providers";
import { parseNotebook } from "@/lib/parsing/notebook";
import { analyzePythonCode } from "@/lib/parsing/python";
import { validateResearchFile } from "@/lib/parsing/file-validation";
import { analyzeSimilarity } from "@/lib/similarity/engine";
import { buildQualityReport } from "@/lib/validation/quality";
import { countWords } from "@/lib/utils";
import type { GeneratedPaper } from "@/types/paperalpha";

describe("Utils", () => {
  it("countWords calculates words properly", () => {
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords("Hello world from unit test")).toBe(5);
    expect(countWords("Multiple   spaces    and\nnewlines")).toBe(4);
  });
});

describe("PaperAlpha MVP utilities", () => {
  it("validates supported files and rejects oversized files", () => {
    expect(validateResearchFile({ name: "analysis.ipynb", size: 100 }).valid).toBe(true);
    expect(validateResearchFile({ name: "malware.exe", size: 100 }).valid).toBe(false);
    expect(validateResearchFile({ name: "huge.csv", size: 20 * 1024 * 1024 }).valid).toBe(false);
  });

  it("analyzes CSV shape and missing values", () => {
    const result = analyzeCsv("age,bmi,outcome\n44,26.1,1\n52,,0", "demo.csv");
    expect(result.summary).toContain("2 rows");
    expect(result.table?.rows[0]).toEqual(["Rows", "2"]);
    expect(result.table?.rows[4][1]).toContain("bmi: 1");
    expect(result.datasetAnalysis?.columnAnalyses.find((column) => column.name === "age")?.type).toBe("numeric");
    expect(result.datasetAnalysis?.classBalance?.[0].percentage).toBe(50);
  });

  it("parses notebook markdown, code, models, and metrics", () => {
    const result = parseNotebook(JSON.stringify({
      cells: [
        { cell_type: "markdown", source: ["# Diabetes prediction"] },
        { cell_type: "code", source: ["params = {'max_depth': 5}\nmodel = RandomForestClassifier(n_estimators=100, max_depth=5)\naccuracy = 0.86"], outputs: [{}] },
      ],
    }), "demo.ipynb");
    expect(result.summary).toContain("2 cells");
    expect(result.models).toContain("Random Forest");
    expect(result.metrics[0].name).toBe("Accuracy");
    expect(result.metrics[0].cell).toBe(2);
    expect(result.detectedModels[0].trace.cell).toBe(2);
    expect(result.hyperparameters.some((item) => item.value.includes("n_estimators=100"))).toBe(true);
    expect(result.configuration[0].value).toContain("params");
  });

  it("statically analyzes Python code without execution", () => {
    const result = analyzePythonCode("import pandas as pd\nfrom sklearn.ensemble import RandomForestClassifier\n# train model\nconfig = {'test_size': 0.2}\ndf = pd.read_csv('data.csv')\nmodel = RandomForestClassifier(max_depth=5)\nmodel.fit(X_train, y_train)\nprint('accuracy = 94.21%')", "train.py");
    expect(result.imports).toContain("pandas");
    expect(result.datasetReferences).toContain("data.csv");
    expect(result.detectedModels[0].value).toBe("Random Forest");
    expect(result.trainingProcedures.length).toBeGreaterThan(0);
    expect(result.metrics[0].value).toBe("94.21%");
    expect(result.hyperparameters[0].value).toContain("max_depth=5");
    expect(result.configuration[0].value).toContain("config");
  });

  it("exposes full literature provider contracts", () => {
    const openAlex: Required<Pick<OpenAlexProvider, "search" | "getPaper" | "getReferences">> = new OpenAlexProvider();
    const crossref: Required<Pick<CrossrefProvider, "search" | "getPaper" | "getReferences">> = new CrossrefProvider();
    expect(typeof openAlex.search).toBe("function");
    expect(typeof openAlex.getPaper).toBe("function");
    expect(typeof openAlex.getReferences).toBe("function");
    expect(typeof crossref.search).toBe("function");
    expect(typeof crossref.getPaper).toBe("function");
    expect(typeof crossref.getReferences).toBe("function");
  });

  it("maps citations only for verified references", () => {
    const citations = buildCitations([
      { id: "real", title: "Real Paper", authors: ["A Author"], year: 2024, doi: "10.123/test", source: "OpenAlex" },
      { id: "demo", title: "Demo", authors: ["Demo"], source: "Demo fallback" },
    ]);
    expect(citations).toHaveLength(1);
    expect(citations[0].marker).toBe("[1]");
  });

  it("calculates local similarity", () => {
    const result = analyzeSimilarity("random forest diabetes prediction model", [
      { title: "source", text: "diabetes prediction with random forest model" },
    ]);
    expect(result.overall).toBeGreaterThan(50);
  });

  it("creates a DOCX package buffer", () => {
    const paper: GeneratedPaper = {
      title: "Demo Paper",
      abstract: "Abstract text",
      keywords: ["demo"],
      sections: [{ key: "intro", title: "Introduction", content: "Content", citations: [], warnings: [], editable: true }],
      references: [],
      citations: [],
      tables: [],
      figures: [],
      generatedBy: "MockAIProvider",
    };
    const docx = createDocx(paper);
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    expect(docx.length).toBeGreaterThan(500);
  });

  it("removes XML-invalid control characters from DOCX content", () => {
    const paper: GeneratedPaper = {
      title: "Demo Paper",
      abstract: "Abstract with terminal control \u001b[?25l\u001b[?25hdone and <escaped> text",
      keywords: ["demo"],
      sections: [{ key: "intro", title: "Introduction", content: "Content", citations: [], warnings: [], editable: true }],
      references: [],
      citations: [],
      tables: [],
      figures: [],
      generatedBy: "MockAIProvider",
    };
    const xml = buildDocumentXml(paper);
    expect(xml).not.toContain("\u001b");
    expect(xml).toContain("&lt;escaped&gt;");
  });

  it("reports quality warnings for placeholders and missing references", () => {
    const paper: GeneratedPaper = {
      title: "Demo Paper",
      abstract: "Abstract text",
      keywords: ["demo"],
      sections: [{ key: "results", title: "Results", content: "Accuracy was [Information not provided].", citations: [], warnings: [], editable: true }],
      references: [],
      citations: [],
      tables: [],
      figures: [],
      generatedBy: "MockAIProvider",
    };
    const report = buildQualityReport(paper, {
      title: "Demo Paper",
      domain: "AI",
      problem: "Problem",
      objectives: [],
      researchQuestions: [],
      keywords: [],
      datasets: [],
      datasetAnalyses: [],
      importedLibraries: [],
      preprocessing: [],
      featureEngineering: [],
      hyperparameters: [],
      configuration: [],
      algorithms: [],
      models: [],
      detectedModels: [],
      trainingProcedures: [],
      experiments: [],
      metrics: [],
      results: [],
      figures: [],
      tables: [],
      potentialIssues: [],
      limitations: [],
      conclusions: [],
      references: [],
      sourceFiles: [],
      warnings: [],
    });
    expect(report.checks.some((check) => check.label === "Placeholder text" && check.status === "warning")).toBe(true);
  });
});

describe("Format Registry", () => {
  it("resolves IEEE preset format", () => {
    const config = resolveProjectFormat("IEEE");
    expect(config.id).toBe("ieee");
    expect(config.name).toBe("IEEE");
    expect(config.page.columns).toBe(2);
  });

  it("has valid preset names", () => {
    expect(PRESET_NAMES).toContain("IEEE");
    expect(PRESET_NAMES).toContain("Springer");
    expect(PRESET_NAMES).toContain("Elsevier");
  });
});
