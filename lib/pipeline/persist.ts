import type { PipelineResult } from "@/lib/backend/contract";
import { prisma } from "@/lib/db";
import { estimatePageCount } from "@/lib/formats/pageBudget";
import { resolveProjectFormat } from "@/lib/formats/registry";
import { safeParseFormatPatch } from "@/lib/formats/schema";
import { countWords } from "@/lib/utils";

/**
 * Persist a completed pipeline run.
 *
 * Sections are upserted by `(projectId, key)` so a manual edit survives a
 * regeneration of a different section (specification section 26). Purely
 * derived collections (citations, figures, tables, literature, experiments)
 * are replaced wholesale, because they describe the current run.
 */
export async function persistPipelineResult(
  projectId: string,
  result: PipelineResult,
  options: { jobId?: string; preserveEditedSections?: boolean } = {},
): Promise<{ version: number; pageEstimate: number | null }> {
  const preserveEdited = options.preserveEditedSections ?? true;
  const existing = await prisma.paperSection.findMany({
    where: { projectId },
    select: { key: true, isUserEdited: true },
  });
  const editedKeys = new Set(existing.filter((s) => s.isUserEdited).map((s) => s.key));

  for (const section of result.sections) {
    if (preserveEdited && editedKeys.has(section.key)) continue;
    const content = section.content ?? "";
    await prisma.paperSection.upsert({
      where: { projectId_key: { projectId, key: section.key } },
      update: {
        title: section.title,
        headingLevel: section.level,
        orderIndex: section.orderIndex,
        numberLabel: section.numberLabel ?? null,
        content,
        wordCount: section.wordCount || countWords(content),
        targetWords: section.targetWords ?? null,
        status: "VERIFIED",
        citationsUsed: JSON.stringify(section.citationsUsed ?? []),
        claimsJson: JSON.stringify(section.claims ?? []),
        revision: { increment: 1 },
      },
      create: {
        projectId,
        key: section.key,
        title: section.title,
        headingLevel: section.level,
        orderIndex: section.orderIndex,
        numberLabel: section.numberLabel ?? null,
        content,
        wordCount: section.wordCount || countWords(content),
        targetWords: section.targetWords ?? null,
        status: "VERIFIED",
        citationsUsed: JSON.stringify(section.citationsUsed ?? []),
        claimsJson: JSON.stringify(section.claims ?? []),
      },
    });
  }

  // --- Literature, citations, artwork, experiments: derived, replaced ---
  await prisma.citation.deleteMany({ where: { projectId } });
  await prisma.experimentResult.deleteMany({ where: { projectId } });
  await prisma.experiment.deleteMany({ where: { projectId } });
  await prisma.figure.deleteMany({ where: { projectId } });
  await prisma.tableRecord.deleteMany({ where: { projectId } });
  await prisma.literatureSource.deleteMany({ where: { projectId } });
  await prisma.literatureReview.deleteMany({ where: { projectId } });
  await prisma.paperOutline.deleteMany({ where: { projectId } });

  for (const citation of result.citations ?? []) {
    let sourceId: string | null = null;
    if (citation.source) {
      const source = await prisma.literatureSource.create({
        data: {
          projectId,
          citationKey: citation.citationKey,
          title: citation.source.title,
          authors: JSON.stringify(citation.source.authors ?? []),
          year: citation.source.year ?? null,
          venue: citation.source.venue ?? null,
          doi: citation.source.doi ?? null,
          url: citation.source.url ?? null,
          abstract: citation.source.abstract ?? null,
          source: citation.source.source,
          sourceId: citation.source.sourceId ?? null,
          relevance: citation.source.relevance ?? null,
          keyMethod: citation.source.keyMethod ?? null,
          keyResult: citation.source.keyResult ?? null,
          limitation: citation.source.limitation ?? null,
          usedDataset: citation.source.usedDataset ?? null,
          usedMetric: citation.source.usedMetric ?? null,
          theme: citation.source.theme ?? null,
          isFoundational: citation.source.isFoundational ?? false,
          verified: citation.source.verified ?? false,
          verificationNote: citation.source.verificationNote ?? null,
        },
      });
      sourceId = source.id;
    }

    await prisma.citation.create({
      data: {
        projectId,
        sourceId,
        citationKey: citation.citationKey,
        raw: citation.raw,
        style: citation.style,
        orderIndex: citation.orderIndex,
        inTextCount: citation.inTextCount,
        isOrphanReference: citation.isOrphanReference,
        isMissingSource: citation.isMissingSource,
      },
    });
  }

  for (const figure of result.figures ?? []) {
    await prisma.figure.create({
      data: {
        projectId,
        label: figure.label,
        number: figure.number,
        caption: figure.caption,
        storageKey: figure.storageKey,
        source: figure.source,
        widthInches: figure.widthInches,
      },
    });
  }

  for (const table of result.tables ?? []) {
    await prisma.tableRecord.create({
      data: {
        projectId,
        label: table.label,
        number: table.number,
        caption: table.caption,
        headersJson: JSON.stringify(table.headers ?? []),
        rowsJson: JSON.stringify(table.rows ?? []),
        source: table.source,
        isSuggested: table.isSuggested ?? false,
        notes: table.notes ?? null,
      },
    });
  }

  for (const experiment of result.experiments ?? []) {
    const record = experiment as Record<string, unknown>;
    const created = await prisma.experiment.create({
      data: {
        projectId,
        name: String(record.name ?? "Experiment"),
        description: record.description ? String(record.description) : null,
        kind: String(record.kind ?? "main"),
        configuration: record.configuration ? JSON.stringify(record.configuration) : null,
        isSuggested: Boolean(record.is_suggested ?? false),
        evidence: JSON.stringify(record.evidence ?? []),
        orderIndex: 0,
      },
    });

    const results = Array.isArray(record.results) ? (record.results as Array<Record<string, unknown>>) : [];
    for (const metric of results) {
      await prisma.experimentResult.create({
        data: {
          experimentId: created.id,
          projectId,
          metricName: String(metric.metric_name ?? metric.metricName ?? "metric"),
          metricValue: typeof metric.metric_value === "number" ? metric.metric_value : null,
          metricText: metric.metric_text ? String(metric.metric_text) : null,
          split: metric.split ? String(metric.split) : "unspecified",
          stdDev: typeof metric.std_dev === "number" ? metric.std_dev : null,
          n: typeof metric.n === "number" ? metric.n : null,
          isAvailable: metric.is_available !== false,
          evidence: metric.evidence ? String(metric.evidence) : null,
        },
      });
    }
  }

  if (result.literatureReview) {
    const review = result.literatureReview as Record<string, unknown>;
    await prisma.literatureReview.create({
      data: {
        projectId,
        themesJson: JSON.stringify(review.themes ?? []),
        synthesis: review.synthesis ? String(review.synthesis) : null,
        researchGap: review.research_gap ? String(review.research_gap) : null,
        matrixJson: JSON.stringify(review.matrix ?? []),
        queryLog: JSON.stringify(review.query_log ?? []),
        providerCounts: null,
      },
    });
  }

  // --- Outline ---
  if (result.outline) {
    await prisma.paperOutline.create({
      data: {
        projectId,
        formatName: result.outline.formatName,
        isActive: true,
        structureJson: JSON.stringify(result.outline.sections ?? []),
        wordBudget: JSON.stringify(result.outline.wordBudget ?? {}),
        notes: result.outline.notes ?? null,
      },
    });
  }

  // --- Structured stage artifacts (resumable agent state) ---
  const stages: Record<string, unknown> = {
    code_analysis: result.codeAnalysis,
    research_understanding: result.researchUnderstanding,
    literature: result.literatureReview,
    experiments: result.experiments,
    quality_control: result.qualityReport,
    claim_verification: result.claimVerification,
    citation_validation: result.citationValidation,
  };
  for (const stage of Object.entries(stages)) {
    const payload = stage[1];
    if (payload === null || payload === undefined) continue;
    await prisma.artifact.upsert({
      where: { projectId_stage_key: { projectId, stage: stage[0], key: "summary" } },
      update: { payload: JSON.stringify(payload), jobId: options.jobId ?? null },
      create: {
        projectId,
        jobId: options.jobId ?? null,
        stage: stage[0],
        key: "summary",
        payload: JSON.stringify(payload),
      },
    });
  }
  for (const [key, payload] of Object.entries(result.artifacts ?? {})) {
    await prisma.artifact.upsert({
      where: { projectId_stage_key: { projectId, stage: key, key: "payload" } },
      update: { payload: JSON.stringify(payload), jobId: options.jobId ?? null },
      create: {
        projectId,
        jobId: options.jobId ?? null,
        stage: key,
        key: "payload",
        payload: JSON.stringify(payload),
      },
    });
  }

  // --- Documents (history preserved; newest marked final) ---
  for (const document of result.documents ?? []) {
    await prisma.document.create({
      data: {
        projectId,
        format: "docx",
        storageKey: document.storageKey,
        fileName: document.fileName,
        sizeBytes: document.sizeBytes,
        pageCount: document.pageCount,
        wordCount: document.wordCount,
        isFinal: document.isFinal,
        metaJson: JSON.stringify(document.meta ?? {}),
      },
    });
  }

  // --- Quality report ---
  if (result.qualityReport) {
    const report = result.qualityReport;
    await prisma.qualityReport.create({
      data: {
        projectId,
        scoreJson: JSON.stringify(report.qualityScore ?? {}),
        issuesJson: JSON.stringify(report.issues ?? []),
        warningsJson: JSON.stringify(report.warnings ?? []),
        citationIssuesJson: JSON.stringify(report.citationIssues ?? []),
        technicalIssuesJson: JSON.stringify(report.technicalIssues ?? []),
        formattingIssuesJson: JSON.stringify(report.formattingIssues ?? []),
        pageEstimate: report.pageEstimate,
        wordCount: report.wordCount,
        verdict: report.verdict,
      },
    });
  }

  // --- Version snapshot ---
  const lastVersion = await prisma.paperVersion.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (lastVersion?.version ?? 0) + 1;

  const totalWords = (result.sections ?? []).reduce((acc, section) => acc + (section.wordCount || countWords(section.content)), 0);
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const patch = safeParseFormatPatch(project?.customFormatPatch ? JSON.parse(project.customFormatPatch) : {});
  const format = resolveProjectFormat(project?.paperFormat ?? "IEEE", patch.ok ? patch.patch : undefined);
  const pageEstimate =
    result.qualityReport?.pageEstimate ??
    estimatePageCount({
      format,
      wordCount: totalWords,
      figureCount: (result.figures ?? []).length,
      tableCount: (result.tables ?? []).length,
      referenceCount: (result.citations ?? []).length,
    }).pages;

  await prisma.paperVersion.create({
    data: {
      projectId,
      version,
      kind: "generated",
      snapshotJson: JSON.stringify({
        title: result.title,
        abstract: result.abstract,
        keywords: result.keywords,
        sections: result.sections,
        citations: result.citations,
        figures: result.figures,
        tables: result.tables,
        warnings: result.warnings,
      }),
      pageEstimate,
      wordCount: totalWords,
      note: result.warnings?.length ? result.warnings.join(" | ").slice(0, 900) : null,
    },
  });

  return { version, pageEstimate };
}

