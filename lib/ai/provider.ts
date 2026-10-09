import { buildCitations, citationMarker, formatReference, verifiedReferences } from "@/lib/citations/manager";
import type { GeneratedPaper, GenerationJob, PaperSection, Reference, ResearchAnalysis } from "@/types/paperalpha";

export interface AIProvider {
  analyzeResearch(analysis: ResearchAnalysis): Promise<ResearchAnalysis>;
  generateOutline(job: GenerationJob): Promise<string[]>;
  generateSection(job: GenerationJob, sectionTitle: string): Promise<PaperSection>;
  generateAbstract(job: GenerationJob): Promise<string>;
  generateDiscussion(job: GenerationJob): Promise<string>;
  generateConclusion(job: GenerationJob): Promise<string>;
  generateReferences(references: Reference[]): Promise<Reference[]>;
  improveSection(section: PaperSection, instruction: string, job: GenerationJob): Promise<PaperSection>;
  generatePaper(job: GenerationJob): Promise<GeneratedPaper>;
}

export class MockAIProvider implements AIProvider {
  async analyzeResearch(analysis: ResearchAnalysis) {
    return analysis;
  }

  async generateOutline(job: GenerationJob) {
    return job.configuration.sections;
  }

  async generateSection(job: GenerationJob, sectionTitle: string): Promise<PaperSection> {
    const key = sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { analysis, basics } = job;
    const literature = verifiedReferences(job.literature);
    const citation = literature[0] ? citationMarker(job.configuration.citationStyle, literature[0], 1) : "";
    const support = citation ? ` ${citation}` : "";
    const models = analysis.models.length ? analysis.models.join(", ") : "[Information not provided]";
    const datasets = analysis.datasets.length ? analysis.datasets.join(", ") : "[Information not provided]";
    const metrics = analysis.metrics.length ? analysis.metrics.map((metric) => `${metric.name}: ${metric.value}`).join("; ") : "[Information not provided]";

    const templates: Record<string, string> = {
      abstract: await this.generateAbstract(job),
      keywords: analysis.keywords.join(", ") || basics.keywords || "[Information not provided]",
      introduction: `The study addresses ${analysis.problem}. The research domain is ${analysis.domain || "[Information not provided]"}. PaperAlpha drafted this section from supplied project material and verified literature metadata${support}.`,
      "literature-review": literature.length
        ? `Relevant literature was retrieved from free scholarly indexes. ${literature.slice(0, 3).map((reference, index) => `${citationMarker(job.configuration.citationStyle, reference, index + 1)} ${reference.title}`).join(" ")} These sources are listed for user review before final citation use.`
        : "No verified literature sources were selected. [Information not provided]",
      "problem-statement": analysis.problem,
      objectives: analysis.objectives.length ? analysis.objectives.map((objective) => `- ${objective}`).join("\n") : "[Information not provided]",
      methodology: `The current methodology is derived from uploaded material. Detected datasets: ${datasets}. Detected preprocessing or analysis steps: ${analysis.preprocessing.join(", ") || "[Information not provided]"}. Detected models or algorithms: ${models}.`,
      "system-architecture": `The implementation or experimental architecture references ${models}. A detailed architecture diagram was not found in the supplied material, so this section should be expanded by the researcher.`,
      "dataset-description": `Detected dataset material: ${datasets}. ${analysis.tables[0]?.caption || "Detailed dataset statistics were not fully provided."}`,
      "experimental-setup": `Detected experiments include ${analysis.experiments.map((experiment) => experiment.name).join(", ") || "[Information not provided]"}. Reported metrics are: ${metrics}.`,
      results: `Reported results from supplied material: ${metrics}. No experimental value has been invented; missing values remain marked as not provided.`,
      discussion: await this.generateDiscussion(job),
      limitations: analysis.limitations.length ? analysis.limitations.join("\n") : "The supplied material does not fully specify limitations. The final paper should discuss dataset scope, validation constraints, reproducibility, and external validity.",
      "future-work": "Future work may include broader validation, stronger ablation studies, expanded datasets, and comparison with additional baselines, subject to the researcher supplying those experiments.",
      conclusion: await this.generateConclusion(job),
      references: literature.length ? literature.map((reference, index) => formatReference(reference, index + 1, job.configuration.citationStyle)).join("\n") : "[No verified references selected]",
    };

    return {
      key,
      title: sectionTitle,
      content: templates[key] || `${sectionTitle}: ${analysis.conclusions[0] || "[Information not provided]"}`,
      citations: literature.slice(0, 3).map((reference) => reference.id),
      warnings: templates[key]?.includes("[Information not provided]") ? ["Some required information was missing from the supplied research material."] : [],
      editable: true,
    };
  }

  async generateAbstract(job: GenerationJob) {
    const { analysis } = job;
    const objectives = analysis.objectives.join("; ") || "[Information not provided]";
    const models = analysis.models.join(", ") || "[Information not provided]";
    const metrics = analysis.metrics.map((metric) => `${metric.name} ${metric.value}`).join(", ") || "[Information not provided]";
    return `This paper investigates ${analysis.title} in the domain of ${analysis.domain || "[Information not provided]"}. The work addresses the problem: ${analysis.problem}. The stated objectives are ${objectives}. Supplied material indicates use of ${models}, with reported metrics including ${metrics}. This draft is generated by PaperAlpha's MockAIProvider for a zero-budget demo workflow and should be reviewed by the researcher before submission.`;
  }

  async generateDiscussion(job: GenerationJob) {
    const bestMetric = job.analysis.metrics[0];
    return bestMetric
      ? `The supplied results suggest that the reported approach achieved ${bestMetric.name} of ${bestMetric.value}. This interpretation is limited to the provided material, and PaperAlpha does not infer significance, generalization, or superiority beyond the evidence supplied.`
      : "The supplied material does not include enough experimental evidence for a detailed discussion. The researcher should add validated results and comparisons before submission.";
  }

  async generateConclusion(job: GenerationJob) {
    return job.analysis.conclusions[0] || `The study presents a structured investigation of ${job.analysis.title}. Final claims should be limited to the supplied data, verified experiments, and reviewed citations.`;
  }

  async generateReferences(references: Reference[]) {
    return verifiedReferences(references);
  }

  async improveSection(section: PaperSection, instruction: string, _job?: GenerationJob) {
    return {
      ...section,
      content: `${section.content}\n\nRevision note: ${instruction}. Please review this mock revision before use.`,
      warnings: [...section.warnings, "Improved by MockAIProvider; review before submission."],
    };
  }

  async generatePaper(job: GenerationJob): Promise<GeneratedPaper> {
    const sections: PaperSection[] = [];
    for (const section of job.configuration.sections) {
      sections.push(await this.generateSection(job, section));
    }
    const abstract = await this.generateAbstract(job);
    const references = await this.generateReferences(job.literature);
    return {
      title: job.analysis.title,
      abstract,
      keywords: job.analysis.keywords,
      sections,
      references,
      citations: buildCitations(references, job.configuration.citationStyle),
      tables: job.analysis.tables,
      figures: job.analysis.figures,
      generatedBy: "MockAIProvider",
    };
  }
}

export class FreeAIProvider implements AIProvider {
  private fallback = new MockAIProvider();

  async analyzeResearch(analysis: ResearchAnalysis) {
    return analysis;
  }

  async generateOutline(job: GenerationJob) {
    return job.configuration.sections;
  }

  async generateSection(job: GenerationJob, sectionTitle: string) {
    const prompt = researchPrompt(job, sectionTitle);
    const content = await this.callFreeModel(prompt);
    if (!content) return this.fallback.generateSection(job, sectionTitle);
    return {
      key: sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title: sectionTitle,
      content,
      citations: verifiedReferences(job.literature).slice(0, 3).map((reference) => reference.id),
      warnings: [],
      editable: true,
    };
  }

  async generateAbstract(job: GenerationJob) {
    return (await this.callFreeModel(researchPrompt(job, "Abstract"))) || this.fallback.generateAbstract(job);
  }

  async generateDiscussion(job: GenerationJob) {
    return (await this.callFreeModel(researchPrompt(job, "Discussion"))) || this.fallback.generateDiscussion(job);
  }

  async generateConclusion(job: GenerationJob) {
    return (await this.callFreeModel(researchPrompt(job, "Conclusion"))) || this.fallback.generateConclusion(job);
  }

  async generateReferences(references: Reference[]) {
    return verifiedReferences(references);
  }

  async improveSection(section: PaperSection, instruction: string, job: GenerationJob) {
    const content = await this.callFreeModel(`${researchPrompt(job, section.title)}\n\nExisting section:\n${section.content}\n\nRevision instruction: ${instruction}`);
    return content ? { ...section, content } : this.fallback.improveSection(section, instruction, job);
  }

  async generatePaper(job: GenerationJob): Promise<GeneratedPaper> {
    const sections: PaperSection[] = [];
    for (const section of job.configuration.sections) {
      sections.push(await this.generateSection(job, section));
    }
    const references = await this.generateReferences(job.literature);
    return {
      title: job.analysis.title,
      abstract: await this.generateAbstract(job),
      keywords: job.analysis.keywords,
      sections,
      references,
      citations: buildCitations(references, job.configuration.citationStyle),
      tables: job.analysis.tables,
      figures: job.analysis.figures,
      generatedBy: "FreeAIProvider",
    };
  }

  private async callFreeModel(prompt: string) {
    const endpoint = process.env.FREE_AI_API_URL || "https://api-inference.huggingface.co/models";
    const model = process.env.FREE_AI_MODEL;
    const key = process.env.FREE_AI_API_KEY;
    if (!model || !key) return null;
    try {
      const response = await fetch(`${endpoint.replace(/\/$/, "")}/${model}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 700, return_full_text: false } }),
      });
      if (!response.ok) return null;
      const data = await response.json() as unknown;
      if (Array.isArray(data) && typeof data[0]?.generated_text === "string") return data[0].generated_text;
      if (typeof (data as { generated_text?: unknown }).generated_text === "string") return (data as { generated_text: string }).generated_text;
      return null;
    } catch {
      return null;
    }
  }
}

export function getAIProvider() {
  return process.env.AI_PROVIDER === "free" ? new FreeAIProvider() : new MockAIProvider();
}

function researchPrompt(job: GenerationJob, sectionTitle: string) {
  const metrics = job.analysis.metrics.map((metric) => `${metric.name}=${metric.value} (source: ${metric.sourceFile}${metric.cell ? ` cell ${metric.cell}` : ""}${metric.line ? ` line ${metric.line}` : ""})`).join("; ") || "No metrics supplied.";
  const references = verifiedReferences(job.literature).map((reference, index) => `${citationMarker(job.configuration.citationStyle, reference, index + 1)} ${reference.title}`).join("\n") || "No verified references.";
  return `Write the "${sectionTitle}" section for an academic paper.

Rules:
- Never invent experimental values, datasets, model results, or citations.
- Preserve numerical results exactly.
- Use only supplied evidence or verified literature.
- If information is missing, write [Information not provided].
- Distinguish supplied evidence from generated explanation.

Research title: ${job.analysis.title}
Problem: ${job.analysis.problem}
Objectives: ${job.analysis.objectives.join("; ") || "[Information not provided]"}
Datasets: ${job.analysis.datasets.join(", ") || "[Information not provided]"}
Models: ${job.analysis.models.join(", ") || "[Information not provided]"}
Metrics: ${metrics}
Verified literature:
${references}`;
}
