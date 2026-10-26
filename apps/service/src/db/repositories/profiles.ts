import type pg from "pg";
import { ulid } from "ulid";
import type { ClassroomRoutine, DateOverride, TimetableBlock } from "@alreadycovered/shared";

export type ProfileWithMeta = {
  id: string;
  userId: string;
  label: string;
  grade: string;
  timezone: string;
  locale: string;
  teacherDisplayName?: string;
  scheduleRevision: number;
  routinesRevision: number;
  createdAt: string;
  updatedAt: string;
};

function rowToProfile(row: {
  id: string;
  user_id: string;
  label: string;
  grade: string;
  timezone: string;
  locale: string;
  teacher_display_name: string | null;
  schedule_revision: number;
  routines_revision: number;
  created_at: string;
  updated_at: string;
}): ProfileWithMeta {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    grade: row.grade,
    timezone: row.timezone,
    locale: row.locale,
    teacherDisplayName: row.teacher_display_name ?? undefined,
    scheduleRevision: row.schedule_revision,
    routinesRevision: row.routines_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProfileRepository {
  constructor(private readonly pool: pg.Pool) {}

  async createProfile(input: { userId: string; label: string; grade: string; timezone: string; locale: string; teacherDisplayName?: string }): Promise<ProfileWithMeta> {
    const id = ulid();
    const { rows } = await this.pool.query(
      `INSERT INTO profiles (id, user_id, label, grade, timezone, locale, teacher_display_name, schedule_revision, routines_revision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 1) RETURNING *`,
      [id, input.userId, input.label, input.grade, input.timezone, input.locale, input.teacherDisplayName ?? null],
    );
    return rowToProfile(rows[0]);
  }

  async getProfile(id: string): Promise<ProfileWithMeta | null> {
    const { rows } = await this.pool.query(`SELECT * FROM profiles WHERE id = $1`, [id]);
    return rows[0] ? rowToProfile(rows[0]) : null;
  }

  async getByUserId(userId: string): Promise<ProfileWithMeta | null> {
    const { rows } = await this.pool.query(`SELECT * FROM profiles WHERE user_id = $1`, [userId]);
    return rows[0] ? rowToProfile(rows[0]) : null;
  }

  async bumpScheduleRevision(id: string): Promise<number> {
    const { rows } = await this.pool.query(`UPDATE profiles SET schedule_revision = schedule_revision + 1, updated_at = now() WHERE id = $1 RETURNING schedule_revision`, [id]);
    return rows[0].schedule_revision;
  }

  async bumpRoutinesRevision(id: string): Promise<number> {
    const { rows } = await this.pool.query(`UPDATE profiles SET routines_revision = routines_revision + 1, updated_at = now() WHERE id = $1 RETURNING routines_revision`, [id]);
    return rows[0].routines_revision;
  }

  async replaceSchedule(profileId: string, blocks: Omit<TimetableBlock, "id" | "profileId">[]): Promise<TimetableBlock[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM timetable_blocks WHERE profile_id = $1`, [profileId]);
      for (const block of blocks) {
        await client.query(
          `INSERT INTO timetable_blocks (id, profile_id, weekday, start_minute, end_minute, subject, optional_teacher_notes, enabled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [ulid(), profileId, block.weekday, block.startMinute, block.endMinute, block.subject, block.optionalTeacherNotes ?? null, block.enabled],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await this.bumpScheduleRevision(profileId);
    return this.getSchedule(profileId);
  }

  async getSchedule(profileId: string): Promise<TimetableBlock[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM timetable_blocks WHERE profile_id = $1 ORDER BY weekday, start_minute`,
      [profileId],
    );
    return rows.map((r) => ({
      id: r.id,
      profileId: r.profile_id,
      weekday: r.weekday as TimetableBlock["weekday"],
      startMinute: r.start_minute,
      endMinute: r.end_minute,
      subject: r.subject,
      optionalTeacherNotes: r.optional_teacher_notes ?? undefined,
      enabled: r.enabled,
    }));
  }

  async getDateOverride(profileId: string, localDate: string): Promise<DateOverride | null> {
    const { rows } = await this.pool.query(`SELECT * FROM date_overrides WHERE profile_id = $1 AND local_date = $2`, [profileId, localDate]);
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, profileId: row.profile_id, localDate: row.local_date, kind: row.kind, blocks: row.blocks_json ?? undefined };
  }

  async setDateOverride(profileId: string, localDate: string, kind: DateOverride["kind"], blocks?: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO date_overrides (id, profile_id, local_date, kind, blocks_json)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (profile_id, local_date) DO UPDATE SET kind = $4, blocks_json = $5`,
      [ulid(), profileId, localDate, kind, blocks ? JSON.stringify(blocks) : null],
    );
  }

  async replaceRoutines(profileId: string, routines: Array<Omit<ClassroomRoutine, "id" | "profileId">>): Promise<ClassroomRoutine[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM routines WHERE profile_id = $1`, [profileId]);
      for (const routine of routines) {
        await client.query(
          `INSERT INTO routines (id, profile_id, category, title, text, teacher_verified_at, include_in_packet)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [ulid(), profileId, routine.category, routine.title, routine.text, routine.teacherVerifiedAt, routine.includeInPacket],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await this.bumpRoutinesRevision(profileId);
    return this.getRoutines(profileId);
  }

  async getRoutines(profileId: string): Promise<ClassroomRoutine[]> {
    const { rows } = await this.pool.query(`SELECT * FROM routines WHERE profile_id = $1`, [profileId]);
    return rows.map((r) => ({
      id: r.id,
      profileId: r.profile_id,
      category: r.category,
      title: r.title,
      text: r.text,
      teacherVerifiedAt: r.teacher_verified_at,
      includeInPacket: r.include_in_packet,
    }));
  }
}
