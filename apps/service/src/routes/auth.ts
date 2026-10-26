import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "@alreadycovered/shared";
import type { AppContext } from "../context.js";
import { cookieOptions, createSession, destroySession, registerUser, SESSION_COOKIE_NAME, verifyLogin } from "../auth/service.js";

const CredentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  displayName: z.string().max(120).optional(),
});

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  const authDeps = { users: ctx.users, sessions: ctx.sessions };

  app.post("/api/v1/auth/signup", async (request, reply) => {
    const parsed = CredentialsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(new AppError("VALIDATION_ERROR", parsed.error.message).toJSON());

    const user = await registerUser(authDeps, parsed.data.email, parsed.data.password, parsed.data.displayName);
    const { token, expiresAt } = await createSession(authDeps, user.id);
    reply.setCookie(SESSION_COOKIE_NAME, token, cookieOptions());
    return reply.code(201).send({ user: { id: user.id, email: user.email, displayName: user.displayName }, expiresAt: expiresAt.toISOString() });
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    const parsed = z.object({ email: z.string().min(1), password: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(new AppError("VALIDATION_ERROR", parsed.error.message).toJSON());

    const user = await verifyLogin(authDeps, parsed.data.email, parsed.data.password);
    const { token, expiresAt } = await createSession(authDeps, user.id);
    reply.setCookie(SESSION_COOKIE_NAME, token, cookieOptions());
    return { user: { id: user.id, email: user.email, displayName: user.displayName }, expiresAt: expiresAt.toISOString() };
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) await destroySession(authDeps, token);
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/api/v1/auth/me", async (request) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (!token) return { user: null };
    const user = await ctx.sessions.findValidByTokenHash
      ? await (await import("../auth/service.js")).resolveSession(authDeps, token)
      : null;
    return { user: user ? { id: user.id, email: user.email, displayName: user.displayName } : null };
  });
}
