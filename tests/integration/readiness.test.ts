import pg from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../apps/service/src/db/migrate.js";
import { ProfileRepository } from "../../apps/service/src/db/repositories/profiles.js";
import { SourceRepository } from "../../apps/service/src/db/repositories/sources.js";
import { LessonRepository } from "../../apps/service/src/db/repositories/lessons.js";
import { PacketRepository } from "../../apps/service/src/db/repositories/packets.js";
import { UserRepository } from "../../apps/service/src/db/repositories/users.js";
import { assemblePacket } from "../../apps/service/src/core/readiness.js";

// Requires a local Postgres reachable at TEST_DATABASE_URL (defaults to a
// dedicated test DB used throughout this build - `createdb alreadycovered_test`).
// The whole public schema is dropped and recreated before each test, so
// tests never see each other's rows. Tests in this file run sequentially
// (Vitest's default within one describe block), which this relies on.
const BASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/alreadycovered_test";

function makeDeps(pool: pg.Pool) {
  return {
    pool,
    profiles: new ProfileRepository(pool),
    sources: new SourceRepository(pool),
    lessons: new LessonRepository(pool),
    packets: new PacketRepository(pool),
    users: new UserRepository(pool),
  };
}

const MONDAY = "2026-11-02"; // known Monday, see schedule.test.ts

describe("assemblePacket", () => {
  let pool: pg.Pool;
  let deps: ReturnType<typeof makeDeps>;
  let userId: string;
  let profileId: string;

  beforeEach(async () => {
    // #given a freshly reset database with one profile and a Monday Mathematics block
    pool = new pg.Pool({ connectionString: BASE_URL });
    await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
    await runMigrations(pool);
    deps = makeDeps(pool);

    const user = await deps.users.createUser({ email: `${randomUUID()}@example.com`, passwordHash: "x" });
    userId = user.id;
    const profile = await deps.profiles.createProfile({ userId, label: "Grade 4A", grade: "4", timezone: "America/New_York", locale: "en-US" });
    profileId = profile.id;
    await deps.profiles.replaceSchedule(profileId, [{ weekday: 1, startMinute: 540, endMinute: 600, subject: "Mathematics", enabled: true }]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("marks the packet needs_attention when no source material is indexed", async () => {
    // #when assembling a packet for that Monday
    const assembled = await assemblePacket(deps, profileId, userId, MONDAY);
    // #then it reports a missing-material issue and the needs_attention state
    expect(assembled.state).toBe("needs_attention");
    expect(assembled.issues.some((i) => i.code === "SOURCE_FILE_MISSING")).toBe(true);
  });

  it("produces an empty, issue-free packet on a day with no scheduled blocks", async () => {
    // #when assembling a packet for Tuesday, which has no timetable block configured
    const assembled = await assemblePacket(deps, profileId, userId, "2026-11-03");
    // #then there are no blocks and no issues
    expect(assembled.blocks).toHaveLength(0);
    expect(assembled.issues).toHaveLength(0);
  });

  it("flags SOURCE_FILE_MISSING as blocking once a previously linked file disappears", async () => {
    // #given an indexed source file confirmed as the Mathematics material
    const source = await deps.sources.create({ userId, storageKey: "worksheet.pdf", displayName: "worksheet.pdf", extension: ".pdf", sizeBytes: 100, sha256: "a".repeat(64) });
    await deps.sources.markStatus(source.id, "indexed");
    const first = await assemblePacket(deps, profileId, userId, MONDAY);
    const blockId = first.blocks[0]!.timetableBlock.id;
    await deps.lessons.upsertMaterialLink({ timetableBlockId: blockId, localDate: MONDAY, sourceFileId: source.id, sourceChunkIds: [], status: "confirmed", rationale: "teacher confirmed", selectedBy: "teacher" });

    // #when the linked file is deleted and the packet is re-assembled
    await deps.sources.softDelete(source.id, userId);
    const second = await assemblePacket(deps, profileId, userId, MONDAY);

    // #then the missing-source issue is now blocking severity
    const issue = second.issues.find((i) => i.code === "SOURCE_FILE_MISSING");
    expect(issue?.severity).toBe("blocking");
  });

  it("keeps the packet id and increments revision across a fingerprint-changing re-assembly", async () => {
    // #given an initial assembly
    const first = await assemblePacket(deps, profileId, userId, MONDAY);

    // #when the schedule changes (which changes the fingerprint) and we re-assemble
    await deps.profiles.replaceSchedule(profileId, [{ weekday: 1, startMinute: 540, endMinute: 630, subject: "Mathematics", enabled: true }]);
    const second = await assemblePacket(deps, profileId, userId, MONDAY);

    // #then the packet id is stable but the revision increased
    expect(second.packetId).toBe(first.packetId);
    expect(second.revision).toBeGreaterThan(first.revision);
  });

  it("does not bump the revision when nothing relevant changed", async () => {
    // #given two assemblies back to back with no changes in between
    const first = await assemblePacket(deps, profileId, userId, MONDAY);
    // #when re-assembling again with identical state
    const second = await assemblePacket(deps, profileId, userId, MONDAY);
    // #then the revision is unchanged (idempotent re-assembly)
    expect(second.revision).toBe(first.revision);
  });
});
