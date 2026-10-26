import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { AppError } from "@alreadycovered/shared";
import type { SessionRepository, UserRepository } from "../db/repositories/users.js";

export const SESSION_COOKIE_NAME = "ac_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BCRYPT_ROUNDS = 12;

export type AuthDeps = { users: UserRepository; sessions: SessionRepository };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerUser(deps: AuthDeps, email: string, password: string, displayName?: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("VALIDATION_ERROR", "Enter a valid email address.");
  }
  if (password.length < 8) {
    throw new AppError("VALIDATION_ERROR", "Password must be at least 8 characters.");
  }
  const existing = await deps.users.findByEmail(email);
  if (existing) {
    throw new AppError("VALIDATION_ERROR", "An account with that email already exists.", { statusCode: 409 });
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return deps.users.createUser({ email, passwordHash, displayName });
}

export async function verifyLogin(deps: AuthDeps, email: string, password: string) {
  const user = await deps.users.findByEmail(email);
  if (!user) {
    throw new AppError("VALIDATION_ERROR", "Incorrect email or password.", { statusCode: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AppError("VALIDATION_ERROR", "Incorrect email or password.", { statusCode: 401 });
  }
  return user;
}

/** Creates a new session and returns the raw token to set as a cookie (never store the raw token). */
export async function createSession(deps: AuthDeps, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await deps.sessions.create(userId, hashToken(token), expiresAt);
  return { token, expiresAt };
}

export async function resolveSession(deps: AuthDeps, token: string) {
  const session = await deps.sessions.findValidByTokenHash(hashToken(token));
  if (!session) return null;
  return deps.users.getById(session.userId);
}

export async function destroySession(deps: AuthDeps, token: string): Promise<void> {
  await deps.sessions.deleteByTokenHash(hashToken(token));
}

export function cookieOptions() {
  const crossSite = process.env.COOKIE_CROSS_SITE !== "false";
  return {
    httpOnly: true,
    secure: crossSite || process.env.NODE_ENV === "production",
    sameSite: crossSite ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  };
}
