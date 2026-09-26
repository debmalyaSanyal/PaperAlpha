import { getEnv } from "@/lib/env";
import { backendHeaders, type PipelineRequest, type PipelineResult, type PipelineStatus } from "./contract";

/**
 * HTTP client for the Python AI/DOCX worker service.
 *
 * All calls carry the shared secret in `X-Worker-Secret`; the worker only
 * accepts requests from the control plane. LLM provider keys live on the worker
 * and are never sent to the browser or through this channel.
 */

export class BackendError extends Error {
  constructor(
    message: string,
    readonly code: "UNAVAILABLE" | "AUTH" | "TIMEOUT" | "BAD_REQUEST" | "WORKER_ERROR",
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

export interface RegenerateSectionRequest {
  jobId: string;
  projectId: string;
  workspacePrefix: string;
  sectionKey: string;
  instructions?: string | null;
  targetWords?: number | null;
  language: string;
  format: { name: string; config: Record<string, unknown>; citationStyle: string };
  existingContent?: string | null;
  artifacts?: Record<string, unknown> | null;
}

export interface RegenerateSectionResponse {
  section: PipelineResult["sections"][number];
  warnings: string[];
}

export class BackendClient {
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; secret?: string; timeoutMs?: number }) {
    const env = getEnv();
    this.baseUrl = (options?.baseUrl ?? env.BACKEND_URL).replace(/\/+$/, "");
    this.secret = options?.secret ?? env.WORKER_SHARED_SECRET;
    this.timeoutMs = options?.timeoutMs ?? env.BACKEND_REQUEST_TIMEOUT_MS;
  }

  get isConfigured(): boolean {
    return Boolean(this.baseUrl && this.secret);
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: backendHeaders(this.secret),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
      const json = (await response.json()) as { status?: string; provider?: string };
      return { ok: true, detail: `status=${json.status ?? "unknown"} provider=${json.provider ?? "unknown"}` };
    } catch (error) {
      return { ok: false, detail: (error as Error).message };
    }
  }

  /** Start a pipeline run; returns as soon as the worker has accepted the job. */
  async startPipeline(request: PipelineRequest): Promise<{ accepted: boolean; jobId: string }> {
    return this.post<{ accepted: boolean; jobId: string }>("/pipeline/run", request, Math.min(this.timeoutMs, 60_000));
  }

  async getStatus(jobId: string): Promise<PipelineStatus> {
    return this.get<PipelineStatus>(`/pipeline/${encodeURIComponent(jobId)}/status`);
  }

  /** Blocking variant used by the CLI path and by tests. */
  async runPipelineAndWait(request: PipelineRequest, pollMs = 750): Promise<PipelineResult> {
    await this.startPipeline(request);
    return this.waitForCompletion(request.jobId, pollMs);
  }

  async waitForCompletion(jobId: string, pollMs = 750): Promise<PipelineResult> {
    const deadline = Date.now() + this.timeoutMs;
    for (;;) {
      if (Date.now() > deadline) {
        throw new BackendError(`Pipeline ${jobId} did not finish within ${this.timeoutMs} ms.`, "TIMEOUT", true);
      }
      const status = await this.getStatus(jobId);
      if (status.status === "SUCCEEDED" || status.status === "FAILED" || status.status === "CANCELLED") {
        return this.get<PipelineResult>(`/pipeline/${encodeURIComponent(jobId)}/result`);
      }
      await sleep(pollMs);
    }
  }

  async cancelPipeline(jobId: string): Promise<void> {
    await this.post(`/pipeline/${encodeURIComponent(jobId)}/cancel`, {});
  }

  async regenerateSection(request: RegenerateSectionRequest): Promise<RegenerateSectionResponse> {
    return this.post<RegenerateSectionResponse>("/pipeline/regenerate-section", request, this.timeoutMs);
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path, undefined, Math.min(this.timeoutMs, 120_000));
  }

  private async post<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>("POST", path, body, timeoutMs ?? this.timeoutMs);
  }

  private async request<T>(method: "GET" | "POST", path: string, body: unknown, timeoutMs: number): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: backendHeaders(this.secret),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new BackendError(`Worker request ${path} timed out after ${timeoutMs} ms.`, "TIMEOUT", true);
      }
      throw new BackendError(
        `Worker service is unreachable at ${this.baseUrl}: ${(error as Error).message}. Start it with "npm run backend:dev".`,
        "UNAVAILABLE",
        true,
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new BackendError(
        "Worker rejected the shared secret (check WORKER_SHARED_SECRET).",
        "AUTH",
        false,
        response.status,
      );
    }
    if (response.status === 400 || response.status === 422) {
      throw new BackendError(
        `Worker rejected the request: ${await bodyText(response)}`,
        "BAD_REQUEST",
        false,
        response.status,
      );
    }
    if (!response.ok) {
      throw new BackendError(
        `Worker error ${response.status}: ${await bodyText(response)}`,
        "WORKER_ERROR",
        response.status >= 500,
        response.status,
      );
    }

    return (await response.json()) as T;
  }
}

let client: BackendClient | null = null;

/** Shared client instance. */
export function getBackendClient(): BackendClient {
  if (!client) client = new BackendClient();
  return client;
}

export function resetBackendClient(): void {
  client = null;
}

async function bodyText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "(no body)";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
