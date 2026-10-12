# Neuer Barber — booking site

Customer booking site (`/ja`, `/en`) and, later, an admin PWA (`/admin`) for a one-chair barber.
Design documents live in [`docs/`](docs/README.md) (start with `docs/03_design/00_overview.md`);
engineering rules for humans and agents are in [`AGENTS.md`](AGENTS.md).

## Requirements

- Node.js ≥ 22.12 (production / CI use Node 24, see `.nvmrc`), npm 10
- PostgreSQL 16+ server binaries for local development (`initdb`, `pg_ctl`, `psql`), **or** any
  reachable Postgres with the `btree_gist` and `pg_trgm` extensions (e.g. a Neon dev branch)

## Setup

```bash
npm ci
npm run db:start                     # init + start .local/pg on :54329, create barber_dev / barber_test, write .env.local
npm run db:migrate                   # drizzle-kit migrate (extensions, tables, EXCLUDE constraint)
npm run db:seed -- --activate-menus  # 9 menus, hours, settings; the flag makes menus bookable locally
npm run dev                          # http://localhost:3000 → /ja
```

Without the flag, menus are seeded inactive with price 0 until prices are confirmed (OI-01).
`npm run db:reset` drops and recreates both local databases, migrates and seeds.
`npm run db:stop` stops the cluster. Running as root, the script delegates to the `postgres`
OS user (`PG_LOCAL_OS_USER`); set `PG_BIN` if the binaries are not on `PATH` or in
`/usr/lib/postgresql/<v>/bin`.

To use another database instead, set `DATABASE_URL` (and `TEST_DATABASE_URL` for tests) in
`.env.local` — see `.env.example` for every variable.

## Checks

```bash
npm test            # unit + component + DB integration tests (starts the local cluster if TEST_DATABASE_URL is unset)
npm run test:unit   # pure unit tests only, no database
npm run typecheck   # next typegen + tsc --noEmit
npm run lint        # biome ci + eslint (Next rules, feature boundaries)
npm run build       # needs DATABASE_URL reachable: menus/settings are baked into the static shell
```

CI (`.github/workflows/ci.yml`) runs the same steps against a Postgres 16 service.

## Booking flow

`/{locale}/book` (menu) → `/book/time?menu=` (month calendar + slots, never cached) →
`/book/info` (details) → `/book/confirm` (Server Action `createBooking`) →
`/book/done/{token}` (receipt, `.ics`, cancel link) → `/{locale}/cancel/{token}`.

Double booking is prevented by the `bookings_no_overlap` exclusion constraint; see
`docs/03_design/adr/0003-exclusion-constraint-via-raw-sql-migration.md`.
