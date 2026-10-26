/**
 * Honest evaluation protocol. Runs the real indexing + retrieval + Gemma
 * generation pipeline against the fixture corpus in
 * fixtures/permitted-sample-files and records what actually happened to
 * tests/evaluation/output/latest.md - grounded citations, unanswered
 * questions the model flagged, and any generation failures.
 *
 * Makes real local Ollama calls and uses a real Postgres database
 * (TEST_DATABASE_URL, defaults to alreadycovered_test), so it's a separate
 * Vitest invocation (`pnpm test:eval`), not part of the default unit/integration
 * run. If Ollama or the configured model is unavailable, it records that and
 * exits without pretending success.
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { describe, it } from "vitest";
import { runMigrations } from "../../apps/service/src/db/migrate.js";
import { ProfileRepository } from "../../apps/service/src/db/repositories/profiles.js";
import { SourceRepository } from "../../apps/service/src/db/repositories/sources.js";
import { LessonRepository } from "../../apps/service/src/db/repositories/lessons.js";
import { PacketRepository } from "../../apps/service/src/db/repositories/packets.js";
import { UserRepository } from "../../apps/service/src/db/repositories/users.js";
import { reconcileFixtureFiles } from "./fixtureIngest.js";
import { assemblePacket } from "../../apps/service/src/core/readiness.js";
import { generateInstructionForBlock } from "../../apps/service/src/core/generation.js";
import { OllamaClient, loadOllamaConfig } from "../../apps/service/src/ai/ollama.js";

const FIXTURE_ROOT = join(process.cwd(), "fixtures", "permitted-sample-files");
const OUTPUT_DIR = join(process.cwd(), "tests", "evaluation", "output");
const BASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/alreadycovered_test";

function writeReport(lines: string[]) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const path = join(OUTPUT_DIR, `run-${Date.now()}.md`);
  writeFileSync(path, lines.join("\n") + "\n");
  appendFileSync(join(OUTPUT_DIR, "latest.md"), lines.join("\n") + "\n\n---\n\n");
  console.log(`Evaluation report written to ${path}`);
}

describe("real-model evaluation", () => {
  it("runs the full pipeline against the fixture corpus using live Ollama", async () => {
    const ollama = new OllamaClient(loadOllamaConfig());
    const health = await ollama.checkHealth();

    const lines: string[] = [];
    lines.push(`# Evaluation run - ${new Date().toISOString()}`);
    lines.push("");
    lines.push(`Model tag: ${health.configuredModel}`);
    lines.push(`Model digest: ${health.digest ?? "unknown"}`);
    lines.push(`Ollama reachable: ${health.reachable}`);
    lines.push("");

    if (!health.reachable || !health.installedTag) {
      lines.push("**Result: SKIPPED.** Local Ollama / the configured model was not available in this environment.");
      lines.push(`Detail: ${health.error}`);
      writeReport(lines);
      console.log("Evaluation skipped - model unavailable. See report for detail.");
      return;
    }

    const pool = new pg.Pool({ connectionString: BASE_URL });
    await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
    await runMigrations(pool);
    const profiles = new ProfileRepository(pool);
    const sources = new SourceRepository(pool);
    const lessons = new LessonRepository(pool);
    const packets = new PacketRepository(pool);
    const users = new UserRepository(pool);

    const user = await users.createUser({ email: "evaluation@example.com", passwordHash: "x" });
    const profile = await profiles.createProfile({ userId: user.id, label: "Evaluation Class", grade: "4", timezone: "America/New_York", locale: "en-US" });
    await profiles.replaceSchedule(profile.id, [
      { weekday: 1, startMinute: 540, endMinute: 600, subject: "Mathematics", enabled: true },
      { weekday: 1, startMinute: 630, endMinute: 690, subject: "Reading", enabled: true },
    ]);

    const scan = await reconcileFixtureFiles(sources, { userId: user.id, root: FIXTURE_ROOT });
    lines.push(`## Indexing`);
    lines.push(`Files: ${scan.total}, parsed: ${scan.parsed}, failed: ${scan.failed}`);
    lines.push("");

    const localDate = "2026-11-02"; // known Monday
    const deps = { profiles, sources, lessons, packets };
    let assembled = await assemblePacket(deps, profile.id, user.id, localDate);

    lines.push(`## Retrieval (auto-matched via keyword + synonym retrieval, no manual linking)`);
    for (const block of assembled.blocks) {
      lines.push(`- ${block.timetableBlock.subject}: ${block.materialLinkId ? "linked" : "unlinked"}`);
    }
    lines.push("");

    lines.push(`## Generation (model tag ${health.installedTag})`);
    let totalCitations = 0;
    let parseFailures = 0;
    let generatedCount = 0;

    for (const block of assembled.blocks) {
      if (!block.needsGeneration) continue;
      const start = Date.now();
      const result = await generateInstructionForBlock({ profiles, sources, lessons, ollama }, { profileId: profile.id, userId: user.id, localDate, block: block.timetableBlock });
      const elapsedMs = Date.now() - start;

      if (!result.ok) {
        parseFailures += 1;
        lines.push(`- ${block.timetableBlock.subject}: FAILED (${result.errorCode}) after ${elapsedMs}ms - ${result.message}`);
        continue;
      }
      generatedCount += 1;
      const instruction = await lessons.getGeneratedInstruction(block.timetableBlock.id, localDate, block.blockFingerprint);
      const citedCount = instruction?.citedChunkIds.length ?? 0;
      totalCitations += citedCount;
      lines.push(
        `- ${block.timetableBlock.subject}: OK in ${elapsedMs}ms, ${instruction?.steps.length ?? 0} step(s), ${citedCount} grounded citation(s), ${instruction?.unsupportedQuestions.length ?? 0} unanswered question(s) flagged`,
      );
    }

    lines.push("");
    lines.push(`## Summary`);
    lines.push(`Blocks generated: ${generatedCount}, parse/generation failures: ${parseFailures}`);
    lines.push(`Citations offered as grounded: ${totalCitations} (generation.ts strips any citation outside the offered candidate set before saving)`);

    writeReport(lines);
    await pool.end();
    console.log(`Evaluation complete. ${generatedCount} generated, ${parseFailures} failed.`);
  });
});
