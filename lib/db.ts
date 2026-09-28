import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Prisma, PrismaClient } from "@prisma/client";

import { SQLITE_SCHEMA_STATEMENTS } from "./generated/sqlite-schema";
import { isServerlessRuntime } from "./env";

/**
 * Prisma client singleton.
 *
 * Two problems are solved here, both of which used to surface on Netlify as
 * "Application error: a server-side exception has occurred (Digest: ...)":
 *
 * 1. Lazy construction. The client is created on first *use*, never at import
 *    time, so `next build` can prerender pages without a reachable database and
 *    a broken DATABASE_URL shows up as a catchable runtime error.
 * 2. Runtime SQLite bootstrap. Serverless lambdas have a read-only filesystem
 *    except /tmp, and /tmp is empty on every cold start — so a SQLite file
 *    created during the build does not exist at request time. Before the first
 *    model query we (a) point the file at /tmp on serverless hosts and
 *    (b) create the tables from the embedded DDL.
 */
const globalForPrisma = globalThis as unknown as {
  __researchPaperPrisma?: PrismaClient;
  __researchPaperPrismaSchema?: Promise<void>;
  __researchPaperPrismaError?: string;
};

/**
 * Remember the last database failure so a page can show the real cause instead
 * of a generic "database unreachable" message (Server Components cannot return
 * the error to the browser otherwise).
 */
export function recordDbError(message: unknown): void {
  const text = message instanceof Error ? message.message : String(message ?? "");
  if (text) globalForPrisma.__researchPaperPrismaError = text;
}

/** Last recorded database error, or null. Shown in the dashboard notice. */
export function lastDbError(): string | null {
  return globalForPrisma.__researchPaperPrismaError ?? null;
}

function dirIsWritable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.rpa-probe-${process.pid}`);
    writeFileSync(probe, "ok");
    rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

function tempDatabaseUrl(value: string): string {
  const base = path.basename(value.slice("file:".length)) || "app.db";
  return `file:/tmp/${base}`;
}

function resolveDatabaseUrl(raw: string): string {
  const value = raw.trim() || "file:./dev.db";
  if (!value.startsWith("file:")) return value;
  // Local development keeps the repo-relative file (prisma/dev.db).
  if (!isServerlessRuntime()) return value;
  // Already absolute / already inside tmp.
  if (value.startsWith("file://")) return value;
  const candidate = value.startsWith("file:/") ? value : tempDatabaseUrl(value);
  const dir = path.dirname(candidate.slice("file:".length));
  if (dirIsWritable(dir)) return candidate;
  // Read-only bundle directory: fall back to the writable /tmp filesystem.
  return tempDatabaseUrl(value);
}

/**
 * Load the generated Prisma client lazily.
 *
 * The import is intentionally deferred to first use: a static
 * `import { PrismaClient } from "@prisma/client"` is evaluated while the
 * Server Component module is being loaded, i.e. *before* the component body
 * runs. If the engine binary or generated client is missing from the lambda
 * bundle, that static import throws a module-evaluation error which no
 * try/catch inside the page can intercept - it surfaces as a bare
 * "Application error: a server-side exception has occurred (Digest: ...)".
 * Resolving it through require() moves the failure into the query path where
 * it is recorded and rendered as a helpful notice instead.
 */
function loadPrismaClientCtor(): new (options?: Prisma.PrismaClientOptions) => PrismaClient {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@prisma/client") as typeof import("@prisma/client");
    if (typeof mod.PrismaClient !== "function") {
      throw new Error("@prisma/client resolved but does not export a PrismaClient constructor");
    }
    return mod.PrismaClient;
  } catch (error) {
    const message = (error as Error)?.message ?? String(error);
    recordDbError(
      `Could not load @prisma/client: ${message}. This usually means the generated Prisma ` +
        `client or the query engine binary was not deployed to the function bundle.`,
    );
    throw error;
  }
}

function clientOptions(url: string): Prisma.PrismaClientOptions {
  return {
    datasourceUrl: url,
    log:
      process.env.NODE_ENV === "development"
        ? [{ emit: "event", level: "warn" }, { emit: "event", level: "error" }]
        : [{ emit: "event", level: "error" }],
  };
}

function getRawClient(): PrismaClient {
  if (!globalForPrisma.__researchPaperPrisma) {
    const url = resolveDatabaseUrl(process.env.DATABASE_URL ?? "");
    // Keep process.env in sync so the prisma CLI and logs see the same path.
    process.env.DATABASE_URL = url;
    const PrismaClientCtor = loadPrismaClientCtor();
    globalForPrisma.__researchPaperPrisma = new PrismaClientCtor(clientOptions(url));
  }
  return globalForPrisma.__researchPaperPrisma;
}

/** Make the embedded DDL idempotent so a partial run can be retried safely. */
function idempotent(statement: string): string {
  return statement
    .replace(/CREATE TABLE (?!IF NOT EXISTS)/g, "CREATE TABLE IF NOT EXISTS ")
    .replace(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/g, "CREATE $1INDEX IF NOT EXISTS ");
}

async function initializeSqliteSchema(client: PrismaClient, url: string): Promise<void> {
  if (!url.startsWith("file:")) return;

  const filePath = url.slice("file:".length).replace(/^\/\//, "/");
  try {
    mkdirSync(path.dirname(filePath), { recursive: true });
  } catch {
    /* best effort: the directory normally already exists (/tmp) */
  }

  const existing = await client.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'",
  );
  if (Array.isArray(existing) && existing.length > 0) return;

  for (const statement of SQLITE_SCHEMA_STATEMENTS) {
    await client.$executeRawUnsafe(idempotent(statement));
  }
  console.info(
    `[db] initialized SQLite schema at ${url} (${SQLITE_SCHEMA_STATEMENTS.length} statements). ` +
      "Serverless /tmp storage is ephemeral - set a Postgres DATABASE_URL for persistence.",
  );
}

/**
 * Resolve (once per process) with the database ready for queries. Failures are
 * logged and swallowed so pages can render a helpful notice instead of an
 * opaque Digest crash; the memo is cleared so a later request retries.
 */
export function ensureDbReady(): Promise<void> {
  if (!globalForPrisma.__researchPaperPrismaSchema) {
    const client = getRawClient();
    const url = process.env.DATABASE_URL ?? "";
    globalForPrisma.__researchPaperPrismaSchema = initializeSqliteSchema(client, url).catch((error) => {
      globalForPrisma.__researchPaperPrismaSchema = undefined;
      recordDbError(error);
      console.warn("[db] schema bootstrap failed:", (error as Error)?.message ?? error);
    });
  }
  return globalForPrisma.__researchPaperPrismaSchema;
}

/** Client methods that hit the database and therefore need the schema first. */
const SCHEMA_DEPENDENT_METHODS = new Set([
  "$transaction",
  "$queryRaw",
  "$queryRawUnsafe",
  "$executeRaw",
  "$executeRawUnsafe",
]);

type AnyFunction = (...args: unknown[]) => unknown;

/**
 * Model delegates (`prisma.user`, `prisma.project`, ...) are plain objects, so
 * each query is wrapped to await `ensureDbReady()` first. Call sites stay
 * unchanged.
 */
function wrapDelegate(delegate: object): object {
  return new Proxy(delegate, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        await ensureDbReady();
        return (value as AnyFunction).apply(target, args);
      };
    },
  });
}

// Lazy proxy: `prisma.project.findMany(...)` constructs the real client on
// first property access, not at module import.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (prop === "then") return undefined;
    const client = getRawClient();
    const value = Reflect.get(client as unknown as Record<PropertyKey, unknown>, prop, receiver);

    if (typeof value === "function") {
      if (typeof prop === "string" && SCHEMA_DEPENDENT_METHODS.has(prop)) {
        return async (...args: unknown[]) => {
          await ensureDbReady();
          return (value as AnyFunction).apply(client, args);
        };
      }
      return (value as AnyFunction).bind(client);
    }

    // Model delegates are objects — wrap them for the schema guard.
    if (value && typeof value === "object") return wrapDelegate(value as object);
    return value;
  },
});

export type Db = PrismaClient;
