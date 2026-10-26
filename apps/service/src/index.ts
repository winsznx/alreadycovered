import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { AppError } from "@alreadycovered/shared";
import { createContext } from "./context.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerProfileRoutes } from "./routes/profile.js";
import { registerSourceRoutes } from "./routes/sources.js";
import { registerPacketRoutes } from "./routes/packets.js";

async function main(): Promise<void> {
  const ctx = await createContext();
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, trustProxy: true });

  // Frontend (Vercel) and backend (VPS) are different origins, so this is a
  // real cross-origin deployment - CORS must explicitly allow the configured
  // frontend origin with credentials (cookies) rather than the loopback
  // same-origin assumption of the local-first build.
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim());
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error("Origin not allowed"), false);
    },
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 20 } });

  app.addHook("onSend", (_request, reply, _payload, done) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    done();
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send(error.toJSON());
      return;
    }
    app.log.error(error);
    reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Something went wrong.", retryable: false } });
  });

  registerHealthRoutes(app, ctx);
  registerAuthRoutes(app, ctx);
  registerProfileRoutes(app, ctx);
  registerSourceRoutes(app, ctx);
  registerPacketRoutes(app, ctx);

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Not found.", retryable: false } });
  });

  const port = Number(process.env.PORT ?? process.env.ALREADY_COVERED_PORT ?? 4173);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`AlreadyCovered API listening on :${port}`);

  const shutdown = async () => {
    app.log.info("Shutting down gracefully...");
    await app.close();
    await ctx.pool.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
