import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@alreadycovered/shared";
import type { AppContext } from "../context.js";
import { resolveSession, SESSION_COOKIE_NAME } from "./service.js";
import type { User } from "../db/repositories/users.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}

export function createRequireAuth(ctx: AppContext) {
  return async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (!token) {
      reply.code(401).send(new AppError("VALIDATION_ERROR", "Sign in required.", { statusCode: 401 }).toJSON());
      return reply;
    }
    const user = await resolveSession({ users: ctx.users, sessions: ctx.sessions }, token);
    if (!user) {
      reply.code(401).send(new AppError("VALIDATION_ERROR", "Your session has expired. Please sign in again.", { statusCode: 401 }).toJSON());
      return reply;
    }
    request.user = user;
  };
}
