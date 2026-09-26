import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * Next.js dev mode hot-reloads modules, which would otherwise create a new
 * connection pool on every reload.
 */
const globalForPrisma = globalThis as unknown as { __researchPaperPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__researchPaperPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [{ emit: "event", level: "warn" }, { emit: "event", level: "error" }]
        : [{ emit: "event", level: "error" }],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__researchPaperPrisma = prisma;
}

export type Db = PrismaClient;
