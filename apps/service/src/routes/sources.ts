import { createReadStream } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AppError, SupportedExtensionSchema, type SupportedExtension } from "@alreadycovered/shared";
import type { AppContext } from "../context.js";
import { createRequireAuth } from "../auth/middleware.js";
import { getUploadsDir, resolveUserStoragePath } from "../security/storage.js";
import { ingestUploadedFile } from "../core/ingest.js";
import { MAX_SOURCE_FILE_BYTES } from "../core/extract.js";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

export function registerSourceRoutes(app: FastifyInstance, ctx: AppContext): void {
  const requireAuth = createRequireAuth(ctx);

  app.get("/api/v1/sources", { preHandler: requireAuth }, async (request) => {
    const { status } = request.query as { status?: string };
    const sources = (await ctx.sources.listActive(request.user!.id)).filter((s) => !status || s.status === status);
    return { sources };
  });

  app.get("/api/v1/sources/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = await ctx.sources.getByIdForUser(id, request.user!.id);
    if (!source) return reply.code(404).send(new AppError("NOT_FOUND", "Source not found.", { statusCode: 404 }).toJSON());
    return { source, chunks: await ctx.sources.getChunks(id) };
  });

  app.get("/api/v1/sources/:id/open", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = await ctx.sources.getByIdForUser(id, request.user!.id);
    if (!source) {
      return reply.code(404).send(new AppError("SOURCE_FILE_MISSING", "That file is no longer available.", { statusCode: 404 }).toJSON());
    }
    let absolutePath: string;
    try {
      absolutePath = resolveUserStoragePath(request.user!.id, join("uploads", source.relativePath));
    } catch (error) {
      if (error instanceof AppError) return reply.code(error.statusCode).send(error.toJSON());
      throw error;
    }
    reply.header("Content-Type", CONTENT_TYPES[source.extension] ?? "application/octet-stream");
    reply.header("Content-Disposition", `inline; filename="${source.displayName.replace(/"/g, "")}"`);
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(createReadStream(absolutePath));
  });

  app.delete("/api/v1/sources/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = await ctx.sources.getByIdForUser(id, request.user!.id);
    if (!source) return reply.code(404).send(new AppError("NOT_FOUND", "Source not found.", { statusCode: 404 }).toJSON());
    await ctx.sources.softDelete(id, request.user!.id);
    await ctx.events.publish(request.user!.id, "source.deleted", { sourceId: id });
    return { ok: true };
  });

  // Uploads replace local-folder watching: the teacher adds files directly
  // through the browser. Each file is validated (extension allowlist, size
  // cap), hashed, stored under this user's own storage directory, and
  // indexed immediately - no debounce/reconciliation needed for a discrete
  // upload event.
  app.post("/api/v1/sources/upload", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const parts = request.files();
    const uploaded: Array<{ sourceId: string; displayName: string; ok: boolean; errorCode?: string }> = [];

    for await (const part of parts) {
      const extension = extname(part.filename).toLowerCase();
      const parsedExtension = SupportedExtensionSchema.safeParse(extension);
      if (!parsedExtension.success) {
        uploaded.push({ sourceId: "", displayName: part.filename, ok: false, errorCode: "SOURCE_UNSUPPORTED_TYPE" });
        await part.file.resume();
        continue;
      }

      const buffer = await part.toBuffer();
      if (buffer.byteLength > MAX_SOURCE_FILE_BYTES) {
        uploaded.push({ sourceId: "", displayName: part.filename, ok: false, errorCode: "SOURCE_TOO_LARGE" });
        continue;
      }

      const storageKey = `${randomUUID()}${extension}`;
      const absolutePath = join(getUploadsDir(userId), storageKey);
      await writeFile(absolutePath, buffer);

      const result = await ingestUploadedFile(ctx.sources, {
        userId,
        absolutePath,
        storageKey,
        displayName: part.filename,
        extension: extension as SupportedExtension,
        buffer,
      });

      if (!result.ok) {
        await unlink(absolutePath).catch(() => {});
      }

      uploaded.push({ sourceId: result.sourceId, displayName: part.filename, ok: result.ok, errorCode: result.ok ? undefined : result.errorCode });
      await ctx.events.publish(userId, result.ok ? "file.indexed" : "file.failed", { sourceId: result.sourceId, displayName: part.filename });
    }

    return reply.code(201).send({ uploaded });
  });

  app.get("/api/v1/jobs", { preHandler: requireAuth }, async (request) => {
    return { jobs: await ctx.jobs.listRecentForUser(request.user!.id, 50) };
  });

  app.get("/api/v1/jobs/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await ctx.jobs.getById(id);
    if (!job) return reply.code(404).send(new AppError("NOT_FOUND", "Job not found.", { statusCode: 404 }).toJSON());
    return { job };
  });

  app.get("/api/v1/events", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    // Writing directly to the raw response bypasses Fastify's normal reply
    // pipeline, which is also where @fastify/cors and our security-headers
    // hook attach their headers via onSend - so this route must set its own
    // CORS headers or a cross-origin EventSource (the real deployment
    // topology: Vercel frontend, separate API origin) gets silently blocked
    // by the browser despite the server responding 200 (verified directly:
    // curl ignores CORS and sees the stream fine, a real browser does not).
    const origin = request.headers.origin;
    const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim());
    if (origin && allowedOrigins.includes(origin)) {
      reply.raw.setHeader("Access-Control-Allow-Origin", origin);
      reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
      reply.raw.setHeader("Vary", "Origin");
    }
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Content-Type-Options", "nosniff");
    reply.raw.setHeader("X-Frame-Options", "DENY");
    reply.raw.setHeader("Referrer-Policy", "no-referrer");
    reply.raw.flushHeaders();

    const unsubscribe = ctx.events.subscribe(userId, (event) => {
      reply.raw.write(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    reply.raw.write(": connected\n\n");
    const heartbeat = setInterval(() => reply.raw.write(": ping\n\n"), 20_000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
