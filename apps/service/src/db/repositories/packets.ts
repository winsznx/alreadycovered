import type pg from "pg";
import { ulid } from "ulid";
import type { Issue, IssueSeverity, Packet, PacketState } from "@alreadycovered/shared";

function rowToPacket(row: {
  id: string;
  profile_id: string;
  local_date: string;
  revision: number;
  state: string;
  source_fingerprint: string;
  reviewed_revision: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}): Packet {
  return {
    id: row.id,
    profileId: row.profile_id,
    localDate: row.local_date,
    revision: row.revision,
    state: row.state as PacketState,
    sourceFingerprint: row.source_fingerprint,
    reviewedRevision: row.reviewed_revision ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PacketRepository {
  constructor(private readonly pool: pg.Pool) {}

  async getByProfileAndDate(profileId: string, localDate: string): Promise<Packet | null> {
    const { rows } = await this.pool.query(`SELECT * FROM packets WHERE profile_id = $1 AND local_date = $2`, [profileId, localDate]);
    return rows[0] ? rowToPacket(rows[0]) : null;
  }

  async getById(id: string): Promise<Packet | null> {
    const { rows } = await this.pool.query(`SELECT * FROM packets WHERE id = $1`, [id]);
    return rows[0] ? rowToPacket(rows[0]) : null;
  }

  /**
   * Creates the packet on first assembly for this date, or bumps its revision
   * in place when the fingerprint changed. The row's id (and therefore its
   * `/packets/:id` URL) never changes. Review state only carries forward when
   * the fingerprint is unchanged; otherwise a prior review becomes `stale`.
   */
  async upsertRevision(input: { profileId: string; localDate: string; sourceFingerprint: string; state: PacketState }): Promise<Packet> {
    const existing = await this.getByProfileAndDate(input.profileId, input.localDate);

    if (!existing) {
      const { rows } = await this.pool.query(
        `INSERT INTO packets (id, profile_id, local_date, revision, state, source_fingerprint)
         VALUES ($1, $2, $3, 1, $4, $5) RETURNING *`,
        [ulid(), input.profileId, input.localDate, input.state, input.sourceFingerprint],
      );
      return rowToPacket(rows[0]);
    }

    const fingerprintUnchanged = existing.sourceFingerprint === input.sourceFingerprint;
    const nextRevision = fingerprintUnchanged ? existing.revision : existing.revision + 1;

    const { rows } = await this.pool.query(
      `UPDATE packets SET revision = $1, state = $2, source_fingerprint = $3, updated_at = now() WHERE id = $4 RETURNING *`,
      [nextRevision, input.state, input.sourceFingerprint, existing.id],
    );
    return rowToPacket(rows[0]);
  }

  async markReviewed(packetId: string, revision: number, sourceFingerprint: string): Promise<Packet> {
    const { rows } = await this.pool.query(
      `UPDATE packets SET state = 'reviewed', reviewed_revision = $1, reviewed_fingerprint = $2, reviewed_at = now(), updated_at = now() WHERE id = $3 RETURNING *`,
      [revision, sourceFingerprint, packetId],
    );
    await this.pool.query(`INSERT INTO packet_reviews (id, packet_id, revision, source_fingerprint, reviewed_at) VALUES ($1, $2, $3, $4, now())`, [
      ulid(),
      packetId,
      revision,
      sourceFingerprint,
    ]);
    return rowToPacket(rows[0]);
  }

  async getReviewedFingerprint(packetId: string): Promise<string | null> {
    const { rows } = await this.pool.query(`SELECT reviewed_fingerprint FROM packets WHERE id = $1`, [packetId]);
    return rows[0]?.reviewed_fingerprint ?? null;
  }

  async replaceBlocks(
    packetId: string,
    blocks: Array<{
      timetableBlockId: string;
      subject: string;
      startMinute: number;
      endMinute: number;
      generatedInstructionId: string | null;
      materialLinkId: string | null;
    }>,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM packet_blocks WHERE packet_id = $1`, [packetId]);
      for (const block of blocks) {
        await client.query(
          `INSERT INTO packet_blocks (id, packet_id, timetable_block_id, subject, start_minute, end_minute, generated_instruction_id, material_link_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [ulid(), packetId, block.timetableBlockId, block.subject, block.startMinute, block.endMinute, block.generatedInstructionId, block.materialLinkId],
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

  async replaceIssues(packetId: string, issues: Array<{ blockId?: string; code: string; severity: IssueSeverity; humanMessage: string }>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM packet_issues WHERE packet_id = $1`, [packetId]);
      for (const issue of issues) {
        await client.query(
          `INSERT INTO packet_issues (id, packet_id, block_id, code, severity, human_message) VALUES ($1, $2, $3, $4, $5, $6)`,
          [ulid(), packetId, issue.blockId ?? null, issue.code, issue.severity, issue.humanMessage],
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

  async getIssues(packetId: string): Promise<Issue[]> {
    const { rows } = await this.pool.query(`SELECT * FROM packet_issues WHERE packet_id = $1`, [packetId]);
    return rows.map((r) => ({
      id: r.id,
      packetId: r.packet_id,
      blockId: r.block_id ?? undefined,
      code: r.code,
      severity: r.severity as IssueSeverity,
      humanMessage: r.human_message,
      resolvedAt: r.resolved_at ?? undefined,
    }));
  }
}
