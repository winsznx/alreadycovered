import { createReadStream } from "node:fs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "@alreadycovered/shared";
import type { AppContext } from "../context.js";
import { createRequireAuth } from "../auth/middleware.js";
import { assemblePacket } from "../core/readiness.js";
import { buildPacketView } from "../core/packetView.js";
import { generateInstructionForBlock } from "../core/generation.js";
import { exportPacket } from "../export/exportPacket.js";
import { isValidIsoDate } from "../core/schedule.js";
import { resolveUserStoragePath } from "../security/storage.js";

async function requireOwnedProfile(ctx: AppContext, userId: string) {
  const profile = await ctx.profiles.getByUserId(userId);
  if (!profile) throw new AppError("VALIDATION_ERROR", "Set up your class before preparing a packet.", { statusCode: 400 });
  return profile;
}

function deps(ctx: AppContext) {
  return { profiles: ctx.profiles, sources: ctx.sources, lessons: ctx.lessons, packets: ctx.packets };
}

/** Re-assembles the packet, then enqueues generation for any block that needs it. */
async function assembleAndQueueGeneration(ctx: AppContext, profileId: string, userId: string, localDate: string) {
  const assembled = await assemblePacket(deps(ctx), profileId, userId, localDate);

  const pendingBlocks = assembled.blocks.filter((b) => b.needsGeneration);
  for (const block of pendingBlocks) {
    // A caller (e.g. the dashboard) can request packet assembly again before
    // an earlier generation for this exact block+date has finished - without
    // this guard each call would enqueue its own redundant generation task,
    // burning real inference time on hardware where a single call already
    // takes 70-90+ seconds (see internal/VALIDATION.md).
    const key = `${block.timetableBlock.id}:${localDate}`;
    if (ctx.generationInFlight.has(key)) continue;
    ctx.generationInFlight.add(key);

    ctx.queue.enqueue(async () => {
      try {
        await ctx.events.publish(userId, "lesson.generating", { blockId: block.timetableBlock.id, subject: block.timetableBlock.subject }, undefined, assembled.packetId);
        const result = await generateInstructionForBlock(
          { profiles: ctx.profiles, sources: ctx.sources, lessons: ctx.lessons, ollama: ctx.ollama },
          { profileId, userId, localDate, block: block.timetableBlock },
        );
        if (!result.ok) {
          await ctx.events.publish(userId, "model.unavailable", { errorCode: result.errorCode, message: result.message }, undefined, assembled.packetId);
          return;
        }
        await ctx.events.publish(userId, "lesson.generated", { blockId: block.timetableBlock.id }, undefined, assembled.packetId);
        const refreshed = await assemblePacket(deps(ctx), profileId, userId, localDate);
        await ctx.events.publish(userId, "packet.updated", { state: refreshed.state }, undefined, refreshed.packetId);
      } finally {
        ctx.generationInFlight.delete(key);
      }
    });
  }

  return assembled;
}

export function registerPacketRoutes(app: FastifyInstance, ctx: AppContext): void {
  const requireAuth = createRequireAuth(ctx);

  app.post("/api/v1/packets", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ date: z.string() }).safeParse(request.body);
    if (!parsed.success || !isValidIsoDate(parsed.data.date)) {
      return reply.code(400).send(new AppError("VALIDATION_ERROR", "A valid ISO date is required.").toJSON());
    }
    const profile = await requireOwnedProfile(ctx, request.user!.id);
    const assembled = await assembleAndQueueGeneration(ctx, profile.id, request.user!.id, parsed.data.date);
    return reply.code(201).send(await buildPacketView(ctx, profile.id, request.user!.id, parsed.data.date, assembled));
  });

  app.get("/api/v1/packets/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await ctx.packets.getById(id);
    if (!existing) return reply.code(404).send(new AppError("PACKET_NOT_FOUND", "Packet not found.", { statusCode: 404 }).toJSON());
    const profile = await ctx.profiles.getProfile(existing.profileId);
    if (!profile || profile.userId !== request.user!.id) {
      return reply.code(404).send(new AppError("PACKET_NOT_FOUND", "Packet not found.", { statusCode: 404 }).toJSON());
    }
    const assembled = await assemblePacket(deps(ctx), existing.profileId, request.user!.id, existing.localDate);
    return buildPacketView(ctx, existing.profileId, request.user!.id, existing.localDate, assembled);
  });

  app.post("/api/v1/packets/:id/regenerate", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await ctx.packets.getById(id);
    if (!existing) return reply.code(404).send(new AppError("PACKET_NOT_FOUND", "Packet not found.", { statusCode: 404 }).toJSON());
    const profile = await ctx.profiles.getProfile(existing.profileId);
    if (!profile || profile.userId !== request.user!.id) {
      return reply.code(404).send(new AppError("PACKET_NOT_FOUND", "Packet not found.", { statusCode: 404 }).toJSON());
    }
    const assembled = await assembleAndQueueGeneration(ctx, existing.profileId, request.user!.id, existing.localDate);
    return reply.code(202).send(await buildPacketView(ctx, existing.profileId, request.user!.id, existing.localDate, assembled));
  });

  app.patch("/api/v1/packets/:id/blocks/:blockId", { preHandler: requireAuth }, async (request, reply) => {
    const { id, blockId } = request.params as { id: string; blockId: string };
    const existing = await ctx.packets.getById(id);
    if (!existing) return reply.code(404).send(new AppError("PACKET_NOT_FOUND", "Packet not found.", { statusCode: 404 }).toJSON());
    const profile = await ctx.profiles.getProfile(existing.profileId);
    if (!profile || profile.userId !== request.user!.id) {
      return reply.code(404).send(new AppError("PACKET_NOT_FOUND", "Packet not found.", { statusCode: 404 }).toJSON());
    }

    const parsed = z
      .object({
        expectedRevision: z.number().int(),
        summary: z.string().max(600).optional(),
        steps: z.array(z.string().min(1).max(400)).optional(),
        sourceFileId: z.string().nullable().optional(),
        exportPermission: z.enum(["approved", "excluded", "unreviewed"]).optional(),
        attributionText: z.string().optional(),
        note: z.string().max(2000).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(new AppError("VALIDATION_ERROR", parsed.error.message).toJSON());

    if (existing.revision !== parsed.data.expectedRevision) {
      return reply.code(409).send(new AppError("PACKET_REVISION_MISMATCH", "This packet changed since you loaded it. Refresh and try again.", { statusCode: 409 }).toJSON());
    }

    if (parsed.data.sourceFileId !== undefined) {
      if (parsed.data.sourceFileId) {
        const file = await ctx.sources.getByIdForUser(parsed.data.sourceFileId, request.user!.id);
        if (!file) return reply.code(404).send(new AppError("SOURCE_FILE_MISSING", "That file was not found.", { statusCode: 404 }).toJSON());
      }
      await ctx.lessons.upsertMaterialLink({
        timetableBlockId: blockId,
        localDate: existing.localDate,
        sourceFileId: parsed.data.sourceFileId,
        sourceChunkIds: parsed.data.sourceFileId ? (await ctx.sources.getChunks(parsed.data.sourceFileId)).map((c) => c.id) : [],
        status: parsed.data.sourceFileId ? "confirmed" : "rejected",
        rationale: "Teacher-selected material.",
        selectedBy: "teacher",
      });
      await ctx.lessons.saveOverride({ profileId: existing.profileId, timetableBlockId: blockId, localDate: existing.localDate, field: "material_link", valueJson: { sourceFileId: parsed.data.sourceFileId } });
    }
    if (parsed.data.exportPermission) {
      const link = await ctx.lessons.getMaterialLink(blockId, existing.localDate);
      if (link) await ctx.lessons.setExportPermission(link.id, parsed.data.exportPermission, parsed.data.attributionText);
    }
    if (parsed.data.summary !== undefined) {
      await ctx.lessons.saveOverride({ profileId: existing.profileId, timetableBlockId: blockId, localDate: existing.localDate, field: "summary", valueJson: parsed.data.summary });
    }
    if (parsed.data.steps !== undefined) {
      await ctx.lessons.saveOverride({ profileId: existing.profileId, timetableBlockId: blockId, localDate: existing.localDate, field: "steps", valueJson: parsed.data.steps });
    }
    if (parsed.data.note !== undefined) {
      await ctx.lessons.saveOverride({ profileId: existing.profileId, timetableBlockId: blockId, localDate: existing.localDate, field: "note", valueJson: parsed.data.note });
    }

    const assembled = await assembleAndQueueGeneration(ctx, existing.profileId, request.user!.id, existing.localDate);
    return buildPacketView(ctx, existing.profileId, request.user!.id, existing.localDate, assembled);
  });

  app.post("/api/v1/packets/:id/review", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await ctx.packets.getById(id);
    if (!existing) return reply.code(404).send(new AppError("PACKET_NOT_FOUND", "Packet not found.", { statusCode: 404 }).toJSON());
    const profile = await ctx.profiles.getProfile(existing.profileId);
    if (!profile || profile.userId !== request.user!.id) {
      return reply.code(404).send(new AppError("PACKET_NOT_FOUND", "Packet not found.", { statusCode: 404 }).toJSON());
    }

    const parsed = z.object({ expectedRevision: z.number().int(), sourceFingerprint: z.string(), confirmTeacherReview: z.literal(true) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(new AppError("VALIDATION_ERROR", parsed.error.message).toJSON());

    const assembled = await assemblePacket(deps(ctx), existing.profileId, request.user!.id, existing.localDate);
    if (assembled.revision !== parsed.data.expectedRevision || assembled.sourceFingerprint !== parsed.data.sourceFingerprint) {
      return reply.code(409).send(new AppError("PACKET_STALE", "Your source files changed after you reviewed this packet. Review the affected lesson again.", { statusCode: 409 }).toJSON());
    }
    if (assembled.issues.length > 0) {
      return reply.code(422).send(new AppError("PACKET_HAS_BLOCKING_ISSUES", "This packet still has unresolved items and cannot be marked reviewed.", { statusCode: 422 }).toJSON());
    }

    await ctx.packets.markReviewed(existing.id, assembled.revision, assembled.sourceFingerprint);
    const refreshed = await assemblePacket(deps(ctx), existing.profileId, request.user!.id, existing.localDate);
    return buildPacketView(ctx, existing.profileId, request.user!.id, existing.localDate, refreshed);
  });

  app.post("/api/v1/packets/:id/export", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await ctx.packets.getById(id);
    if (!existing) return reply.code(404).send(new AppError("PACKET_NOT_FOUND", "Packet not found.", { statusCode: 404 }).toJSON());
    const profile = await ctx.profiles.getProfile(existing.profileId);
    if (!profile || profile.userId !== request.user!.id) {
      return reply.code(404).send(new AppError("PACKET_NOT_FOUND", "Packet not found.", { statusCode: 404 }).toJSON());
    }

    const parsed = z.object({ confirmExportWithWarnings: z.boolean().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send(new AppError("VALIDATION_ERROR", parsed.error.message).toJSON());

    const assembled = await assemblePacket(deps(ctx), existing.profileId, request.user!.id, existing.localDate);

    const outcome = await exportPacket(
      { profiles: ctx.profiles, sources: ctx.sources, lessons: ctx.lessons },
      { profileId: existing.profileId, userId: request.user!.id, localDate: existing.localDate, assembled, confirmWithWarnings: parsed.data.confirmExportWithWarnings ?? false },
    );

    if (!outcome.ok) {
      const statusCode = outcome.errorCode === "PACKET_HAS_BLOCKING_ISSUES" ? 422 : 409;
      return reply.code(statusCode).send(new AppError(outcome.errorCode as never, outcome.message, { statusCode }).toJSON());
    }

    await ctx.exports.save(outcome.record);
    await ctx.events.publish(request.user!.id, "export.completed", { exportId: outcome.record.id }, undefined, existing.id);
    return reply.code(201).send({ export: outcome.record });
  });

  app.get("/api/v1/exports/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = await ctx.exports.getById(id);
    if (!record) return reply.code(404).send(new AppError("EXPORT_NOT_FOUND", "Export not found.", { statusCode: 404 }).toJSON());
    return { export: record };
  });

  app.get("/api/v1/exports/:id/download/:kind", { preHandler: requireAuth }, async (request, reply) => {
    const { id, kind } = request.params as { id: string; kind: "pdf" | "zip" };
    const record = await ctx.exports.getById(id);
    if (!record) return reply.code(404).send(new AppError("EXPORT_NOT_FOUND", "Export not found.", { statusCode: 404 }).toJSON());

    const packet = await ctx.packets.getById(record.packetId);
    const profile = packet ? await ctx.profiles.getProfile(packet.profileId) : null;
    if (!profile || profile.userId !== request.user!.id) {
      return reply.code(404).send(new AppError("EXPORT_NOT_FOUND", "Export not found.", { statusCode: 404 }).toJSON());
    }

    const storageKey = kind === "pdf" ? record.pdfStorageKey : kind === "zip" ? record.zipStorageKey : null;
    if (!storageKey) return reply.code(400).send(new AppError("VALIDATION_ERROR", "Unknown download kind.").toJSON());

    const { join } = await import("node:path");
    const absolutePath = resolveUserStoragePath(request.user!.id, join("exports", storageKey));
    reply.header("Content-Type", kind === "pdf" ? "application/pdf" : "application/zip");
    reply.header("Content-Disposition", `attachment; filename="${storageKey.split("/").pop()}"`);
    return reply.send(createReadStream(absolutePath));
  });
}
