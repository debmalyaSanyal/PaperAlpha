import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Lock, Microscope, Search, ShieldCheck, Sparkles } from "lucide-react";

const sections = [
  ["How it works", "Create a project, upload research material, configure the paper, review generated sections, run checks, and export."],
  ["Supported research material", ".ipynb, .py, .csv, .xlsx, .pdf, .docx, .txt, .md, .json, and common image formats."],
  ["Paper formats", "IEEE, Springer, Elsevier, ACM, APA, Nature, and custom section plans."],
  ["AI-assisted research analysis", "The default MockAIProvider creates demo output from structured research data without paid API keys."],
  ["Similarity checking", "Local TF-style similarity analysis. It is not Turnitin and not a plagiarism certification."],
  ["DOCX export", "Download DOCX, Markdown-ready content, and JSON research summaries from the workflow."],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-950 text-white">PA</span>
            <span className="text-lg">PaperAlpha</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#formats">Formats</a>
            <a href="#faq">About</a>
            <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
          <Link href="/generate" className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700">
            Start Writing <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-normal text-slate-950 md:text-7xl">
              PaperAlpha
            </h1>
            <p className="mt-5 max-w-2xl text-2xl font-medium text-slate-800 md:text-3xl">
              Turn your research into a publication-ready paper.
            </p>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Upload your research, code, experiments, results, figures and notes. PaperAlpha organizes your work into a structured academic paper.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800">
                Start Writing <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/generate?demo=1" className="inline-flex h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-900 hover:border-slate-400">
                Try Demo
              </Link>
            </div>
            <div className="mt-8 grid max-w-2xl gap-3 text-sm text-slate-700 sm:grid-cols-3">
              {["No permanent storage", "No paid API required", "Temporary processing"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-700" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <div className="grid gap-3 rounded-md bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <p className="text-sm font-semibold">Generation Wizard</p>
                  <p className="text-xs text-slate-400">From research to paper — intelligently.</p>
                </div>
                <Sparkles className="h-5 w-5 text-cyan-300" />
              </div>
              {["Research", "Materials", "Configuration", "Structure", "Instructions", "Generate"].map((step, index) => (
                <div key={step} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-md bg-white/[0.06] p-3">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-cyan-400 text-xs font-bold text-slate-950">{index + 1}</span>
                  <span className="text-sm font-medium">{step}</span>
                  <span className="text-xs text-slate-400">{index < 3 ? "Ready" : "Next"}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 md:grid-cols-4">
            {[
              [Microscope, "Analyze materials", "Static parsing for notebooks, code, CSV, notes, and image metadata."],
              [Search, "Search literature", "Adapters for OpenAlex and Crossref with review before citation."],
              [ShieldCheck, "Integrity checks", "Warnings for missing information, unsupported claims, and citation gaps."],
              [FileText, "Export DOCX", "Generate a Word document with sections, references, tables, and figures."],
            ].map(([Icon, title, copy]) => (
              <div key={String(title)} className="rounded-lg border border-slate-200 p-5">
                <Icon className="h-6 w-6 text-cyan-700" />
                <h2 className="mt-4 text-lg font-semibold">{title as string}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy as string}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-7xl px-5 py-16">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sections.map(([title, copy]) => (
              <article key={title} className="rounded-lg border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="mt-3 leading-7 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="formats" className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="text-3xl font-semibold">Built for research integrity.</h2>
              <p className="mt-4 leading-7 text-slate-300">
                PaperAlpha never claims guaranteed acceptance, Turnitin equivalence, or plagiarism-free certification. Missing information remains visible and citations must map to real reviewed sources.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {["IEEE", "Springer", "Elsevier", "ACM", "APA", "Nature"].map((format) => (
                <div key={format} className="rounded-md border border-white/10 bg-white/[0.06] p-4 text-sm font-semibold">{format}</div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-4xl px-5 py-16">
          <div className="flex items-start gap-4 rounded-lg border border-cyan-200 bg-cyan-50 p-6">
            <Lock className="mt-1 h-6 w-6 shrink-0 text-cyan-800" />
            <div>
              <h2 className="text-2xl font-semibold">Privacy and temporary processing</h2>
              <p className="mt-3 leading-7 text-slate-700">
                This MVP is stateless by default and does not create a database record for uploaded research. Files are processed for the current request and the browser can optionally keep a local draft on your own device.
              </p>
            </div>
          </div>
          <div className="mt-10 text-center">
            <h2 className="text-3xl font-semibold">From research to paper — intelligently.</h2>
            <Link href="/generate" className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-cyan-600 px-6 text-sm font-semibold text-white hover:bg-cyan-700">
              Start Writing <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
