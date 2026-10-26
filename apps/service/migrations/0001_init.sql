-- AlreadyCovered SaaS schema (migration 0001) - PostgreSQL
-- Every tenant-owned table is scoped by user_id (directly or via profile_id -> profiles.user_id).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  grade TEXT NOT NULL,
  timezone TEXT NOT NULL,
  locale TEXT NOT NULL,
  teacher_display_name TEXT,
  schedule_revision INTEGER NOT NULL DEFAULT 1,
  routines_revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timetable_blocks (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute INTEGER NOT NULL CHECK (start_minute >= 0 AND start_minute < 1440),
  end_minute INTEGER NOT NULL CHECK (end_minute > 0 AND end_minute <= 1440),
  subject TEXT NOT NULL,
  optional_teacher_notes TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  CHECK (end_minute > start_minute)
);
CREATE INDEX IF NOT EXISTS idx_timetable_blocks_profile ON timetable_blocks(profile_id, weekday);

CREATE TABLE IF NOT EXISTS date_overrides (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('no_school', 'block_override')),
  blocks_json JSONB,
  UNIQUE(profile_id, local_date)
);

CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  teacher_verified_at TIMESTAMPTZ,
  include_in_packet BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_routines_profile ON routines(profile_id);

-- Uploaded files replace the local-folder watch model: each row is one
-- teacher-uploaded document, stored on disk under a per-user directory
-- (see security/storage.ts), never addressable by raw path from the API.
CREATE TABLE IF NOT EXISTS source_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_source_files_user ON source_files(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_source_files_status ON source_files(status);
CREATE INDEX IF NOT EXISTS idx_source_files_sha256 ON source_files(sha256);

CREATE TABLE IF NOT EXISTS source_chunks (
  id TEXT PRIMARY KEY,
  source_file_id TEXT NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,
  source_sha256 TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  heading TEXT,
  page_start INTEGER,
  page_end INTEGER,
  text TEXT NOT NULL,
  chunk_sha256 TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_source_chunks_file ON source_chunks(source_file_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_hash ON source_chunks(source_sha256);

CREATE TABLE IF NOT EXISTS material_links (
  id TEXT PRIMARY KEY,
  timetable_block_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  source_file_id TEXT REFERENCES source_files(id) ON DELETE SET NULL,
  source_chunk_ids_json JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  selected_by TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ,
  expected_label TEXT,
  export_permission TEXT NOT NULL DEFAULT 'unreviewed',
  attribution_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(timetable_block_id, local_date)
);
CREATE INDEX IF NOT EXISTS idx_material_links_source ON material_links(source_file_id);

CREATE TABLE IF NOT EXISTS generated_instructions (
  id TEXT PRIMARY KEY,
  timetable_block_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  lesson_title TEXT NOT NULL,
  summary TEXT NOT NULL,
  steps_json JSONB NOT NULL,
  required_material_file_ids_json JSONB NOT NULL,
  cited_chunk_ids_json JSONB NOT NULL,
  unsupported_questions_json JSONB NOT NULL,
  model_tag TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(timetable_block_id, local_date, source_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_generated_instructions_block_date ON generated_instructions(timetable_block_id, local_date);

CREATE TABLE IF NOT EXISTS teacher_overrides (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  timetable_block_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  field TEXT NOT NULL,
  value_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  author TEXT NOT NULL DEFAULT 'local_teacher'
);
CREATE INDEX IF NOT EXISTS idx_teacher_overrides_block_date ON teacher_overrides(timetable_block_id, local_date);

-- One stable row per (profile, date); revision increments in place so the
-- packet's id/URL never changes across regenerations.
CREATE TABLE IF NOT EXISTS packets (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  revision INTEGER NOT NULL,
  state TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  reviewed_revision INTEGER,
  reviewed_fingerprint TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, local_date)
);
CREATE INDEX IF NOT EXISTS idx_packets_profile_date ON packets(profile_id, local_date);

CREATE TABLE IF NOT EXISTS packet_blocks (
  id TEXT PRIMARY KEY,
  packet_id TEXT NOT NULL REFERENCES packets(id) ON DELETE CASCADE,
  timetable_block_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  start_minute INTEGER NOT NULL,
  end_minute INTEGER NOT NULL,
  generated_instruction_id TEXT,
  material_link_id TEXT,
  UNIQUE(packet_id, timetable_block_id)
);

CREATE TABLE IF NOT EXISTS packet_issues (
  id TEXT PRIMARY KEY,
  packet_id TEXT NOT NULL REFERENCES packets(id) ON DELETE CASCADE,
  block_id TEXT,
  code TEXT NOT NULL,
  severity TEXT NOT NULL,
  human_message TEXT NOT NULL,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_packet_issues_packet ON packet_issues(packet_id);

CREATE TABLE IF NOT EXISTS packet_reviews (
  id TEXT PRIMARY KEY,
  packet_id TEXT NOT NULL REFERENCES packets(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  source_fingerprint TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}',
  stage TEXT,
  processed_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  retryable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  packet_id TEXT NOT NULL REFERENCES packets(id) ON DELETE CASCADE,
  packet_revision INTEGER NOT NULL,
  pdf_storage_key TEXT NOT NULL,
  zip_storage_key TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL,
  exported_with_warnings BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exports_packet ON exports(packet_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  seq BIGINT NOT NULL,
  type TEXT NOT NULL,
  job_id TEXT,
  packet_id TEXT,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_seq ON activity_log(user_id, seq);
