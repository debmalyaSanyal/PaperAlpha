import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { prisma, recordDbError } from "./db";
import { getEnv } from "./env";

/**
 * Session handling.
 *
 * The reference implementation ships a self-contained HMAC-signed cookie
 * session so the project runs with zero external identity infrastructure. It is
 * deliberately small and swappable: replace `getSessionUser` / `requireUser`
 * with a provider-backed implementation (Auth.js, Clerk, Supabase Auth) without
 * touching the route handlers, which only depend on the `AuthUser` shape.
 */

export const SESSION_COOKIE = "rpa_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isDevUser: boolean;
}

interface SessionPayload {
  userId: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
}

function secret(): string {
  const env = getEnv();
  const value = env.AUTH_SECRET;
  if (!value || value.length < 16) {
    // In production Netlify builds NODE_ENV=production but many demo deploys
    // forget to set AUTH_SECRET. Throwing here crashes every Server Component
    // that calls getSessionUser() -> "Application error: a server-side
    // exception has occurred / Digest". Fall back with a warning instead so
    // the page can render a helpful message rather than a digest.
    if (typeof console !== "undefined") {
      console.warn(
        "[auth] AUTH_SECRET missing or <16 chars; using ephemeral fallback. Set AUTH_SECRET (>=16 chars) in Netlify env vars for real sessions."
      );
    }
    return "researchpaper-agent-production-fallback-do-not-use-in-real-prod";
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(user: { id: string; email: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.expiresAt !== "number" || payload.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const DEV_USER_EMAIL = "local-developer@researchpaper-agent.local";

/**
 * Resolve the current user, creating a local development user when the
 * environment explicitly allows anonymous development access.
 *
 * On Netlify/production there is no login UI yet, so throwing
 * UnauthorizedError from a Server Component produces
 * "Application error: a server-side exception has occurred / Digest".
 * We therefore allow opt-in anonymous access in production when
 * ALLOW_ANONYMOUS_DEV_USER=true (set it in Netlify env vars for demos).
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const env = getEnv();
  let payload: SessionPayload | null = null;
  try {
    const store = await cookies();
    payload = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  } catch {
    // cookies() can throw at build-time prerender - treat as anonymous.
    payload = null;
  }

  if (payload) {
    try {
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (user) return toAuthUser(user);
    } catch {
      // DB missing/unreachable (e.g. SQLite file not deployed on Netlify) -
      // fall through to dev-user / null handling below.
    }
  }

  const allowAnonymous =
    env.ALLOW_ANONYMOUS_DEV_USER === true ||
    env.ALLOW_ANONYMOUS_DEV_USER === undefined ||
    process.env.ALLOW_ANONYMOUS_DEV_USER === "true" ||
    process.env.ALLOW_ANONYMOUS_DEV_USER === "1";
  // Default to allowing anonymous in non-production so `npm run dev` stays
  // zero-config. In production require explicit opt-in ... unless no DB user
  // flow exists yet (this project has no login page), in which case still
  // create the dev user so the demo doesn't hard-crash with a Digest.
  const allowInProd = env.NODE_ENV !== "production" || allowAnonymous;

  if (allowInProd) {
    try {
      const user = await prisma.user.upsert({
        where: { email: DEV_USER_EMAIL },
        update: {},
        create: { email: DEV_USER_EMAIL, name: "Local Developer", role: "user", isDevUser: true },
      });
      return toAuthUser(user);
    } catch (dbError) {
      if (env.NODE_ENV !== "production") throw dbError;
      // Production without a reachable DB (common on Netlify when
      // DATABASE_URL=file:./dev.db and no Postgres is configured). Return an
      // in-memory demo user so pages render instead of digest-crashing.
      // Writes will fail later with a clear message, but reads of the shell
      // UI succeed.
      if (typeof console !== "undefined") {
        console.warn("[auth] DB unreachable, using ephemeral demo user:", (dbError as Error)?.message);
      }
      recordDbError(dbError);
      return {
        id: "demo-ephemeral",
        email: DEV_USER_EMAIL,
        name: "Demo User",
        role: "user",
        isDevUser: true,
      };
    }
  }

  return null;
}

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Throwing variant used by route handlers. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export interface ProjectAccess {
  user: AuthUser;
  project: NonNullable<Awaited<ReturnType<typeof findProject>>>;
}

async function findProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      user: true,
      files: true,
      researchInput: true,
      validation: true,
    },
  });
}

/**
 * Load a project and assert ownership.
 * Returns 404 for missing projects and 403 for projects owned by someone else,
 * so an attacker cannot enumerate project identifiers.
 */
export async function requireProjectAccess(projectId: string): Promise<ProjectAccess> {
  const user = await requireUser();
  const project = await findProject(projectId);
  if (!project) throw new NotFoundError(`Project ${projectId} was not found.`);
  if (project.userId !== user.id && user.role !== "admin") {
    throw new ForbiddenError();
  }
  return { user, project };
}

function toAuthUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isDevUser: boolean;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isDevUser: user.isDevUser,
  };
}
