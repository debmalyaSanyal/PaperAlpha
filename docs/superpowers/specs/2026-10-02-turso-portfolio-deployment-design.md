# Turso Portfolio Deployment Design

## Goal

Make the Next.js application deployable as a free portfolio project while
keeping SQLite. Local development continues to use a file-backed SQLite
database; deployed environments use a persistent Turso/libSQL database.

## Scope

- Add a Prisma libSQL adapter when Turso credentials are present.
- Preserve the current Prisma schema with `provider = "sqlite"`.
- Keep local `DATABASE_URL=file:...` development working without Turso.
- Treat the existing S3-compatible storage driver as the Cloudflare R2 driver
  when its documented R2 environment values are configured.
- Add deployment helpers and documentation for Turso schema provisioning,
  Cloudflare R2, Vercel, and the external worker URL.
- Make the server-side generation route reject an unconfigured worker before a
  job is queued, with a clear actionable response.

## Non-goals

- Build or fabricate the missing Python research-generation worker. It is not
  present in this repository, and a live worker URL remains required for real
  generation.
- Add multi-user authentication. The portfolio deployment retains its existing
  anonymous demo-user behavior.
- Change the data model from SQLite to PostgreSQL.

## Architecture

`lib/db.ts` will select one of two concrete Prisma clients at runtime:

1. **Local mode:** `DATABASE_URL` is a `file:` URL. The existing local SQLite
   client and schema bootstrap behavior remain in use.
2. **Hosted mode:** both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set.
   Prisma uses `@prisma/adapter-libsql` to reach Turso over HTTPS. The app does
   not redirect that URL into `/tmp` and does not attempt to create schema at
   request time.

The Turso schema is applied deliberately by a checked-in deployment script
using the generated SQLite DDL. This keeps schema changes out of request
handling and avoids a race when several serverless instances start together.

Cloudflare R2 already implements the application's `StorageDriver` contract
through the S3-compatible driver. The project will document exact R2 values
and validate that an S3 endpoint is present when S3 storage is selected.

The Next.js application remains the control plane. It submits generation jobs
to a separately deployed worker using `BACKEND_URL` and `WORKER_SHARED_SECRET`.
Because no worker source is in this repository, a portfolio deployment can
show the application shell, create projects, and manage stored data; real
paper generation is enabled only after the missing worker is deployed.

## Error Handling

- One Turso credential without the other is invalid configuration and produces
  a clear server-side error.
- In hosted mode, a file-backed `DATABASE_URL` does not replace the Turso
  connection.
- S3/R2 mode requires endpoint, bucket, access key, and secret key.
- Generation requests fail before queueing when `BACKEND_URL` is absent or is
  still the local default address.

## Verification

- Unit tests prove deployment-mode selection and partial Turso configuration
  errors.
- Unit tests prove worker configuration validation.
- The existing test suite, typecheck, clean dependency installation, and
  production build must pass.

