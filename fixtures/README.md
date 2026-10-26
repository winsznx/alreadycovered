# Fixtures

These files are **illustrative test fixtures**, not real classroom material and not a real
teacher's data. They were written for this project to exercise the document-ingestion and
packet-generation pipeline end to end.

- `permitted-sample-files/` — original, hand-written lesson notes and worksheets used by the
  automated tests and the local demo. Provenance: authored for this project on 2026-10-26;
  no third-party curriculum, no student data, no real school identity.
- `expected/` — hand-authored expectations (e.g. which subject a file should match) used by
  `tests/evaluation`. These describe what a human reviewer expects the pipeline to do; they are
  not the app's own output and must not be confused with it.

Any schedule, class name, or teacher name appearing in these fixtures or in the README demo
instructions is illustrative only.
