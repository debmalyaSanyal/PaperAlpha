import { inflateRawSync } from "node:zlib";
import { analyzeRows } from "@/lib/analysis/csv";
import type { DatasetAnalysis, ResearchTable } from "@/types/paperalpha";

interface ZipEntry {
  name: string;
  content: Buffer;
}

export function analyzeXlsx(buffer: Buffer, filename: string) {
  const entries = unzip(buffer);
  const sharedStrings = parseSharedStrings(readEntry(entries, "xl/sharedStrings.xml")?.toString("utf8") || "");
  const sheetEntry = entries.find((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name));
  if (!sheetEntry) {
    return { summary: "No worksheet XML was found.", table: null, datasetAnalysis: null, warnings: ["The XLSX workbook did not contain a readable worksheet."] };
  }
  const matrix = parseWorksheet(sheetEntry.content.toString("utf8"), sharedStrings);
  if (matrix.length === 0) {
    return { summary: "Worksheet is empty.", table: null, datasetAnalysis: null, warnings: ["The first worksheet did not contain rows."] };
  }
  const columns = matrix[0].map((cell, index) => cell || `Column ${index + 1}`);
  const rows = matrix.slice(1);
  const columnAnalyses = analyzeRows(columns, rows);
  const table: ResearchTable = {
    id: `table-${filename.replace(/\W+/g, "-").toLowerCase()}`,
    title: "XLSX Dataset Summary",
    caption: `Summary extracted from ${filename}: ${rows.length} rows and ${columns.length} columns.`,
    columns: ["Property", "Value"],
    rows: [
      ["Rows", String(rows.length)],
      ["Columns", String(columns.length)],
      ["Column names", columns.join(", ")],
      ["Numeric columns", columnAnalyses.filter((column) => column.type === "numeric").map((column) => column.name).join(", ") || "None detected"],
      ["Missing values", columnAnalyses.map((column) => `${column.name}: ${column.missing}`).join("; ")],
    ],
    sourceFile: filename,
    trace: { sourceFile: filename, sheet: sheetEntry.name },
  };
  const datasetAnalysis: DatasetAnalysis = {
    filename,
    rows: rows.length,
    columns: columns.length,
    columnAnalyses,
    chartSuggestions: columnAnalyses
      .filter((column) => column.type === "numeric" || column.type === "categorical")
      .slice(0, 6)
      .map((column) => ({
        title: `${column.name} ${column.type === "numeric" ? "distribution" : "counts"}`,
        type: column.type === "numeric" ? "histogram" as const : "bar" as const,
        reason: `${column.type} column detected in workbook.`,
        columns: [column.name],
      })),
    trace: { sourceFile: filename, sheet: sheetEntry.name },
  };
  return {
    summary: `${filename} contains ${rows.length} rows and ${columns.length} columns in the first worksheet.`,
    table,
    datasetAnalysis,
    warnings: [],
  };
}

function unzip(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const dataStart = offset + 30 + nameLength + extraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const content = method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed);
    if (content.length || uncompressedSize === 0) entries.push({ name, content });
    offset = dataStart + compressedSize;
  }
  return entries;
}

function readEntry(entries: ZipEntry[], name: string) {
  return entries.find((entry) => entry.name === name)?.content;
}

function parseSharedStrings(xml: string) {
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((match) =>
    Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((text) => decodeXml(text[1])).join(""),
  );
}

function parseWorksheet(xml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = /r="([A-Z]+)(\d+)"/.exec(attrs);
      const columnIndex = ref ? columnLettersToIndex(ref[1]) : row.length;
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] || /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] || "";
      const value = attrs.includes('t="s"') ? sharedStrings[Number(raw)] || "" : decodeXml(raw);
      row[columnIndex] = value;
    }
    rows.push(row.map((value) => value || ""));
  }
  return rows;
}

function columnLettersToIndex(letters: string) {
  return letters.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function decodeXml(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
