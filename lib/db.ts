import { PrismaClient } from "@prisma/client";

import { getEnv } from "./env";

/**
 * Prisma client singleton.
 *
 * Next.js dev mode hot-reloads modules, which would otherwise create a new
 * connection pool on every reload.
 *
 * The client is created lazily (on first use, not at import time) so that
 * `next build` / Netlify prerender can import pages without a reachable
 * DATABASE_URL. A failed construction / connection surfaces later as a
 * catchable runtime error instead of a build-time "server-side exception".
 */
const globalForPrisma = globalThis as unknown as { __researchPaperPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const env = getEnv();
  // Netlify serverless FS is read-only except /tmp. A local `file:./dev.db`
  // URL works locally but can never persist / migrate on Netlify, and a
  // relative path resolves differently per lambda. Rewrite bare relative
  // sqlite URLs to /tmp so Prisma at least opens instead of throwing ENOENT
  // during prerender; real data needs a Postgres DATABASE_URL.
  const url = env.DATABASE_URL;
  if (url.startsWith("file:") && !url.startsWith("file:/tmp") && !url.startsWith("file://")) {
    const filePart = url.slice("file:".length).replace(/^\.\//, "");
    process.env.DATABASE_URL = `file:/tmp/${filePart.replace(/^\//, "")}`;
  }
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [{ emit: "event", level: "warn" }, { emit: "event", level: "error" }]
        : [{ emit: "event", level: "error" }],
  });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.__researchPaperPrisma) {
    globalForPrisma.__researchPaperPrisma = createClient();
  }
  return globalForPrisma.__researchPaperPrisma;
}

// Lazy proxy: `prisma.project.findMany(...)` constructs the real client on
// first property access, not at module import.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as unknown as Record<PropertyKey, unknown>, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Db = PrismaClient;
