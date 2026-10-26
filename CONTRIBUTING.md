# Contributing

This is a solo-maintained technical beta (see the "Status" note in
[`README.md`](README.md)). Issues and pull requests are welcome, but please
open an issue to discuss a change before sending a large PR - there's no
guarantee of a quick review.

## Before you open a PR

- `pnpm install` at the repo root (pnpm workspaces; see `pnpm-workspace.yaml`).
- `pnpm typecheck` must pass. This is the enforced quality gate - there is no
  linter wired up yet (`pnpm lint` is a placeholder, see the README).
- `pnpm test:unit` and `pnpm test:integration` must pass. Integration tests
  need a local Postgres instance (`createdb alreadycovered_dev`).
- If you touched generation, retrieval, or anything the model sees, also run
  `pnpm test:eval` against a local Ollama instance and read the report in
  `tests/evaluation/output/` before claiming it works - this project does not
  accept "should work" for anything that calls the model.
- `pnpm test:e2e` (Playwright) needs a real built-and-running service; it's
  not required for small changes but is the final check before anything
  deployment-related.

## Ground rules

- Never fabricate or silently invent data the app can't actually verify
  (a missing source, a date, a safety procedure). If something can't be
  confirmed, surface it to the user - don't guess on their behalf. This is
  the project's core design constraint, not a style preference.
- Keep `internal/DECISIONS.md` in mind as prior art for *why* things are
  built the way they are before proposing a different approach - it's not
  published in this repo (see `.gitignore`), so ask in your issue if you want
  that context.
- No `any`/`@ts-ignore`/`@ts-expect-error` without an explicit comment on why
  it's genuinely unavoidable.
- Every new table or query must be scoped by `user_id`. There is no
  multi-tenant exception.

## Reporting a security issue

Please don't open a public issue for a security vulnerability. See
[`SECURITY.md`](SECURITY.md) instead.
