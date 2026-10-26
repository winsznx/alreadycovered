import type pg from "pg";
import { ulid } from "ulid";
import type { Job, JobState, JobType } from "@alreadycovered/shared";

function rowToJob(row: {
  id: string;
  type: string;
  state: string;
  payload_json: unknown;
  stage: string | null;
  processed_count: number | null;
  total_count: number | null;
  error_code: string | null;
  error_message: string | null;
  retryable: boolean | null;
  created_at: string;
  updated_at: string;
}): Job {
  return {
    id: row.id,
    type: row.type as JobType,
    state: row.state as JobState,
    payloadJson: row.payload_json,
    stage: row.stage ?? undefined,
    processedCount: row.processed_count ?? undefined,
    totalCount: row.total_count ?? undefined,
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    retryable: !!row.retryable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class JobRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(type: JobType, payload: unknown, userId?: string): Promise<Job> {
    const id = ulid();
    const { rows } = await this.pool.query(
      `INSERT INTO jobs (id, user_id, type, state, payload_json) VALUES ($1, $2, $3, 'queued', $4) RETURNING *`,
      [id, userId ?? null, type, JSON.stringify(payload ?? {})],
    );
    return rowToJob(rows[0]);
  }

  async getById(id: string): Promise<Job | null> {
    const { rows } = await this.pool.query(`SELECT * FROM jobs WHERE id = $1`, [id]);
    return rows[0] ? rowToJob(rows[0]) : null;
  }

  async listRecentForUser(userId: string, limit = 50): Promise<Job[]> {
    const { rows } = await this.pool.query(`SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`, [userId, limit]);
    return rows.map(rowToJob);
  }

  async update(
    id: string,
    patch: Partial<{
      state: JobState;
      stage: string;
      processedCount: number;
      totalCount: number;
      errorCode: string | null;
      errorMessage: string | null;
      retryable: boolean;
    }>,
  ): Promise<void> {
    const current = await this.getById(id);
    if (!current) return;
    await this.pool.query(
      `UPDATE jobs SET state=$1, stage=$2, processed_count=$3, total_count=$4, error_code=$5, error_message=$6, retryable=$7, updated_at=now() WHERE id=$8`,
      [
        patch.state ?? current.state,
        patch.stage ?? current.stage ?? null,
        patch.processedCount ?? current.processedCount ?? 0,
        patch.totalCount ?? current.totalCount ?? 0,
        patch.errorCode === undefined ? current.errorCode ?? null : patch.errorCode,
        patch.errorMessage === undefined ? current.errorMessage ?? null : patch.errorMessage,
        patch.retryable ?? current.retryable ?? false,
        id,
      ],
    );
  }

  /** Marks jobs stuck in 'running'/'queued' from a prior process as failed/retryable (restart reconciliation). */
  async reconcileInterruptedJobs(): Promise<void> {
    await this.pool.query(
      `UPDATE jobs SET state = 'failed', error_code = 'INTERRUPTED', error_message = 'Service restarted before this job finished.', retryable = true, updated_at = now() WHERE state IN ('queued','running')`,
    );
  }
}

export class ActivityRepository {
  constructor(private readonly pool: pg.Pool) {}

  async append(userId: string | undefined, type: string, payload: Record<string, unknown>, jobId?: string, packetId?: string): Promise<number> {
    const { rows } = await this.pool.query<{ next_seq: number }>(
      `SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM activity_log WHERE user_id = $1`,
      [userId ?? null],
    );
    const seq = rows[0]!.next_seq;
    await this.pool.query(
      `INSERT INTO activity_log (id, user_id, seq, type, job_id, packet_id, payload_json) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [ulid(), userId ?? null, seq, type, jobId ?? null, packetId ?? null, JSON.stringify(payload)],
    );
    return seq;
  }

  async listSince(userId: string, sinceSeq: number, limit = 100) {
    const { rows } = await this.pool.query(
      `SELECT * FROM activity_log WHERE user_id = $1 AND seq > $2 ORDER BY seq ASC LIMIT $3`,
      [userId, sinceSeq, limit],
    );
    return rows;
  }
}
