export type PaperFormat = "IEEE" | "Springer" | "Elsevier" | "ACM" | "APA" | "Nature" | "Custom";
export type CitationStyle = "IEEE" | "APA 7" | "MLA" | "Chicago" | "Harvard" | "Vancouver" | "Custom";

export interface ResearchMaterial {
  id: string;
  filename: string;
  fileType: string;
  size: number;
  status: "queued" | "processed" | "unsupported" | "error";
  summary?: string;
  extractedText?: string;
  warnings: string[];
}

export interface SourceTrace {
  sourceFile: string;
  cell?: number;
  line?: number;
  sheet?: string;
  context?: string;
}

export interface DetectedItem {
  label: string;
  value: string;
  trace: SourceTrace;
}

export interface Metric {
  name: string;
  value: string;
  sourceFile: string;
  cell?: number;
  line?: number;
  context?: string;
}

export interface Experiment {
  name: string;
  models: string[];
  metrics: Metric[];
  sourceFile: string;
  cell?: number;
  line?: number;
}

export interface Figure {
  id: string;
  title: string;
  caption: string;
  sourceFile: string;
  dimensions?: string;
}

export interface ResearchTable {
  id: string;
  title: string;
  caption: string;
  columns: string[];
  rows: string[][];
  sourceFile: string;
  trace?: SourceTrace;
}

export interface DatasetColumnAnalysis {
  name: string;
  type: "numeric" | "categorical" | "boolean" | "date" | "empty" | "mixed";
  missing: number;
  unique: number;
  mean?: number;
  min?: number;
  max?: number;
  standardDeviation?: number;
  topValues?: Array<{ value: string; count: number }>;
}

export interface DatasetAnalysis {
  filename: string;
  rows: number;
  columns: number;
  columnAnalyses: DatasetColumnAnalysis[];
  classBalance?: Array<{ label: string; count: number; percentage: number }>;
  correlations?: Array<{ a: string; b: string; value: number }>;
  chartSuggestions?: Array<{ title: string; type: "bar" | "histogram" | "correlation"; reason: string; columns: string[] }>;
  trace: SourceTrace;
}

export interface Reference {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  abstract?: string;
  doi?: string;
  url?: string;
  source: string;
}

export interface Citation {
  id: string;
  referenceId: string;
  marker: string;
  sectionKey?: string;
}

export interface ResearchBasics {
  title: string;
  topic: string;
  problem: string;
  objectives: string;
  questions: string;
  hypothesis: string;
  keywords: string;
  domain: string;
  summary: string;
}

export interface PaperConfiguration {
  format: PaperFormat;
  citationStyle: CitationStyle;
  language: "English";
  targetLength: string;
  paperType: string;
  sections: string[];
  additionalInstructions: string;
}

export interface ResearchAnalysis {
  title: string;
  domain: string;
  problem: string;
  objectives: string[];
  researchQuestions: string[];
  hypothesis?: string;
  keywords: string[];
  datasets: string[];
  datasetAnalyses: DatasetAnalysis[];
  importedLibraries: DetectedItem[];
  preprocessing: string[];
  featureEngineering: DetectedItem[];
  hyperparameters: DetectedItem[];
  configuration: DetectedItem[];
  algorithms: string[];
  models: string[];
  detectedModels: DetectedItem[];
  trainingProcedures: DetectedItem[];
  experiments: Experiment[];
  metrics: Metric[];
  results: DetectedItem[];
  figures: Figure[];
  tables: ResearchTable[];
  potentialIssues: DetectedItem[];
  limitations: string[];
  conclusions: string[];
  references: Reference[];
  sourceFiles: ResearchMaterial[];
  warnings: string[];
}

export interface PaperSection {
  key: string;
  title: string;
  content: string;
  citations: string[];
  warnings: string[];
  editable: boolean;
}

export interface ProviderWarning {
  provider: string;
  message: string;
  fallbackUsed: boolean;
}

export interface GeneratedPaper {
  title: string;
  abstract: string;
  keywords: string[];
  sections: PaperSection[];
  references: Reference[];
  citations: Citation[];
  tables: ResearchTable[];
  figures: Figure[];
  generatedBy: "MockAIProvider" | "FreeAIProvider" | "FreeModelProvider" | "OpenAIProvider" | "AnthropicProvider" | "GeminiProvider";
  providerWarning?: ProviderWarning;
}

export interface SimilarityMatch {
  passage: string;
  source: string;
  similarity: number;
}

export interface SimilarityResult {
  overall: number;
  matches: SimilarityMatch[];
  explanation: string;
}

export interface QualityReport {
  researchCompleteness: number;
  citationCoverage: number;
  sourceVerification: number;
  similarityEstimate: number;
  checks: { label: string; status: "pass" | "warning" | "fail"; detail: string }[];
}

export interface GenerationJob {
  basics: ResearchBasics;
  configuration: PaperConfiguration;
  analysis: ResearchAnalysis;
  literature: Reference[];
  demo?: boolean;
}
