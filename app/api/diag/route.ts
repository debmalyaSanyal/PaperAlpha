import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { isServerlessRuntime } from "@/lib/env";

/**
 * Deployment health probe.
 *
 * Renders `200` with a JSON report instead of crashing, so a broken lambda
 * bundle (missing Prisma engine, read-only /tmp, bad DATABASE_URL) can be
 * diagnosed from the browser without digging through function logs. Every
 * check is individually guarded - this endpoint must never return a digest.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function probeWritableDir(dir: string): { dir: string; writable: boolean; error: string | null } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mkdirSync, writeFileSync, rmSync } = require("node:fs") as typeof import("node:fs");
    mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.probe-${process.pid}`);
    writeFileSync(probe, "ok");
    rmSync(probe, { force: true });
    return { dir, writable: true, error: null };
  } catch (error) {
    return { dir, writable: false, error: (error as Error)?.message ?? String(error) };
  }
}

function listDir(dir: string): string[] {
  try {
    return readdirSync(dir).slice(0, 40);
  } catch (error) {
    return [`<unreadable: ${(error as Error)?.message}>`];
  }
}

export async function GET() {
  try {
    return await buildReport();
  } catch (error) {
    // A diagnostic endpoint that throws is worse than useless - always answer 200.
    const message = (error as Error)?.message ?? String(error);
    return new Response(JSON.stringify({ ok: false, error: message }, null, 2), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
}

async function buildReport() {
  const report: Record<string, unknown> = {
    ok: true,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    isServerlessRuntime: isServerlessRuntime(),
    tmpdir: os.tmpdir(),
    env: {
      NODE_ENV: process.env.NODE_ENV ?? null,
      NETLIFY: process.env.NETLIFY ?? null,
      AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME ?? null,
      LAMBDA_TASK_ROOT: process.env.LAMBDA_TASK_ROOT ?? null,
      DATABASE_URL: process.env.DATABASE_URL ? "(set)" : "(unset)",
      AUTH_SECRET: process.env.AUTH_SECRET ? "(set)" : "(unset)",
      ALLOW_ANONYMOUS_DEV_USER: process.env.ALLOW_ANONYMOUS_DEV_USER ?? null,
    },
    filesystem: {
      tmp: probeWritableDir("/tmp"),
      bundleWritable: probeWritableDir(process.cwd()),
    },
    engineFiles: {
      prismaClientGenerated: listDir(path.join(process.cwd(), "node_modules/.prisma/client")),
      engines: listDir(path.join(process.cwd(), "node_modules/@prisma/engines")),
    },
  };

  // A real query against a real client - the exact call the dashboard makes.
  const url = process.env.DATABASE_URL ?? "";
  const query: Record<string, unknown> = { url: url || "(unset)" };
  try {
    const client = new PrismaClient({ datasourceUrl: url || "file:/tmp/paperalpha-prod.db" });
    try {
      const rows = await client.$queryRawUnsafe<Array<{ ok: number }>>("SELECT 1 AS ok");
      query.result = "ok";
      query.rows = rows;
    } finally {
      await client.$disconnect();
    }
  } catch (error) {
    query.result = "error";
    query.error = (error as Error)?.message ?? String(error);
    query.stack = String((error as Error)?.stack ?? "").split("\n").slice(0, 6).join("\n");
  }
  report.query = query;

  return new Response(
    // SQLite hands back BigInt for raw scalars, which JSON.stringify rejects.
    JSON.stringify(report, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    },
  );
}
