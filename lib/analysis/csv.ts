import type { DatasetAnalysis, DatasetColumnAnalysis, ResearchTable } from "@/types/paperalpha";

export function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

export function analyzeCsv(text: string, filename: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { summary: "CSV file is empty.", table: null, warnings: ["No rows were found."] };
  }

  const columns = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  const sampleRows = rows.slice(0, 6);
  const columnAnalyses = analyzeRows(columns, rows);
  const numericColumns = columnAnalyses.filter((column) => column.type === "numeric").map((column) => column.name);
  const missingCounts = columnAnalyses.map((column) => column.missing);
  const correlations = computeCorrelations(columns, rows);
  const classBalance = inferClassBalance(columns, rows);

  const table: ResearchTable = {
    id: `table-${filename.replace(/\W+/g, "-").toLowerCase()}`,
    title: "Dataset Summary",
    caption: `Summary extracted from ${filename}: ${rows.length} rows and ${columns.length} columns.`,
    columns: ["Property", "Value"],
    rows: [
      ["Rows", String(rows.length)],
      ["Columns", String(columns.length)],
      ["Column names", columns.join(", ")],
      ["Numeric columns", numericColumns.join(", ") || "None detected"],
      ["Missing values", missingCounts.map((count, index) => `${columns[index]}: ${count}`).join("; ")],
    ],
    sourceFile: filename,
    trace: { sourceFile: filename },
  };

  const datasetAnalysis: DatasetAnalysis = {
    filename,
    rows: rows.length,
    columns: columns.length,
    columnAnalyses,
    classBalance,
    correlations,
    chartSuggestions: suggestCharts(columnAnalyses, correlations),
    trace: { sourceFile: filename },
  };

  return {
    summary: `${filename} contains ${rows.length} rows and ${columns.length} columns. Columns: ${columns.join(", ")}.`,
    table,
    datasetAnalysis,
    preview: { columns, rows: sampleRows },
    warnings: rows.length === 0 ? ["Only a header row was found."] : [],
  };
}

export function analyzeRows(columns: string[], rows: string[][]): DatasetColumnAnalysis[] {
  return columns.map((name, columnIndex) => {
    const values = rows.map((row) => row[columnIndex]?.trim() ?? "");
    const present = values.filter(Boolean);
    const numeric = present.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    const counts = new Map<string, number>();
    for (const value of present) counts.set(value, (counts.get(value) || 0) + 1);
    const topValues = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value, count]) => ({ value, count }));
    const type = inferType(present, numeric.length);
    const analysis: DatasetColumnAnalysis = {
      name,
      type,
      missing: values.length - present.length,
      unique: counts.size,
      topValues,
    };
    if (type === "numeric" && numeric.length) {
      const mean = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
      const variance = numeric.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numeric.length;
      analysis.mean = round(mean);
      analysis.min = round(Math.min(...numeric));
      analysis.max = round(Math.max(...numeric));
      analysis.standardDeviation = round(Math.sqrt(variance));
    }
    return analysis;
  });
}

function inferType(values: string[], numericCount: number): DatasetColumnAnalysis["type"] {
  if (values.length === 0) return "empty";
  if (numericCount >= values.length * 0.9) return "numeric";
  if (values.every((value) => /^(true|false|0|1|yes|no)$/i.test(value))) return "boolean";
  if (values.filter((value) => !Number.isNaN(Date.parse(value))).length >= values.length * 0.9) return "date";
  const unique = new Set(values).size;
  if (unique <= Math.max(20, values.length * 0.3)) return "categorical";
  return "mixed";
}

function inferClassBalance(columns: string[], rows: string[][]) {
  const targetIndex = columns.findIndex((column) => /^(target|label|class|outcome|y)$/i.test(column.trim()));
  if (targetIndex === -1 || rows.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[targetIndex]?.trim();
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => ({
    label,
    count,
    percentage: round((count / rows.length) * 100),
  }));
}

function computeCorrelations(columns: string[], rows: string[][]) {
  const numericColumns = columns
    .map((name, index) => ({ name, index, values: rows.map((row) => Number(row[index])).filter((value) => Number.isFinite(value)) }))
    .filter((column) => column.values.length === rows.length && rows.length > 2);
  const correlations: Array<{ a: string; b: string; value: number }> = [];
  for (let i = 0; i < numericColumns.length; i += 1) {
    for (let j = i + 1; j < numericColumns.length; j += 1) {
      correlations.push({
        a: numericColumns[i].name,
        b: numericColumns[j].name,
        value: round(pearson(numericColumns[i].values, numericColumns[j].values)),
      });
    }
  }
  return correlations.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 10);
}

function pearson(a: number[], b: number[]) {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const da = a[index] - meanA;
    const db = b[index] - meanB;
    numerator += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  return denomA && denomB ? numerator / Math.sqrt(denomA * denomB) : 0;
}

function suggestCharts(columnAnalyses: DatasetColumnAnalysis[], correlations: Array<{ a: string; b: string; value: number }>) {
  const suggestions: DatasetAnalysis["chartSuggestions"] = [];
  for (const column of columnAnalyses) {
    if (column.type === "categorical" && column.topValues?.length) {
      suggestions.push({
        title: `${column.name} distribution`,
        type: "bar",
        reason: "Categorical column has value counts available.",
        columns: [column.name],
      });
    }
    if (column.type === "numeric") {
      suggestions.push({
        title: `${column.name} numerical distribution`,
        type: "histogram",
        reason: "Numeric column supports distribution analysis.",
        columns: [column.name],
      });
    }
  }
  if (correlations.length) {
    suggestions.push({
      title: "Top numerical correlations",
      type: "correlation",
      reason: "At least two complete numeric columns were detected.",
      columns: Array.from(new Set(correlations.flatMap((item) => [item.a, item.b]))),
    });
  }
  return suggestions.slice(0, 6);
}

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}
