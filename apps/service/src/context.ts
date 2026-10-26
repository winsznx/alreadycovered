import { getPool } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { ProfileRepository } from "./db/repositories/profiles.js";
import { SourceRepository } from "./db/repositories/sources.js";
import { LessonRepository } from "./db/repositories/lessons.js";
import { PacketRepository } from "./db/repositories/packets.js";
import { JobRepository, ActivityRepository } from "./db/repositories/jobs.js";
import { ExportRepository } from "./db/repositories/exports.js";
import { SettingsRepository } from "./db/repositories/settings.js";
import { UserRepository, SessionRepository } from "./db/repositories/users.js";
import { OllamaClient, loadOllamaConfig } from "./ai/ollama.js";
import { JobQueue } from "./jobs/queue.js";
import { EventsHub } from "./core/eventsHub.js";

export type AppContext = {
  pool: ReturnType<typeof getPool>;
  profiles: ProfileRepository;
  sources: SourceRepository;
  lessons: LessonRepository;
  packets: PacketRepository;
  jobs: JobRepository;
  activity: ActivityRepository;
  exports: ExportRepository;
  settings: SettingsRepository;
  users: UserRepository;
  sessions: SessionRepository;
  ollama: OllamaClient;
  queue: JobQueue;
  events: EventsHub;
  /** Dedup set for in-flight/queued generation tasks, keyed `${blockId}:${localDate}` -
   * prevents the same block being queued twice if the dashboard (or any caller)
   * requests packet assembly again before the first generation finishes. */
  generationInFlight: Set<string>;
};

let singleton: AppContext | null = null;

export async function createContext(): Promise<AppContext> {
  if (singleton) return singleton;
  const pool = getPool();
  await runMigrations(pool);

  const jobs = new JobRepository(pool);
  await jobs.reconcileInterruptedJobs();
  const activity = new ActivityRepository(pool);

  const ctx: AppContext = {
    pool,
    profiles: new ProfileRepository(pool),
    sources: new SourceRepository(pool),
    lessons: new LessonRepository(pool),
    packets: new PacketRepository(pool),
    jobs,
    activity,
    exports: new ExportRepository(pool),
    settings: new SettingsRepository(pool),
    users: new UserRepository(pool),
    sessions: new SessionRepository(pool),
    ollama: new OllamaClient(loadOllamaConfig()),
    queue: new JobQueue(),
    events: new EventsHub(activity),
    generationInFlight: new Set(),
  };
  singleton = ctx;
  return ctx;
}
