import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { prisma } from "./db";
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
    if (env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET must be set to a value of at least 16 characters in production. See .env.example.",
      );
    }
    // Development fallback keeps local setup friction-free.
    return "researchpaper-agent-development-secret";
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
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const env = getEnv();
  const store = await cookies();
  const payload = verifySessionToken(store.get(SESSION_COOKIE)?.value);

  if (payload) {
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user) return toAuthUser(user);
  }

  if (env.ALLOW_ANONYMOUS_DEV_USER !== false && env.NODE_ENV !== "production") {
    const user = await prisma.user.upsert({
      where: { email: DEV_USER_EMAIL },
      update: {},
      create: { email: DEV_USER_EMAIL, name: "Local Developer", role: "user", isDevUser: true },
    });
    return toAuthUser(user);
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
