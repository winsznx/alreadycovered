import type pg from "pg";
import type { ExportRecord } from "@alreadycovered/shared";

function rowToExport(row: {
  id: string;
  packet_id: string;
  packet_revision: number;
  pdf_storage_key: string;
  zip_storage_key: string;
  manifest_sha256: string;
  exported_with_warnings: boolean;
  created_at: string;
}): ExportRecord {
  return {
    id: row.id,
    packetId: row.packet_id,
    packetRevision: row.packet_revision,
    pdfStorageKey: row.pdf_storage_key,
    zipStorageKey: row.zip_storage_key,
    manifestSha256: row.manifest_sha256,
    exportedWithWarnings: row.exported_with_warnings,
    createdAt: row.created_at,
  };
}

export class ExportRepository {
  constructor(private readonly pool: pg.Pool) {}

  async save(record: ExportRecord): Promise<ExportRecord> {
    await this.pool.query(
      `INSERT INTO exports (id, packet_id, packet_revision, pdf_storage_key, zip_storage_key, manifest_sha256, exported_with_warnings, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [record.id, record.packetId, record.packetRevision, record.pdfStorageKey, record.zipStorageKey, record.manifestSha256, record.exportedWithWarnings, record.createdAt],
    );
    return record;
  }

  async getById(id: string): Promise<ExportRecord | null> {
    const { rows } = await this.pool.query(`SELECT * FROM exports WHERE id = $1`, [id]);
    return rows[0] ? rowToExport(rows[0]) : null;
  }
}
