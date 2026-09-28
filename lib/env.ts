import { z } from "zod";

/**
 * Server-side environment access.
 *
 * Never import this module from a Client Component: it reads secrets such as
 * API keys. Public values must be exposed through NEXT_PUBLIC_* and read
 * directly from `process.env` in client code.
 */

const booleanish = z
  .string()
  .optional()
  .transform((v) => (v === undefined ? undefined : ["1", "true", "yes", "on"].includes(v.toLowerCase())));

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1).default("file:./dev.db"),

  AUTH_SECRET: z.string().optional(),
  ALLOW_ANONYMOUS_DEV_USER: booleanish,

  LLM_PROVIDER: z.enum(["openai", "anthropic", "gemini", "mock"]).default("mock"),
  LLM_MODEL: z.string().optional(),
  LLM_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(8000),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).default(3),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_BASE_URL: z.string().optional(),

  CROSSREF_EMAIL: z.string().optional(),
  CROSSREF_BASE_URL: z.string().optional(),
  SEMANTIC_SCHOLAR_API_KEY: z.string().optional(),
  SEMANTIC_SCHOLAR_BASE_URL: z.string().optional(),
  OPENALEX_EMAIL: z.string().optional(),
  OPENALEX_BASE_URL: z.string().optional(),
  ARXIV_BASE_URL: z.string().optional(),
  LITERATURE_PROVIDERS: z.string().default("openalex,crossref,arxiv,semantic_scholar"),
  LITERATURE_CACHE_TTL_HOURS: z.coerce.number().int().positive().default(168),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_ROOT: z.string().default("./.storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_FORCE_PATH_STYLE: booleanish,
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  QUEUE_DRIVER: z.enum(["db", "redis"]).default("db"),
  QUEUE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  REDIS_URL: z.string().optional(),
  QUEUE_NAME: z.string().default("researchpaper-jobs"),

  BACKEND_URL: z.string().default("http://127.0.0.1:8000"),
  WORKER_SHARED_SECRET: z.string().default("dev-worker-secret-change-me"),
  BACKEND_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(1_800_000),

  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(64),
  MAX_FILES_PER_PROJECT: z.coerce.number().int().positive().default(60),
  ALLOWED_FILE_EXTENSIONS: z
    .string()
    .default(".ipynb,.py,.csv,.xlsx,.xls,.json,.pdf,.docx,.txt,.md,.png,.jpg,.jpeg"),

  JOB_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  JOB_STAGE_TIMEOUT_MS: z.coerce.number().int().positive().default(600_000),
  DOCX_MAX_REVISION_ITERATIONS: z.coerce.number().int().min(1).max(6).default(3),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${detail}\n\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: drop the memoized environment. */
export function resetEnvCache(): void {
  cached = null;
}

/**
 * True when running inside a serverless/edge host whose filesystem is
 * read-only except a per-invocation temp directory (Netlify functions, Vercel,
 * AWS Lambda). Used to relocate SQLite files and local upload storage.
 */
export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.NETLIFY ||
      process.env.NETLIFY_DEV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.VERCEL,
  );
}

export function allowedExtensions(): string[] {
  return getEnv()
    .ALLOWED_FILE_EXTENSIONS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function maxFileSizeBytes(): number {
  return getEnv().MAX_FILE_SIZE_MB * 1024 * 1024;
}

export function literatureProviders(): string[] {
  return getEnv()
    .LITERATURE_PROVIDERS.split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}
