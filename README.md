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

## Deploy

Production runs on Vercel Hobby + Neon Free (via the Vercel Marketplace); see ADR-0001.
Follow [`docs/07_release/01_deploy_guide.md`](docs/07_release/01_deploy_guide.md) (REL-001): env vars,
migrations, seed, cron, Turnstile, WAF, staging, custom domain and the Pro/Cloudflare path.

- Migrate before deploying, from a local shell with the Neon direct URL: `npm run db:migrate`. Never `drizzle-kit push`.
- Production seed: `npm run db:seed` and `npm run db:seed-admin`, **without** `--activate-menus`; publish menus in the admin once prices are set (OI-01).
- Daily encrypted backups: `.github/workflows/backup.yml` (restore steps in REL-001 §9). Dependency updates: `renovate.json`.
- Before go-live: [`02_prelaunch_checklist.md`](docs/07_release/02_prelaunch_checklist.md); incidents and rollback: [`03_rollback_and_incident.md`](docs/07_release/03_rollback_and_incident.md).

## Booking flow

`/{locale}/book` (menu) → `/book/time?menu=` (month calendar + slots, never cached) →
`/book/info` (details) → `/book/confirm` (Server Action `createBooking`) →
`/book/done/{token}` (receipt, `.ics`, cancel link) → `/{locale}/cancel/{token}`.

Double booking is prevented by the `bookings_no_overlap` exclusion constraint; see
`docs/03_design/adr/0003-exclusion-constraint-via-raw-sql-migration.md`.

## Customer UI

Implements the approved comps in `docs/05_design_comps/` (DG-001 v0.3, `base/` and
`expanded/customer/`). Design tokens: `src/styles/tokens.css` (copy of the source of truth) wired
into Tailwind v4 in `src/styles/globals.css` (`@theme inline`, `paper` utility, component classes
ported from the comps, reduced motion). UI primitives live in `src/components/ui/`
(Button, Card, Stepper, FieldWrapper, TextInput, RadioGroup, Checkbox, Sheet on `<dialog>`, Toast,
CopyButton / ShareCopyButton, InstagramLink, Header variants, Footer). All copy is in
`messages/{ja,en}.json`; shop facts (address, Instagram, hero photo slot) in `src/config/shop.ts`.
To use the real hero photo, put it under `public/brand/` and set `shop.heroPhoto`.

Pages: `/{locale}` (top, JSON-LD `HairSalon` without telephone, hreflang), `/book` →
`/book/time` → `/book/info` → `/book/confirm` → `/book/done/{token}`, `/cancel/{token}`,
`/privacy`, `/policy`, `/tokusho`, localized 404 and error boundary; `robots.txt` / `sitemap.xml`.

### End-to-end checks

```bash
node test/e2e/run.mjs              # recreate DB barber_e2e, next build, next start :3100, run scenarios
node test/e2e/run.mjs --no-build   # reuse the existing .next build
#   --port 3100  --shots <dir> (default test-results/e2e)  --keep-db
#   E2E_PG_URL=postgresql://…/postgres  to use a server other than scripts/db-local.sh
```

Uses the Playwright library from `/opt/node-tools/node_modules/playwright` (override with
`PLAYWRIGHT_MODULE`); `@playwright/test` is not a dependency. Scenarios: JA full flow
(menu → time → info → confirm → done → `.ics` → cancel dialog → cancelled → invalid link), EN flow
without furigana and with no stray Japanese, keyboard-only month calendar, 320px no overflow +
44px targets, done page ≤ 844px at 390×844 (JA and EN).
