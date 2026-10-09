"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, FileText, GripVertical, Loader2, Search, ShieldCheck, Sparkles, Trash2, UploadCloud } from "lucide-react";
import type { GeneratedPaper, PaperConfiguration, QualityReport, Reference, ResearchAnalysis, ResearchBasics, SimilarityResult } from "@/types/paperalpha";

const defaultBasics: ResearchBasics = {
  title: "",
  topic: "",
  problem: "",
  objectives: "",
  questions: "",
  hypothesis: "",
  keywords: "",
  domain: "",
  summary: "",
};

const defaultSections = [
  "Abstract",
  "Keywords",
  "Introduction",
  "Literature Review",
  "Problem Statement",
  "Objectives",
  "Methodology",
  "System Architecture",
  "Dataset Description",
  "Experimental Setup",
  "Results",
  "Discussion",
  "Limitations",
  "Future Work",
  "Conclusion",
  "References",
];

const defaultConfig: PaperConfiguration = {
  format: "IEEE",
  citationStyle: "IEEE",
  language: "English",
  targetLength: "5000 words",
  paperType: "Research Article",
  sections: defaultSections,
  additionalInstructions: "",
};

const steps = ["Research", "Materials", "Configuration", "Structure", "Instructions", "Generate"];

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f7f9fc] text-slate-700">Loading PaperAlpha...</div>}>
      <GenerateExperience />
    </Suspense>
  );
}

function GenerateExperience() {
  const params = useSearchParams();
  const [step, setStep] = useState(0);
  const [basics, setBasics] = useState<ResearchBasics>(defaultBasics);
  const [config, setConfig] = useState<PaperConfiguration>(defaultConfig);
  const [files, setFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<ResearchAnalysis | null>(null);
  const [literature, setLiterature] = useState<Reference[]>([]);
  const [paper, setPaper] = useState<GeneratedPaper | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [similarity, setSimilarity] = useState<SimilarityResult | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const demo = params.get("demo") === "1";

  useEffect(() => {
    const saved = localStorage.getItem("paperalpha-draft");
    if (saved && !demo) {
      try {
        const draft = JSON.parse(saved) as { basics?: ResearchBasics; config?: PaperConfiguration };
        setBasics({ ...defaultBasics, ...draft.basics });
        setConfig({ ...defaultConfig, ...draft.config });
      } catch {
        localStorage.removeItem("paperalpha-draft");
      }
    }
  }, [demo]);

  useEffect(() => {
    if (demo) {
      setBasics({
        title: "Machine Learning Based Diabetes Prediction",
        topic: "Diabetes prediction using clinical diagnostic indicators",
        problem: "Early diabetes screening needs reliable and interpretable prediction from tabular health features.",
        objectives: "Compare ML classifiers\nEvaluate accuracy, precision, recall, and F1-score\nDiscuss limitations for clinical use",
        questions: "Which model performs best?\nWhich evidence supports the generated paper?",
        hypothesis: "Tree-based classifiers can perform strongly on tabular diabetes prediction data.",
        keywords: "diabetes prediction, machine learning, healthcare analytics, random forest",
        domain: "Healthcare AI",
        summary: "Demo data includes model comparison metrics and dataset notes for a complete PaperAlpha walkthrough.",
      });
      setConfig(defaultConfig);
    }
  }, [demo]);

  function updateBasics(key: keyof ResearchBasics, value: string) {
    setBasics((current) => ({ ...current, [key]: value }));
  }

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    setFiles((current) => [...current, ...Array.from(selected)]);
  }

  function saveDraft() {
    localStorage.setItem("paperalpha-draft", JSON.stringify({ basics, config }));
    setStatus("Draft saved in local browser storage.");
  }

  async function analyzeMaterials() {
    setError("");
    setStatus(demo ? "Loading clearly labeled demo analysis..." : "Analyzing supplied materials...");
    const formData = new FormData();
    formData.set("basics", JSON.stringify(basics));
    if (demo) formData.set("demo", "true");
    files.forEach((file) => formData.append("files", file));
    const response = await fetch("/api/analyze", { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Analysis failed.");
    setAnalysis(payload.analysis);
    setStatus("Research materials analyzed.");
  }

  async function searchSources(currentAnalysis = analysis) {
    if (!currentAnalysis) return [];
    setStatus(demo ? "Loading demo literature sources..." : "Searching free scholarly indexes...");
    const query = [currentAnalysis.title, currentAnalysis.domain, currentAnalysis.keywords.join(" ")].filter(Boolean).join(" ");
    const response = await fetch("/api/literature", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, demo }),
    });
    const payload = await response.json();
    setLiterature(payload.references || []);
    return payload.references || [];
  }

  async function generatePaper(event?: FormEvent) {
    event?.preventDefault();
    try {
      setError("");
      let currentAnalysis = analysis;
      if (!currentAnalysis) {
        await analyzeMaterials();
        const formData = new FormData();
        formData.set("basics", JSON.stringify(basics));
        if (demo) formData.set("demo", "true");
        files.forEach((file) => formData.append("files", file));
        const response = await fetch("/api/analyze", { method: "POST", body: formData });
        const payload = await response.json();
        currentAnalysis = payload.analysis;
        setAnalysis(currentAnalysis);
      }
      const refs = literature.length ? literature : await searchSources(currentAnalysis);
      setStatus("Writing paper sections with MockAIProvider...");
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ basics, configuration: config, analysis: currentAnalysis, literature: refs }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Generation failed.");
      setPaper(payload.paper);
      setQuality(payload.quality);
      setStatus("Paper generated. You can now edit sections, inspect warnings, run similarity, and export.");
      setStep(5);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    }
  }

  async function runSimilarity() {
    if (!paper || !analysis) return;
    setStatus("Running local similarity estimate...");
    const text = [paper.abstract, ...paper.sections.map((section) => section.content)].join("\n");
    const sources = [
      ...analysis.sourceFiles.map((file) => ({ title: file.filename, text: file.extractedText || file.summary || "" })),
      ...literature.map((reference) => ({ title: reference.title, text: reference.abstract || "" })),
    ];
    const response = await fetch("/api/similarity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, sources }),
    });
    const payload = await response.json();
    setSimilarity(payload.result);
    if (quality && payload.result) {
      setQuality({ ...quality, similarityEstimate: payload.result.overall });
    }
    setStatus("Similarity analysis complete.");
  }

  async function exportDocx() {
    if (!paper) return;
    setStatus("Building DOCX export...");
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(paper),
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${paper.title.replace(/[^\w.-]+/g, "-").toLowerCase() || "paperalpha-paper"}.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("DOCX downloaded.");
  }

  const fileCards = files.map((file) => ({ name: file.name, size: formatBytes(file.size), type: file.name.split(".").pop()?.toUpperCase() || "FILE" }));

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <ArrowLeft className="h-4 w-4" /> PaperAlpha
          </Link>
          <button onClick={saveDraft} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400">
            Save Draft Locally
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[18rem_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-5 lg:h-fit">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Generation Wizard</p>
          <div className="mt-4 grid gap-2">
            {steps.map((label, index) => (
              <button
                key={label}
                onClick={() => setStep(index)}
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-semibold ${index === step ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <span className={`grid h-7 w-7 place-items-center rounded-md text-xs ${index === step ? "bg-cyan-300 text-slate-950" : "bg-slate-100 text-slate-600"}`}>{index + 1}</span>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">Your files are processed temporarily and are not permanently stored by PaperAlpha.</p>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">From research to paper — intelligently.</h1>
                <p className="mt-1 text-sm text-slate-600">MockAIProvider is active by default. Demo output is labeled and does not pretend to be a paid AI result.</p>
              </div>
              {demo && <span className="rounded-md bg-cyan-100 px-3 py-1 text-sm font-semibold text-cyan-900">Demo mode</span>}
            </div>
            {(status || error) && <p className={`mt-3 text-sm ${error ? "text-red-700" : "text-slate-600"}`}>{error || status}</p>}
          </div>

          {step === 0 && (
            <Panel title="Research Basics" description="Start with the facts PaperAlpha should use. Optional fields can stay empty.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Research Title" value={basics.title} onChange={(value) => updateBasics("title", value)} />
                <Field label="Research Domain" value={basics.domain} onChange={(value) => updateBasics("domain", value)} />
                <Field label="Research Topic" value={basics.topic} onChange={(value) => updateBasics("topic", value)} />
                <Field label="Keywords" value={basics.keywords} onChange={(value) => updateBasics("keywords", value)} />
              </div>
              <Area label="Problem Statement" value={basics.problem} onChange={(value) => updateBasics("problem", value)} />
              <Area label="Research Objectives" value={basics.objectives} onChange={(value) => updateBasics("objectives", value)} />
              <Area label="Research Questions" value={basics.questions} onChange={(value) => updateBasics("questions", value)} />
              <Area label="Hypothesis" value={basics.hypothesis} onChange={(value) => updateBasics("hypothesis", value)} />
              <Area label="Abstract / Existing Summary" value={basics.summary} onChange={(value) => updateBasics("summary", value)} />
              <NextBar onNext={() => setStep(1)} />
            </Panel>
          )}

          {step === 1 && (
            <Panel title="Research Materials" description="Upload or use demo data. Uploaded Python files are analyzed as text and never executed.">
              <label className="grid cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-10 text-center hover:border-cyan-500">
                <UploadCloud className="h-10 w-10 text-cyan-700" />
                <span className="mt-3 text-base font-semibold">Add files</span>
                <span className="mt-1 text-sm text-slate-500">.ipynb, .py, .csv, .xlsx, .pdf, .docx, .txt, .md, .json, images</span>
                <input className="sr-only" type="file" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => addFiles(event.target.files)} />
              </label>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {fileCards.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
                    <div>
                      <p className="font-semibold">{file.name}</p>
                      <p className="text-sm text-slate-500">{file.type} • {file.size} • queued</p>
                    </div>
                    <button aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {!files.length && !demo && <Empty text="No files yet. You can still generate a conservative draft from typed research basics." />}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={analyzeMaterials} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                  <Search className="h-4 w-4" /> Analyze materials
                </button>
                <button onClick={() => setStep(2)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">Continue</button>
              </div>
              {analysis && <AnalysisPreview analysis={analysis} />}
            </Panel>
          )}

          {step === 2 && (
            <Panel title="Research Configuration" description="Choose paper and citation settings. Exact publisher compliance is not claimed by this MVP.">
              <div className="grid gap-4 md:grid-cols-2">
                <Select label="Paper format" value={config.format} options={["IEEE", "Springer", "Elsevier", "ACM", "APA", "Nature", "Custom"]} onChange={(value) => setConfig({ ...config, format: value as PaperConfiguration["format"] })} />
                <Select label="Citation style" value={config.citationStyle} options={["IEEE", "APA 7", "MLA", "Chicago", "Harvard", "Vancouver", "Custom"]} onChange={(value) => setConfig({ ...config, citationStyle: value as PaperConfiguration["citationStyle"] })} />
                <Select label="Target length" value={config.targetLength} options={["3000 words", "5000 words", "7000 words", "10000 words", "Custom"]} onChange={(value) => setConfig({ ...config, targetLength: value })} />
                <Select label="Paper type" value={config.paperType} options={["Research Article", "Conference Paper", "Review Paper", "Case Study", "Technical Paper", "Custom"]} onChange={(value) => setConfig({ ...config, paperType: value })} />
              </div>
              <NextBar onNext={() => setStep(3)} />
            </Panel>
          )}

          {step === 3 && (
            <Panel title="Paper Structure" description="Select, remove, reorder, or add sections for this paper.">
              <div className="grid gap-2">
                {config.sections.map((section, index) => (
                  <div key={`${section}-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <GripVertical className="h-4 w-4 text-slate-400" />
                    <input value={section} onChange={(event) => setConfig({ ...config, sections: config.sections.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm" />
                    <button onClick={() => setConfig({ ...config, sections: config.sections.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={`Remove ${section}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setConfig({ ...config, sections: [...config.sections, "Custom Section"] })} className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">Add section</button>
              <NextBar onNext={() => setStep(4)} />
            </Panel>
          )}

          {step === 4 && (
            <Panel title="Additional Instructions" description="Tell PaperAlpha what to emphasize or preserve.">
              <Area label="Tell PaperAlpha anything else it should know..." value={config.additionalInstructions} onChange={(value) => setConfig({ ...config, additionalInstructions: value })} />
              <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                {["emphasize novelty", "preserve experimental values", "include tables", "discuss limitations"].map((item) => <span key={item}>• {item}</span>)}
              </div>
              <NextBar onNext={() => setStep(5)} />
            </Panel>
          )}

          {step === 5 && (
            <Panel title="Review & Generate" description="PaperAlpha will analyze your supplied material before writing the paper.">
              <div className="grid gap-4 lg:grid-cols-3">
                <Summary label="Research title" value={basics.title || "[Information not provided]"} />
                <Summary label="Files" value={demo ? "Demo data" : `${files.length} uploaded`} />
                <Summary label="Format" value={`${config.format} / ${config.citationStyle}`} />
                <Summary label="Target length" value={config.targetLength} />
                <Summary label="Paper type" value={config.paperType} />
                <Summary label="Sections" value={`${config.sections.length} selected`} />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={generatePaper} className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-700">
                  <Sparkles className="h-4 w-4" /> Generate Paper
                </button>
                <button onClick={() => searchSources()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold">
                  <Search className="h-4 w-4" /> Search Literature
                </button>
              </div>
              {paper && <Workspace paper={paper} setPaper={setPaper} analysis={analysis} literature={literature} quality={quality} similarity={similarity} onSimilarity={runSimilarity} onExport={exportDocx} />}
            </Panel>
          )}
        </section>
      </main>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-6 grid gap-5">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 font-normal text-slate-950" />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="rounded-md border border-slate-300 px-3 py-2 font-normal leading-6 text-slate-950" />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal text-slate-950">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function NextBar({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex justify-end">
      <button onClick={onNext} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">
        Continue <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">{text}</div>;
}

function AnalysisPreview({ analysis }: { analysis: ResearchAnalysis }) {
  const traceMetrics = analysis.metrics.slice(0, 8).map((metric) =>
    `${metric.name}: ${metric.value} — ${metric.sourceFile}${metric.cell ? `, cell ${metric.cell}` : ""}${metric.line ? `, line ${metric.line}` : ""}`,
  );
  return (
    <div className="mt-6 rounded-lg bg-slate-50 p-5">
      <h3 className="font-semibold">Research analysis</h3>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
        <Summary label="Models" value={analysis.models.join(", ") || "[Information not provided]"} />
        <Summary label="Datasets" value={analysis.datasets.join(", ") || "[Information not provided]"} />
        <Summary label="Metrics" value={analysis.metrics.map((metric) => `${metric.name}: ${metric.value}`).join("; ") || "[Information not provided]"} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <TraceList title="Dataset Analysis" items={analysis.datasetAnalyses.map((dataset) => `${dataset.filename}: ${dataset.rows} rows, ${dataset.columns} columns`)} empty="No dataset analysis yet." />
        <TraceList title="Methodology Detected" items={[...analysis.featureEngineering, ...analysis.trainingProcedures, ...analysis.hyperparameters, ...analysis.configuration].slice(0, 10).map((item) => `${item.label}: ${item.value} — ${formatTrace(item.trace)}`)} empty="No methodology cues detected." />
        <TraceList title="Models Detected" items={analysis.detectedModels.slice(0, 8).map((item) => `${item.value} — ${formatTrace(item.trace)}`)} empty="No model names detected." />
        <TraceList title="Metrics & Results" items={[...traceMetrics, ...analysis.results.slice(0, 6).map((item) => `${item.value} — ${formatTrace(item.trace)}`)]} empty="No metrics detected." />
        <TraceList title="Figures & Tables" items={[...analysis.figures.map((figure) => `${figure.title} — ${figure.sourceFile}`), ...analysis.tables.map((table) => `${table.title} — ${formatTrace(table.trace || { sourceFile: table.sourceFile })}`)].slice(0, 8)} empty="No figures or tables detected." />
        <TraceList title="Potential Issues" items={[...analysis.warnings, ...analysis.potentialIssues.map((item) => `${item.value} — ${formatTrace(item.trace)}`)].slice(0, 8)} empty="No issues detected." />
      </div>
    </div>
  );
}

function TraceList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
      <ul className="mt-2 grid gap-2 text-xs leading-5 text-slate-600">
        {items.length ? items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>) : <li>{empty}</li>}
      </ul>
    </div>
  );
}

function formatTrace(trace: { sourceFile: string; cell?: number; line?: number; sheet?: string }) {
  return [trace.sourceFile, trace.sheet, trace.cell ? `cell ${trace.cell}` : "", trace.line ? `line ${trace.line}` : ""].filter(Boolean).join(", ");
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Workspace({ paper, setPaper, analysis, literature, quality, similarity, onSimilarity, onExport }: {
  paper: GeneratedPaper;
  setPaper: (paper: GeneratedPaper) => void;
  analysis: ResearchAnalysis | null;
  literature: Reference[];
  quality: QualityReport | null;
  similarity: SimilarityResult | null;
  onSimilarity: () => void;
  onExport: () => void;
}) {
  const [active, setActive] = useState(paper.sections[0]?.key || "");
  const activeSection = useMemo(() => paper.sections.find((section) => section.key === active) || paper.sections[0], [active, paper.sections]);

  function updateSection(content: string) {
    setPaper({ ...paper, sections: paper.sections.map((section) => section.key === activeSection.key ? { ...section, content } : section) });
  }

  function transformSection(mode: "shorten" | "expand" | "tone" | "citation" | "unsupported") {
    const content = activeSection.content;
    const next = {
      shorten: content.split(/(?<=[.!?])\s+/).slice(0, Math.max(2, Math.ceil(content.split(/(?<=[.!?])\s+/).length / 2))).join(" "),
      expand: `${content}\n\nAdditional explanation: [Information not provided] should be replaced only with evidence from uploaded material or verified literature.`,
      tone: content.replace(/\bwe\b/gi, "this study").replace(/\bshows\b/gi, "indicates"),
      citation: `${content}${paper.citations[0] ? ` ${paper.citations[0].marker}` : " [No verified citation available]"}`,
      unsupported: content.replace(/[^.!?]*(?:outperform|significant|guarantee|proves)[^.!?]*[.!?]/gi, "[Unsupported claim removed.] "),
    }[mode];
    updateSection(next);
  }

  return (
    <div className="mt-8 grid gap-5 xl:grid-cols-[15rem_1fr_20rem]">
      <aside className="rounded-lg border border-slate-200 bg-white p-3">
        {paper.sections.map((section) => (
          <button key={section.key} onClick={() => setActive(section.key)} className={`block w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${section.key === activeSection.key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {section.title}
          </button>
        ))}
      </aside>
      <article className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">{activeSection.title}</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => transformSection("tone")} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">Improve Tone</button>
            <button onClick={() => transformSection("shorten")} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">Shorten</button>
            <button onClick={() => transformSection("expand")} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">Expand</button>
            <button onClick={() => transformSection("citation")} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">Add Citation</button>
            <button onClick={() => transformSection("unsupported")} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">Remove Unsupported Claim</button>
          </div>
        </div>
        <textarea value={activeSection.content} onChange={(event) => updateSection(event.target.value)} rows={16} className="mt-4 w-full rounded-md border border-slate-300 p-4 leading-7" />
        {paper.tables.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <h4 className="font-semibold">Editable tables</h4>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>{paper.tables[0].columns.map((column) => <th key={column} className="border border-slate-200 bg-slate-50 p-2 text-left">{column}</th>)}</thead>
              <tbody>{paper.tables[0].rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="border border-slate-200 p-2">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </article>
      <aside className="grid gap-4">
        <ToolPanel title="Insights">
          <p>{analysis?.warnings[0] || "Generated claims are tied to supplied material or reviewed sources where available."}</p>
        </ToolPanel>
        <ToolPanel title="Sources">
          {literature.length ? literature.map((reference) => <p key={reference.id} className="border-b border-slate-100 py-2">{reference.title}</p>) : <p>No literature selected yet.</p>}
        </ToolPanel>
        <ToolPanel title="Quality">
          {quality ? (
            <div className="grid gap-2">
              <Score label="Research completeness" value={quality.researchCompleteness} />
              <Score label="Citation coverage" value={quality.citationCoverage} />
              <Score label="Source verification" value={quality.sourceVerification} />
              <Score label="Similarity estimate" value={quality.similarityEstimate} />
              <div className="mt-2 grid gap-1 border-t border-slate-100 pt-2">
                {quality.checks.map((check) => (
                  <p key={check.label} className="text-xs"><span className="font-semibold text-slate-800">{check.label}:</span> {check.detail}</p>
                ))}
              </div>
            </div>
          ) : <p>Quality checks will appear after generation.</p>}
        </ToolPanel>
        <ToolPanel title="Similarity">
          <button onClick={onSimilarity} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4" /> Run analysis
          </button>
          {similarity && <p className="mt-3">{similarity.overall}% estimate. {similarity.explanation}</p>}
        </ToolPanel>
        <button onClick={onExport} className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 py-3 text-sm font-semibold text-white">
          <Download className="h-4 w-4" /> Download DOCX
        </button>
      </aside>
    </div>
  );
}

function ToolPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
      <h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><FileText className="h-4 w-4 text-cyan-700" /> {title}</h4>
      {children}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold"><span>{label}</span><span>{value}%</span></div>
      <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-cyan-600" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
