# PaperAlpha

**Turn your research into a publication-ready paper.**

PaperAlpha is a zero-budget research-paper writing platform built with Next.js. It accepts research basics, notebooks, Python files, datasets, notes, figures, and literature sources, then turns them into a traceable, editable academic paper workflow with quality checks, similarity analysis, and DOCX export.

The app is designed to run without paid APIs, paid storage, paid authentication, or a database. By default it uses a clearly labeled `MockAIProvider` so the full workflow works in demo mode. A server-side `FreeAIProvider` adapter is included for optional free inference providers.

## What PaperAlpha Does

- Guides users through a complete research generation wizard.
- Temporarily analyzes uploaded research files.
- Extracts traceable evidence from `.ipynb`, `.py`, `.csv`, `.xlsx`, `.txt`, `.md`, `.json`, and images.
- Searches free literature sources through OpenAlex and Crossref.
- Generates paper sections one by one instead of sending one huge prompt.
- Maps citations to verified references.
- Shows quality warnings before export.
- Estimates local similarity without claiming official plagiarism certification.
- Exports DOCX from the generated paper.

## Core Workflow

```text
Landing Page
  -> Generation Wizard
  -> Research Basics
  -> Upload Research Materials
  -> Research Analysis
  -> Paper Configuration
  -> Literature Search
  -> Section-by-Section Generation
  -> Paper Workspace
  -> Quality + Similarity Checks
  -> DOCX Export
```

## Research Analysis

PaperAlpha performs static analysis only. It never executes uploaded notebooks or Python code.

### Jupyter Notebook Analysis

The notebook analyzer extracts:

- Markdown cells
- Code cells
- Outputs
- Table-like outputs
- Figure/image outputs
- Dataset references
- Imported libraries
- Preprocessing and feature engineering cues
- Models and algorithms
- Hyperparameters and configuration
- Training and evaluation procedures
- Metrics and numerical results
- Conclusions and summaries
- Source file and cell traceability

### Python Static Analysis

The Python analyzer extracts:

- Imports
- Functions and classes
- Comments
- Dataset loading references
- Model names
- Hyperparameters
- Configuration objects
- Training calls
- Evaluation calls
- Metrics and results
- Source file and line traceability

### CSV/XLSX Dataset Analysis

The dataset analyzer calculates:

- Row and column counts
- Column names
- Inferred data types
- Missing values
- Unique values
- Descriptive statistics for numeric columns
- Top categorical values
- Class balance when a target/label/outcome column is detected
- Correlations for complete numeric columns
- Chart suggestions when supported by real data

## AI Provider Architecture

PaperAlpha uses an `AIProvider` interface:

- `analyzeResearch`
- `generateOutline`
- `generateSection`
- `generateAbstract`
- `generateDiscussion`
- `generateConclusion`
- `generateReferences`
- `improveSection`

Implemented providers:

- `MockAIProvider`: default, free, demo-safe, clearly labeled.
- `FreeAIProvider`: optional server-side adapter for free inference endpoints.

The provider is selected with environment variables. API keys are never exposed to the browser.

## Literature and Citations

Free literature adapters are included for:

- OpenAlex
- Crossref

Every citation must map to a real reference object. Demo fallback references are clearly labeled and are not treated as verified academic sources.

Citation support currently prioritizes IEEE-style markers such as `[1]`, with structure ready for APA, Harvard, Vancouver, ACM, and Springer-style formatting.

## Quality Checks

Before export, PaperAlpha checks for:

- Missing sections
- Unsupported claims
- Missing citations
- Citation/reference mismatches
- Empty references
- Unused references
- Placeholder text
- Repeated content
- Suspicious numerical inconsistencies

## Similarity Analysis

PaperAlpha includes a local TF-style similarity estimate against supplied material and available source text. It is intentionally labeled as an estimate.

It is **not** Turnitin, not Copyleaks, and not an official plagiarism certification.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Lucide icons
- Vitest
- Vercel Free compatible

No database, Redis, object storage, billing system, authentication provider, or paid AI API is required.

## Project Structure

```text
app/
  page.tsx                  Landing page
  generate/page.tsx         Wizard and paper workspace
  workspace/page.tsx        Stateless workspace entry
  api/
    analyze/                Temporary research material analysis
    literature/             OpenAlex/Crossref search
    generate/               AI provider generation route
    similarity/             Local similarity estimate
    export/                 DOCX export

lib/
  ai/                       AIProvider, MockAIProvider, FreeAIProvider
  analysis/                 CSV/XLSX/research aggregation
  citations/                Citation manager
  export/                   DOCX builder
  literature/               Free literature providers
  parsing/                  Notebook/Python/file validation
  similarity/               Local similarity engine
  validation/               Quality checker

types/
  paperalpha.ts             Domain types

tests/
  utils.test.ts             Unit tests
```

## Environment Variables

Create `.env.local` locally or configure these in Vercel:

```env
AI_PROVIDER=mock
FREE_AI_API_URL=https://api-inference.huggingface.co/models
FREE_AI_API_KEY=
FREE_AI_MODEL=
OPENALEX_API_URL=https://api.openalex.org
CROSSREF_API_URL=https://api.crossref.org
SEMANTIC_SCHOLAR_API_URL=https://api.semanticscholar.org
NEXT_PUBLIC_APP_NAME=PaperAlpha
```

For a fully free no-key deployment, keep:

```env
AI_PROVIDER=mock
```

To try a free inference provider, set:

```env
AI_PROVIDER=free
FREE_AI_API_KEY=your_free_provider_key
FREE_AI_MODEL=your_model_id
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If port 3000 is busy:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3006
```

## Testing

```bash
npm run typecheck
npm run test
npm run build
```

The current suite covers:

- File validation
- Notebook parsing
- Python static analysis
- CSV analysis
- Citation mapping
- Literature provider contract
- Quality checking
- Similarity calculation
- DOCX package generation
- Format registry

## Vercel Deployment

1. Push this repository to GitHub.
2. Import it into Vercel.
3. Select the Next.js framework preset.
4. Use the default install and build commands:

```bash
npm install
npm run build
```

5. Add the environment variables above.
6. Deploy.

No database setup is required.

## Important Limitations

- PDF and DOCX deep text extraction are not implemented yet.
- XLSX analysis focuses on normal unencrypted workbook XML and the first worksheet.
- Free inference providers can be slow, unavailable, or rate-limited.
- The mock provider is intentionally demo-only and must not be presented as real AI output.
- Vercel Free has request size and execution time limits, so very large uploads may fail.
- Similarity analysis is a local estimate, not plagiarism certification.

## Research Integrity Principles

PaperAlpha is built around:

- Accuracy
- Traceability
- No fabricated experimental values
- No fabricated datasets
- No fabricated citations
- Clear separation between supplied evidence and generated explanation
- Temporary processing by default
- Free operation wherever possible

## License

MIT
