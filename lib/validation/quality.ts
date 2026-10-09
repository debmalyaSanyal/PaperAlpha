import { citationIssues, verifiedReferences } from "@/lib/citations/manager";
import type { GeneratedPaper, QualityReport, ResearchAnalysis } from "@/types/paperalpha";

export function buildQualityReport(paper: GeneratedPaper, analysis: ResearchAnalysis, similarityEstimate = 0): QualityReport {
  const requiredSections = ["Abstract", "Introduction", "Methodology", "Results", "Discussion", "Conclusion", "References"];
  const existingTitles = new Set(paper.sections.map((section) => section.title.toLowerCase()));
  const missingSections = requiredSections.filter((section) => !existingTitles.has(section.toLowerCase()));
  const placeholderSections = paper.sections.filter((section) => /\[Information not provided\]|\[No verified references selected\]/.test(section.content));
  const repeated = repeatedParagraphs(paper.sections.map((section) => section.content).join("\n"));
  const numbersInPaper = numericTokens(paper.sections.map((section) => section.content).join("\n"));
  const sourceNumbers = new Set(analysis.metrics.map((metric) => metric.value.replace(/%$/, "")));
  const suspiciousNumbers = numbersInPaper.filter((value) => Number(value) > 1 && !sourceNumbers.has(value) && !analysis.sourceFiles.some((file) => (file.extractedText || "").includes(value)));
  const citationReport = citationIssues(paper.citations, paper.references);
  const verified = verifiedReferences(paper.references);
  const unsupported = paper.sections.filter((section) =>
    section.title.toLowerCase() !== "references" &&
    section.citations.length === 0 &&
    /(study|result|shows|demonstrates|outperform|significant|accuracy|precision|recall)/i.test(section.content),
  );

  const checks: QualityReport["checks"] = [
    { label: "Missing sections", status: missingSections.length ? "warning" : "pass", detail: missingSections.length ? missingSections.join(", ") : "Required sections are present." },
    { label: "Unsupported claims", status: unsupported.length ? "warning" : "pass", detail: unsupported.length ? `${unsupported.length} sections need stronger source support.` : "Claims have either supplied evidence or citation context." },
    { label: "Missing citations", status: paper.references.length && paper.citations.length === 0 ? "fail" : "pass", detail: `${paper.citations.length} mapped citations.` },
    { label: "Citation/reference mismatch", status: citationReport.missingReferences.length ? "fail" : "pass", detail: citationReport.missingReferences.length ? `${citationReport.missingReferences.length} citations point to missing references.` : "Every citation maps to a reference." },
    { label: "Empty references", status: paper.references.length ? "pass" : "warning", detail: paper.references.length ? `${paper.references.length} references available.` : "No verified references selected." },
    { label: "Unused references", status: citationReport.unusedReferences.length ? "warning" : "pass", detail: citationReport.unusedReferences.length ? `${citationReport.unusedReferences.length} references are not cited.` : "No unused references." },
    { label: "Placeholder text", status: placeholderSections.length ? "warning" : "pass", detail: placeholderSections.length ? `${placeholderSections.length} sections contain missing-information markers.` : "No placeholders detected." },
    { label: "Repeated content", status: repeated.length ? "warning" : "pass", detail: repeated.length ? `${repeated.length} repeated paragraphs detected.` : "No repeated paragraphs detected." },
    { label: "Numerical consistency", status: suspiciousNumbers.length ? "warning" : "pass", detail: suspiciousNumbers.length ? `Review numbers not found in extracted metrics: ${suspiciousNumbers.slice(0, 8).join(", ")}` : "Detected numeric values are traceable to supplied material." },
  ];

  const sectionCompleteness = paper.sections.length ? Math.round(((paper.sections.length - missingSections.length) / paper.sections.length) * 100) : 0;
  const citationCoverage = paper.sections.length ? Math.round((paper.sections.filter((section) => section.citations.length > 0 || section.title.toLowerCase() === "references").length / paper.sections.length) * 100) : 0;
  const sourceVerification = paper.references.length ? Math.round((verified.length / paper.references.length) * 100) : 0;
  const evidenceScore = Math.min(100, Math.round(((analysis.metrics.length ? 25 : 0) + (analysis.datasetAnalyses.length ? 25 : 0) + (analysis.detectedModels.length ? 25 : 0) + (analysis.sourceFiles.length ? 25 : 0))));

  return {
    researchCompleteness: Math.round((sectionCompleteness + evidenceScore) / 2),
    citationCoverage,
    sourceVerification,
    similarityEstimate,
    checks,
  };
}

function repeatedParagraphs(text: string) {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const paragraph of text.split(/\n+/).map((item) => item.trim()).filter((item) => item.length > 40)) {
    const key = paragraph.toLowerCase();
    if (seen.has(key)) repeated.push(paragraph);
    seen.add(key);
  }
  return repeated;
}

function numericTokens(text: string) {
  return Array.from(new Set(Array.from(text.matchAll(/\b\d+(?:\.\d+)?%?\b/g)).map((match) => match[0].replace(/%$/, ""))));
}
