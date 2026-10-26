# Security

AlreadyCovered is a technical beta (see `README.md`) run by a single
maintainer, not a company with a formal disclosure program or bug bounty.

## Reporting a vulnerability

Please use [GitHub's private vulnerability reporting](../../security/advisories/new)
for this repository rather than opening a public issue. If that's not
available, open an issue with minimal detail asking for a private channel
and avoid posting exploit details publicly.

Please include:

- What you found and why it's a vulnerability (not just unexpected behavior).
- Steps to reproduce, ideally against a local dev instance rather than the
  live deployment.
- The potential impact (e.g. cross-tenant data access, auth bypass, path
  traversal).

## Scope

In scope: the application code in this repository (`apps/`, `packages/`,
`infra/`).

Out of scope: the specific live deployment's infrastructure (VPS, Vercel
project) beyond what's reproducible from this repo's own code and configs,
and the upstream dependencies (Ollama, Fastify, Postgres, etc.) themselves -
please report those issues to their own maintainers.

## What's already documented

Known, already-disclosed limitations (e.g. the self-signed TLS certificate on
the API) are listed in the "Known limitations" section of `README.md` - no
need to report those, they're tracked there intentionally.
