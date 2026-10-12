# CLAUDE.md: BenchSort Sync

A small agent a museum installs to write BenchSort exports into its own database and copy
the photos (BenchSort #263). TypeScript, Node 24, shipped as single executables (Node SEA)
and a Docker image. MIT.

- Everything in the repository is in English; the maintainer may write in French.
- It reads BenchSort's public API with an institution key (`/api/v1/sessions`, `/files`); it
  never creates, alters or deletes tables or rows other than upserting mapped rows.
- Names in SQL come only from the configuration, checked (letters, digits, _); values are
  always parameters.
- Ask before adding a dependency, with its license (MIT, BSD, Apache 2.0, ISC). Pin versions
  at least two weeks old.
- Tests: `npm test` (PostgreSQL integration when `SYNC_TEST_POSTGRES_URL` is set).
