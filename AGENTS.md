# AGENTS.md — engineering rules for this repository

Barber booking site (customer `/ja` `/en` + admin PWA `/admin`) for Neuer Barber.
The design in `docs/03_design/` is the source of truth; ADRs in `docs/03_design/adr/` explain why.
If code and design disagree, fix the code or record the decision (ADR / design change log).

## Stack (exact versions in package.json, `save-exact`)

Next.js 16.4 App Router (`proxy.ts`, Cache Components, Server Actions, `after()`), React 19.3,
TypeScript 6.0 (strict), Tailwind v4, next-intl 4, Drizzle ORM 0.45 + `pg`, Zod 4,
`@t3-oss/env-nextjs`, Vitest 5 + Testing Library, Biome 2.5 + ESLint 10 (Next rules + boundaries).
Postgres (Neon in production, local cluster or CI service in dev) with `btree_gist`.

## Commands

| Task | Command |
|---|---|
| Local Postgres (no Docker) | `npm run db:start` / `db:stop` / `db:status` — cluster in `.local/pg`, port 54329, writes `.env.local` on first run |
| Migrate / seed | `npm run db:migrate`, `npm run db:seed -- --activate-menus` (menus stay inactive without the flag, OI-01) |
| Reset dev + test DBs | `npm run db:reset` |
| Dev server | `npm run dev` |
| All tests | `npm test` (starts the local cluster when `TEST_DATABASE_URL` is unset) |
| Fast unit tests | `npm run test:unit` |
| Checks | `npm run typecheck`, `npm run lint`, `npm run build` (build reads menus/settings from `DATABASE_URL`) |
| New migration | edit `src/lib/db/schema.ts` → `npm run db:generate`; DSL-inexpressible SQL → `npx drizzle-kit generate --custom --name=<name>` |

## Layout (DES-00 §5)

```
src/app/(public)/[locale]/…   customer routes (root layout per locale, next-intl); booking steps live on the top page
src/app/(admin)/admin/…       admin PWA (ja only, outside next-intl)
src/app/api/…                 route handlers: ics, cron, auth, availability (GET, ADR-0010), admin GET only
src/features/<feature>/       actions.ts ('use server', thin) → service.ts (server-only) / queries.ts (DAL)
src/domain/                   pure functions (phone, kana, pricing, status machine, JST time). No I/O.
src/lib/                      env, db (schema, availability SQL), rate-limit, tokens, hash, logger, i18n …
src/components/ui/            generic UI primitives
messages/{ja,en}.json         next-intl messages (identical key sets, enforced by a test)
drizzle/                      SQL migrations (0000/0002/0004 hand-written, 0001/0003/0005/0006 generated)
```

Dependency rules (enforced by ESLint `import/no-restricted-paths` and Biome):
- `features/A` must not import `features/B`. Shared code goes to `src/domain` (pure) or `src/lib`.
- `src/domain` imports nothing from the app. `src/lib` never imports `features` or `app`.
- `process.env` only in `src/lib/env.ts` (plus config files and `scripts/`). Biome `noProcessEnv`.
- Server-only modules start with `import 'server-only'`.

## Non-negotiable rules

1. **Double booking is prevented by the database.** `bookings_no_overlap` (EXCLUDE USING gist,
   `[)` ranges, active statuses only) is the last line of defence. Never weaken it; never use
   `drizzle-kit push` (it ignores hand-written constraints). READ COMMITTED + the calendar
   advisory lock is the concurrency model — do not add SERIALIZABLE retry loops.
2. **Server Action pipeline** (public): Zod → honeypot → rate limit → Turnstile → transaction
   (lock → re-check availability with the same SQL → upsert customer → insert → audit) → `after()`
   for push. Admin: `requireAdmin()` → Zod → transaction. Expected failures are returned as
   `ActionResult` values; only unexpected errors throw. Return minimal data (`doneUrl` only).
3. **Availability is never cached** (no `"use cache"`, read under `<Suspense>`). Menus, hours and
   settings may be cached with `cacheTag` and invalidated with `updateTag`. Booking writes re-read
   menus from the DB inside the transaction.
4. **Time**: store `timestamptz` (UTC), compute and display in `Asia/Tokyo` via the IANA name
   (never hard-code `+09:00` offsets in logic). Forms send ISO strings with offset.
5. **Secrets & tokens**: cancel tokens are 32 random bytes (base64url, 43 chars); only SHA-256 is
   stored. IP / phone are stored as HMAC (`PII_HASH_SECRET`). No absolute URLs in the DB —
   build them with `absoluteUrl()` from server-only `SITE_URL`.
6. **No PII in logs, audit diffs or push payloads**: never log names, kana, phone, notes, tokens or
   token URLs, raw IPs. Use `src/lib/logger.ts` (redacts known keys) and allow-listed audit diffs.
7. **No phone number on customer pages** (OI-10): the customer contact channel is Instagram DM.
8. **Exact versions only**; `.npmrc` has `save-exact`, `engine-strict`, `ignore-scripts`.
   CI uses `npm ci`. Pin third-party GitHub Actions by commit SHA.
9. Every user-visible string goes through next-intl; add keys to **both** `ja.json` and `en.json`.
10. Tests: domain logic → unit tests; anything touching SQL/constraints → DB integration tests
    (`*.db.test.ts`, real Postgres); components → Testing Library (`*.test.tsx`). Inject `now`
    instead of mocking timers in DB tests.

## Testing notes

- DB tests run sequentially against `TEST_DATABASE_URL`; `test/db-global-setup.ts` applies the
  migrations, `test/db-helpers.ts#resetDb` truncates and re-seeds before each test.
- Service functions (`submitBooking`, `cancelByToken`) take an explicit request context
  (`ip`, `userAgent`, `now`) so they run without a Next.js request.
- Turnstile verification is skipped (with a log line) when `TURNSTILE_SECRET_KEY` is unset.
