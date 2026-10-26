# AlreadyCovered

**A substitute-teaching pack that's ready before a teacher needs a sick day.**

AlreadyCovered keeps a source-linked substitute packet current from the
lesson files a teacher already has. When an absence happens, the teacher
reviews what the app already prepared, fixes anything that's missing, and
exports a real, printable PDF and a ZIP of the actual worksheets - instead of
reconstructing tomorrow's lessons from scratch while unwell.

**Live:** [alreadycovered.vercel.app](https://alreadycovered.vercel.app)

> **Status: technical beta.** The core loop below is real and runnable today.
> It has not been validated with real practising teachers or a large document
> corpus - see [`internal/VALIDATION.md`](internal/VALIDATION.md) for exactly
> what was and wasn't tested, with real run evidence. This is **not** a
> market-validated product.

## Who this is for

An individual primary/elementary teacher who keeps lesson files (PDF, DOCX,
TXT, or Markdown) and has a recurring weekly timetable. It is not built for
school administrators, multi-teacher coordination, or any workflow involving
student records.

## What it does

1. Create an account and set up your class (name, grade, weekly schedule).
2. Upload your own teaching materials - PDF, DOCX, TXT, or Markdown. Files
   are private to your account; nothing is shared across teachers.
3. For a given school day, it drafts substitute-facing instructions per
   lesson block, grounded only in your actual files - every instruction
   traces back to a real page or section, and anything it can't support is
   flagged for your review rather than invented.
4. You review, correct, and approve which files get copied into the
   handover.
5. You export a real multi-page PDF plus a ZIP containing the approved
   worksheets and a manifest with checksums.

If a source file changes after you've reviewed a packet, the review is
invalidated and the affected lesson is marked stale until you look at it
again.

## Architecture

```
Browser (Vercel-hosted React app)
        |
        | HTTPS, cross-origin, cookie session auth
        v
Fastify API (Docker, VPS)  -->  Postgres (tenant-scoped by user_id)
        |                  -->  Gemma via Ollama (same VPS, CPU inference)
        |                  -->  Playwright (PDF) + archiver (ZIP)
        v
Per-user storage volume (uploads + generated exports)
```

- **Frontend**: `apps/web` - React + TypeScript + Vite + Tailwind, deployed
  as a static build to Vercel (`alreadycovered.vercel.app`).
- **Backend**: `apps/service` - Fastify + TypeScript API: file upload +
  extraction, the Ollama client, the packet readiness state machine,
  auth/sessions, and PDF/ZIP export. Runs in Docker on a VPS, fully
  independent of any other project on that host (own containers, own ports,
  own network).
- **Database**: Postgres, every table scoped by `user_id` for real
  multi-tenant isolation.
- **`packages/shared`** - Zod schemas and TypeScript types shared by both
  apps.
- **`fixtures/`** - small, original, clearly-labelled illustrative lesson
  files used for development and the real-model evaluation harness.

See [`internal/DECISIONS.md`](internal/DECISIONS.md) for implementation
decisions (including the local-first -> hosted SaaS pivot and why) and
[`internal/VALIDATION.md`](internal/VALIDATION.md) for real run evidence.

### A note on privacy, honestly

The product was originally built local-first (every file and every model
call stayed on the teacher's own machine, never touching a server). It has
since been redeployed as a hosted product at explicit request: frontend on
Vercel, backend + database + AI model on a VPS. **This means teacher files
and generated packets are no longer processed exclusively on the teacher's
own computer** - they're private to that teacher's account on the server,
encrypted in transit (HTTPS) and isolated per-tenant in the database and on
disk, but they do leave the teacher's computer. See
[`internal/DECISIONS.md`](internal/DECISIONS.md) for exactly what changed
and why.

### Current TLS caveat

The API currently uses a **self-signed certificate** (Caddy's internal CA),
not a publicly trusted one - the VPS's only free ports (80/443) are already
committed to a different project's reverse proxy, and automatic Let's
Encrypt issuance requires one of those two ports. A browser visiting the API
origin directly will show a security warning that needs a one-time
click-through before the app can call it. This should be replaced with a
real certificate (a purchased domain, or routing through the existing shared
reverse proxy) before any real teacher relies on this deployment.

## Local development

### Prerequisites

- Node.js 20+ (built and tested on Node 24.19 / macOS arm64)
- [pnpm](https://pnpm.io)
- [Ollama](https://ollama.com), installed and running locally, with
  `ollama pull gemma4:e4b` (or `gemma4:e2b` on slower hardware) done
- A local Postgres instance (`createdb alreadycovered_dev`)
- Docker, only if you want to build/run the production container locally

### Setup

```bash
pnpm install
cp .env.example apps/service/.env   # adjust DATABASE_URL, STORAGE_ROOT, etc.
pnpm build                          # builds packages/shared, apps/service, apps/web
```

Run the backend:

```bash
DATABASE_URL=postgres://localhost:5432/alreadycovered_dev \
STORAGE_ROOT=./.local-storage \
CORS_ORIGIN=http://localhost:5173 \
COOKIE_CROSS_SITE=false \
node apps/service/dist/index.js
```

Run the frontend (separate terminal):

```bash
cd apps/web && pnpm dev   # Vite dev server on :5173, proxies /api to the backend
```

## Commands

```bash
pnpm lint         # workspace lint (no-op placeholders in this build; see note below)
pnpm typecheck    # strict TypeScript across all packages
pnpm test         # Vitest unit + integration tests (fast, no model calls; needs local Postgres)
pnpm test:e2e     # Playwright browser E2E against a real built+running service
pnpm test:eval    # real-model evaluation against fixtures/permitted-sample-files
                   #   (makes real Ollama calls; writes a report to
                   #   tests/evaluation/output/)
```

`pnpm lint` is currently a placeholder (`echo no-op`) in each package - no
lint tool was wired up in this pass. `pnpm typecheck` runs strict
TypeScript everywhere and is the enforced quality gate.

## Deploying your own copy

### Backend (Docker, any VPS)

```bash
cd infra
cp .env.example .env   # set DB_PASSWORD, CORS_ORIGIN (your frontend's origin), OLLAMA_MODEL
# edit Caddyfile: set your own hostname, remove `tls internal` if you own a
# domain and ports 80/443 (real Let's Encrypt certs need one of those)
docker compose -p alreadycovered --env-file .env up -d --build
docker exec <project>-ollama-1 ollama pull gemma4:e2b   # or e4b with a GPU
```

### Frontend (Vercel)

```bash
cd apps/web
VITE_API_BASE_URL="https://your-api-host" pnpm build
cd dist && vercel deploy --prod --yes
```

Then set the backend's `CORS_ORIGIN` to the resulting Vercel URL and restart
the API container.

## Supported formats

| Input | How it's read |
|---|---|
| `.pdf` (text layer) | Page-by-page text extraction (`pdfjs-dist`); scanned/image-only PDFs are explicitly flagged as "no readable text," never guessed |
| `.docx` | Paragraph text extraction (`mammoth`); cited by paragraph number, never an invented page number |
| `.txt` / `.md` | UTF-8, split into heading-based sections where present |

| Output | Contents |
|---|---|
| PDF | Schedule, per-lesson instructions with source references, teacher-verified routines, a "needs teacher attention" section when incomplete, and a substitute end-of-day notes page |
| ZIP | The PDF, only teacher-approved source files (collision-safe, zip-slip-safe filenames), `manifest.json` with checksums, `README.txt` |

## Known limitations

- **Self-signed TLS on the API** (see above) - needs a real certificate
  before production use with real teacher data.
- **CPU-only hosted inference is slow.** The deployment VPS has no GPU; a
  single lesson-draft generation call has been observed taking well over a
  minute under load. The UI reflects this honestly with a persistent
  "generating..." state rather than a fake instant result, but it is a real
  user-experience cost versus GPU-backed inference.
- **Keyword + synonym material matching, not semantic search.** Retrieval
  uses filename weighting and an editable subject-synonym map
  (`core/retrieval.ts`), not a vector index. It correctly auto-matches
  common cases (e.g. a fractions worksheet to "Mathematics") but can still
  miss an unusual subject/file-naming combination - the app surfaces that
  honestly as "no material linked" rather than guessing.
- **No real teacher trial.** Usefulness is not yet demonstrated with a real
  classroom workflow comparison. This build is a technical beta.
- **Small evaluation corpus.** The real-model evaluation harness has been run
  against 4 original fixture documents, not the 10 the product spec's
  evaluation protocol calls for.
- **P1 features are not built**: PDF thumbnail previews, reusable routine
  snippets, and image-page (scanned PDF) vision support are out of scope for
  this pass.

## Privacy and security

- Every table is scoped by `user_id`; one teacher's files, schedule, and
  packets are never visible to another.
- Session cookies are `httpOnly`, `Secure`, random 256-bit tokens (only a
  SHA-256 hash is stored server-side).
- No file is ever readable through the API by raw path - only by an internal
  ID the server resolves against that user's own storage directory, with
  symlink-escape/path-traversal protection (unit-tested against real
  traversal and symlink attacks - see `tests/unit/paths.test.ts`).
- Strict CORS origin allowlist with credentials; no permissive `*` origin.
- No analytics, telemetry, or third-party network calls beyond the
  first-party frontend/backend/model stack described above.
- Nothing is ever sent, emailed, or uploaded automatically to a school or
  third party - export produces downloadable files only, and the UI says so
  after every export.

## License

MIT. See [`LICENSE`](LICENSE).
