import type pg from "pg";
import { ulid } from "ulid";
import type { SourceChunk, SourceFile, SourceStatus, SupportedExtension } from "@alreadycovered/shared";

function rowToSource(row: {
  id: string;
  storage_key: string;
  display_name: string;
  extension: string;
  size_bytes: string | number;
  sha256: string;
  status: string;
  error_code: string | null;
  indexed_at: string | null;
}): SourceFile {
  return {
    id: row.id,
    relativePath: row.storage_key,
    displayName: row.display_name,
    extension: row.extension as SupportedExtension,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    mtimeMs: 0,
    status: row.status as SourceStatus,
    errorCode: row.error_code ?? undefined,
    indexedAt: row.indexed_at ?? undefined,
  };
}

export class SourceRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(input: {
    userId: string;
    storageKey: string;
    displayName: string;
    extension: SupportedExtension;
    sizeBytes: number;
    sha256: string;
  }): Promise<SourceFile> {
    const id = ulid();
    const { rows } = await this.pool.query(
      `INSERT INTO source_files (id, user_id, storage_key, display_name, extension, size_bytes, sha256, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [id, input.userId, input.storageKey, input.displayName, input.extension, input.sizeBytes, input.sha256],
    );
    return rowToSource(rows[0]);
  }

  async getById(id: string): Promise<SourceFile | null> {
    const { rows } = await this.pool.query(`SELECT * FROM source_files WHERE id = $1 AND deleted_at IS NULL`, [id]);
    return rows[0] ? rowToSource(rows[0]) : null;
  }

  /** Scoped to one user - callers must always pass the authenticated request's userId. */
  async getByIdForUser(id: string, userId: string): Promise<SourceFile | null> {
    const { rows } = await this.pool.query(`SELECT * FROM source_files WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [id, userId]);
    return rows[0] ? rowToSource(rows[0]) : null;
  }

  async listActive(userId: string): Promise<SourceFile[]> {
    const { rows } = await this.pool.query(`SELECT * FROM source_files WHERE user_id = $1 AND deleted_at IS NULL ORDER BY display_name`, [userId]);
    return rows.map(rowToSource);
  }

  async markStatus(id: string, status: SourceStatus, errorCode?: string): Promise<void> {
    await this.pool.query(
      `UPDATE source_files SET status = $1, error_code = $2, indexed_at = CASE WHEN $1 = 'indexed' THEN now() ELSE NULL END, updated_at = now() WHERE id = $3`,
      [status, errorCode ?? null, id],
    );
  }

  async softDelete(id: string, userId: string): Promise<void> {
    await this.pool.query(`UPDATE source_files SET deleted_at = now(), updated_at = now() WHERE id = $1 AND user_id = $2`, [id, userId]);
  }

  async replaceChunks(sourceFileId: string, sourceSha256: string, chunks: Array<Omit<SourceChunk, "id" | "sourceFileId" | "sourceSha256">>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM source_chunks WHERE source_file_id = $1`, [sourceFileId]);
      for (const chunk of chunks) {
        await client.query(
          `INSERT INTO source_chunks (id, source_file_id, source_sha256, ordinal, heading, page_start, page_end, text, chunk_sha256)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [ulid(), sourceFileId, sourceSha256, chunk.ordinal, chunk.heading ?? null, chunk.pageStart ?? null, chunk.pageEnd ?? null, chunk.text, chunk.chunkSha256],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getChunks(sourceFileId: string): Promise<SourceChunk[]> {
    const { rows } = await this.pool.query(`SELECT * FROM source_chunks WHERE source_file_id = $1 ORDER BY ordinal`, [sourceFileId]);
    return rows.map(rowToChunk);
  }

  async getChunksByIds(chunkIds: string[]): Promise<SourceChunk[]> {
    if (chunkIds.length === 0) return [];
    const { rows } = await this.pool.query(`SELECT * FROM source_chunks WHERE id = ANY($1::text[])`, [chunkIds]);
    return rows.map(rowToChunk);
  }
}

function rowToChunk(r: {
  id: string;
  source_file_id: string;
  source_sha256: string;
  ordinal: number;
  heading: string | null;
  page_start: number | null;
  page_end: number | null;
  text: string;
  chunk_sha256: string;
}): SourceChunk {
  return {
    id: r.id,
    sourceFileId: r.source_file_id,
    sourceSha256: r.source_sha256,
    ordinal: r.ordinal,
    heading: r.heading ?? undefined,
    pageStart: r.page_start ?? undefined,
    pageEnd: r.page_end ?? undefined,
    text: r.text,
    chunkSha256: r.chunk_sha256,
  };
}
