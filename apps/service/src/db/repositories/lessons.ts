import type pg from "pg";
import { ulid } from "ulid";
import type { ExportPermission, GeneratedInstruction, MaterialLink, MatchStatus, TeacherOverride } from "@alreadycovered/shared";

function rowToMaterialLink(row: {
  id: string;
  timetable_block_id: string;
  local_date: string;
  source_file_id: string | null;
  source_chunk_ids_json: string[];
  status: string;
  rationale: string;
  selected_by: string;
  confirmed_at: string | null;
  expected_label: string | null;
  export_permission: string;
  attribution_text: string | null;
}): MaterialLink {
  return {
    id: row.id,
    timetableBlockId: row.timetable_block_id,
    localDate: row.local_date,
    sourceFileId: row.source_file_id,
    sourceChunkIds: row.source_chunk_ids_json,
    status: row.status as MatchStatus,
    rationale: row.rationale,
    selectedBy: row.selected_by as MaterialLink["selectedBy"],
    confirmedAt: row.confirmed_at ?? undefined,
    expectedLabel: row.expected_label ?? undefined,
    exportPermission: row.export_permission as ExportPermission,
    attributionText: row.attribution_text ?? undefined,
  };
}

export class LessonRepository {
  constructor(private readonly pool: pg.Pool) {}

  async upsertMaterialLink(input: {
    timetableBlockId: string;
    localDate: string;
    sourceFileId: string | null;
    sourceChunkIds: string[];
    status: MatchStatus;
    rationale: string;
    selectedBy: MaterialLink["selectedBy"];
    expectedLabel?: string;
  }): Promise<MaterialLink> {
    const confirmedAt = input.selectedBy === "teacher" ? new Date().toISOString() : null;
    const { rows } = await this.pool.query(
      `INSERT INTO material_links (id, timetable_block_id, local_date, source_file_id, source_chunk_ids_json, status, rationale, selected_by, confirmed_at, expected_label, export_permission)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'unreviewed')
       ON CONFLICT (timetable_block_id, local_date) DO UPDATE SET
         source_file_id = $4, source_chunk_ids_json = $5, status = $6, rationale = $7, selected_by = $8, confirmed_at = $9, expected_label = $10, updated_at = now()
       RETURNING *`,
      [ulid(), input.timetableBlockId, input.localDate, input.sourceFileId, JSON.stringify(input.sourceChunkIds), input.status, input.rationale, input.selectedBy, confirmedAt, input.expectedLabel ?? null],
    );
    return rowToMaterialLink(rows[0]);
  }

  async setExportPermission(id: string, permission: ExportPermission, attributionText?: string): Promise<void> {
    await this.pool.query(`UPDATE material_links SET export_permission = $1, attribution_text = $2, updated_at = now() WHERE id = $3`, [
      permission,
      attributionText ?? null,
      id,
    ]);
  }

  async getMaterialLink(timetableBlockId: string, localDate: string): Promise<MaterialLink | null> {
    const { rows } = await this.pool.query(`SELECT * FROM material_links WHERE timetable_block_id = $1 AND local_date = $2`, [timetableBlockId, localDate]);
    return rows[0] ? rowToMaterialLink(rows[0]) : null;
  }

  async getMaterialLinkById(id: string): Promise<MaterialLink | null> {
    const { rows } = await this.pool.query(`SELECT * FROM material_links WHERE id = $1`, [id]);
    return rows[0] ? rowToMaterialLink(rows[0]) : null;
  }

  async saveGeneratedInstruction(input: {
    timetableBlockId: string;
    localDate: string;
    lessonTitle: string;
    summary: string;
    steps: string[];
    requiredMaterialFileIds: string[];
    citedChunkIds: string[];
    unsupportedQuestions: string[];
    modelTag: string;
    promptVersion: string;
    sourceFingerprint: string;
  }): Promise<GeneratedInstruction> {
    const { rows } = await this.pool.query(
      `INSERT INTO generated_instructions
         (id, timetable_block_id, local_date, lesson_title, summary, steps_json, required_material_file_ids_json, cited_chunk_ids_json, unsupported_questions_json, model_tag, prompt_version, source_fingerprint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (timetable_block_id, local_date, source_fingerprint) DO UPDATE SET
         lesson_title = $4, summary = $5, steps_json = $6, required_material_file_ids_json = $7, cited_chunk_ids_json = $8, unsupported_questions_json = $9, model_tag = $10, prompt_version = $11
       RETURNING *`,
      [
        ulid(),
        input.timetableBlockId,
        input.localDate,
        input.lessonTitle,
        input.summary,
        JSON.stringify(input.steps),
        JSON.stringify(input.requiredMaterialFileIds),
        JSON.stringify(input.citedChunkIds),
        JSON.stringify(input.unsupportedQuestions),
        input.modelTag,
        input.promptVersion,
        input.sourceFingerprint,
      ],
    );
    return rowToInstruction(rows[0]);
  }

  async getGeneratedInstruction(timetableBlockId: string, localDate: string, sourceFingerprint: string): Promise<GeneratedInstruction | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM generated_instructions WHERE timetable_block_id = $1 AND local_date = $2 AND source_fingerprint = $3`,
      [timetableBlockId, localDate, sourceFingerprint],
    );
    return rows[0] ? rowToInstruction(rows[0]) : null;
  }

  async saveOverride(input: { profileId: string; timetableBlockId: string; localDate: string; field: TeacherOverride["field"]; valueJson: unknown }): Promise<TeacherOverride> {
    const { rows } = await this.pool.query(
      `INSERT INTO teacher_overrides (id, profile_id, timetable_block_id, local_date, field, value_json, author)
       VALUES ($1, $2, $3, $4, $5, $6, 'local_teacher')
       RETURNING *`,
      [ulid(), input.profileId, input.timetableBlockId, input.localDate, input.field, JSON.stringify(input.valueJson)],
    );
    const r = rows[0];
    return {
      id: r.id,
      profileId: r.profile_id,
      timetableBlockId: r.timetable_block_id,
      localDate: r.local_date,
      field: r.field,
      valueJson: r.value_json,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      author: "local_teacher",
    };
  }

  async getAllOverridesRevisionTag(profileId: string): Promise<string> {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count, MAX(updated_at) AS latest FROM teacher_overrides WHERE profile_id = $1`,
      [profileId],
    );
    return `${rows[0].count}:${rows[0].latest ?? "none"}`;
  }
}

function rowToInstruction(r: {
  id: string;
  timetable_block_id: string;
  local_date: string;
  lesson_title: string;
  summary: string;
  steps_json: string[];
  required_material_file_ids_json: string[];
  cited_chunk_ids_json: string[];
  unsupported_questions_json: string[];
  model_tag: string;
  prompt_version: string;
  created_at: string;
}): GeneratedInstruction {
  return {
    id: r.id,
    timetableBlockId: r.timetable_block_id,
    localDate: r.local_date,
    lessonTitle: r.lesson_title,
    summary: r.summary,
    steps: r.steps_json,
    requiredMaterialFileIds: r.required_material_file_ids_json,
    citedChunkIds: r.cited_chunk_ids_json,
    unsupportedQuestions: r.unsupported_questions_json,
    modelTag: r.model_tag,
    promptVersion: r.prompt_version,
    createdAt: r.created_at,
  };
}
