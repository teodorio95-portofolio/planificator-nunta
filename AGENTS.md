# planificator-nunta — agent context

Provides a self-hosted wedding planner for couples, including guests, RSVP, seating and budgets. Runs on: SvelteKit Node server locally or in Docker Compose, with an optional Caddy HTTPS proxy.

## Commands
- `make help` — quick, safe command discovery.
- `make check` — Svelte and TypeScript checks; `make test` runs Vitest.
- `make demo` — starts Vite with `data/demo.db` and generated demo data.
- `make dev` — starts the local Vite server; `make build` creates `build/`.
- `make up` — builds and starts Compose; `make up-https` adds Caddy.
- `make backup` — snapshots the running container database and copies optional cover/music files.
- `make down` stops containers while retaining the data volume.

## Layout
- `src/routes/(app)/` — planning pages and server actions.
- `src/routes/r/[token]/`, `src/routes/s/[token]/` — public guest response and invitation pages.
- `src/lib/server/db.ts`, `queries.ts` — SQLite schema, migrations and queries.
- `src/lib/server/auth.ts` — role passwords, Google sign-in and sessions.
- `src/hooks.server.ts` — request handling, authentication setup and demo initialization.
- `src/lib/server/media.ts`, `demo.ts` — uploaded media and demo setup.
- `src/lib/__tests__/` — unit tests, including password and session behavior.
- `compose.yaml`, `compose.https.yaml`, `docker-entrypoint.mjs` — deployment and volume ownership.
- `.github/workflows/ci.yml` — checks, container smoke test and GHCR publication.

## How it works
- Requires Node >=24 and uses built-in `node:sqlite` with WAL and foreign keys.
- `DATABASE_PATH` defaults to `data/nunta.db`; Compose persists `/data` in the `nunta-data` volume.
- Sign-in supports Google and shared passwords through `ADMIN_PASSWORD`, `EDITOR_PASSWORD` and `READER_PASSWORD`.
- Without configured sign-in, development opens as admin; production stays locked unless `AUTH_DISABLED=true`.
- `DEMO_DATA=true` seeds demo data when the households table is empty.
- HTTPS mode binds the app to loopback and places Caddy in front.
- CI checks types, tests and builds, then verifies the container can write a root-owned data mount as UID 1000.
- Pushes to main or version tags publish container images for amd64 and arm64.

## Gotchas
- Passwords shorter than eight characters are ignored.
- Changing a role password invalidates sessions opened with that password.
- Password attempts are limited per client address in process memory.
- Root-owned host/platform mounts are unwritable as `node`; keep the entrypoint's recursive ownership handoff before dropping privileges (`0f06aeb`).
- `make backup` includes optional media; copying only the database does not preserve those uploads.
- CI uses Node 26; container startup and demo seeding are covered by the smoke job.

## Related repos
- `nunta` — related SvelteKit/SQLite wedding planner deployed on Fly with Google sign-in; this repo documents general self-hosting with role passwords and Docker/Render setup.

## Do not
- Do not enable `AUTH_DISABLED=true` on an exposed deployment.
- Do not run demo seeding against a real event database.
- Do not remove the persistent volume or publish guest records, backups or public invitation tokens.
- Do not mount unrelated directories as the database directory: startup changes their ownership.
