import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "@alreadycovered/shared";
import type { AppContext } from "../context.js";
import { createRequireAuth } from "../auth/middleware.js";
import { validateNoOverlaps } from "../core/schedule.js";

const ScheduleBlockInput = z.object({
  weekday: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  subject: z.string().min(1).max(120),
  optionalTeacherNotes: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
});

const RoutineInput = z.object({
  category: z.enum(["arrival", "transitions", "materials", "dismissal", "other"]),
  title: z.string().min(1).max(120),
  text: z.string().min(1).max(2000),
  verified: z.boolean(),
  includeInPacket: z.boolean(),
});

const CreateProfileSchema = z.object({
  label: z.string().min(1).max(120),
  grade: z.string().min(1).max(40),
  timezone: z.string().min(1),
  locale: z.string().min(1).default("en-US"),
  teacherDisplayName: z.string().max(120).optional(),
  schedule: z.array(ScheduleBlockInput).min(1),
});

async function requireOwnedProfile(ctx: AppContext, userId: string) {
  const profile = await ctx.profiles.getByUserId(userId);
  if (!profile) throw new AppError("NOT_FOUND", "No class is set up yet.", { statusCode: 404 });
  return profile;
}

export function registerProfileRoutes(app: FastifyInstance, ctx: AppContext): void {
  const requireAuth = createRequireAuth(ctx);

  app.get("/api/v1/settings", { preHandler: requireAuth }, async (request) => {
    const profile = await ctx.profiles.getByUserId(request.user!.id);
    const modelHealth = await ctx.ollama.checkHealth();
    if (!profile) return { setupComplete: false, modelHealth };
    return {
      setupComplete: true,
      profile: { id: profile.id, label: profile.label, grade: profile.grade, timezone: profile.timezone, locale: profile.locale, teacherDisplayName: profile.teacherDisplayName },
      modelHealth,
    };
  });

  app.post("/api/v1/profile", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CreateProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(new AppError("VALIDATION_ERROR", parsed.error.message).toJSON());

    try {
      validateNoOverlaps(parsed.data.schedule);
    } catch (error) {
      if (error instanceof AppError) return reply.code(error.statusCode).send(error.toJSON());
      throw error;
    }

    const existing = await ctx.profiles.getByUserId(request.user!.id);
    if (existing) {
      return reply.code(409).send(new AppError("VALIDATION_ERROR", "A class is already set up for this account.", { statusCode: 409 }).toJSON());
    }

    const profile = await ctx.profiles.createProfile({
      userId: request.user!.id,
      label: parsed.data.label,
      grade: parsed.data.grade,
      timezone: parsed.data.timezone,
      locale: parsed.data.locale,
      teacherDisplayName: parsed.data.teacherDisplayName,
    });
    await ctx.profiles.replaceSchedule(profile.id, parsed.data.schedule.map((b) => ({ ...b, enabled: b.enabled ?? true })));

    return reply.code(201).send({ profileId: profile.id });
  });

  app.get("/api/v1/profiles/:id/schedule", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const profile = await requireOwnedProfile(ctx, request.user!.id);
    if (profile.id !== id) return reply.code(403).send(new AppError("VALIDATION_ERROR", "Not your class.", { statusCode: 403 }).toJSON());
    return { scheduleRevision: profile.scheduleRevision, blocks: await ctx.profiles.getSchedule(id) };
  });

  app.put("/api/v1/profiles/:id/schedule", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const profile = await requireOwnedProfile(ctx, request.user!.id);
    if (profile.id !== id) return reply.code(403).send(new AppError("VALIDATION_ERROR", "Not your class.", { statusCode: 403 }).toJSON());

    const parsed = z.array(ScheduleBlockInput).min(1).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(new AppError("VALIDATION_ERROR", parsed.error.message).toJSON());
    try {
      validateNoOverlaps(parsed.data);
    } catch (error) {
      if (error instanceof AppError) return reply.code(error.statusCode).send(error.toJSON());
      throw error;
    }

    const blocks = await ctx.profiles.replaceSchedule(id, parsed.data.map((b) => ({ ...b, enabled: b.enabled ?? true })));
    const updated = await ctx.profiles.getProfile(id);
    return { scheduleRevision: updated!.scheduleRevision, blocks };
  });

  app.get("/api/v1/profiles/:id/routines", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const profile = await requireOwnedProfile(ctx, request.user!.id);
    if (profile.id !== id) return reply.code(403).send(new AppError("VALIDATION_ERROR", "Not your class.", { statusCode: 403 }).toJSON());
    return { routinesRevision: profile.routinesRevision, routines: await ctx.profiles.getRoutines(id) };
  });

  app.put("/api/v1/profiles/:id/routines", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const profile = await requireOwnedProfile(ctx, request.user!.id);
    if (profile.id !== id) return reply.code(403).send(new AppError("VALIDATION_ERROR", "Not your class.", { statusCode: 403 }).toJSON());

    const parsed = z.array(RoutineInput).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(new AppError("VALIDATION_ERROR", parsed.error.message).toJSON());

    const now = new Date().toISOString();
    const routines = await ctx.profiles.replaceRoutines(
      id,
      parsed.data.map((r) => ({ category: r.category, title: r.title, text: r.text, teacherVerifiedAt: r.verified ? now : null, includeInPacket: r.includeInPacket })),
    );
    const updated = await ctx.profiles.getProfile(id);
    return { routinesRevision: updated!.routinesRevision, routines };
  });

  app.post("/api/v1/models/test", { preHandler: requireAuth }, async () => {
    return ctx.ollama.checkHealth();
  });

  app.put("/api/v1/profiles/:id/date-overrides/:date", { preHandler: requireAuth }, async (request, reply) => {
    const { id, date } = request.params as { id: string; date: string };
    const profile = await requireOwnedProfile(ctx, request.user!.id);
    if (profile.id !== id) return reply.code(403).send(new AppError("VALIDATION_ERROR", "Not your class.", { statusCode: 403 }).toJSON());

    const parsed = z.object({ kind: z.enum(["no_school", "block_override"]), blocks: z.array(ScheduleBlockInput).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(new AppError("VALIDATION_ERROR", parsed.error.message).toJSON());
    await ctx.profiles.setDateOverride(id, date, parsed.data.kind, parsed.data.blocks);
    return { ok: true };
  });
}
