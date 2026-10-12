-- Custom migration (ADR-0003). Extensions must exist before 0001_init / 0002_constraints.
-- btree_gist: lets the EXCLUDE constraint combine smallint `=` with tstzrange `&&`.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- pg_trgm: partial match on customers.name_kana (FR-A-13, Should).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
