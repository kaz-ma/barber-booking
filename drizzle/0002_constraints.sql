-- Custom migration (ADR-0003): what the Drizzle DSL cannot express.

-- FR-S-01 / M-02: no two active bookings may overlap on the same resource.
-- `during` is half-open [start, end) (CHECK bookings_during_half_open), so 18:00-19:00 and
-- 19:00-20:00 do not conflict. Cancelled / completed / no_show rows are excluded by WHERE,
-- so a cancelled slot can be booked again. Violations raise SQLSTATE 23P01.
-- This holds under READ COMMITTED: the GiST exclusion check sees concurrent uncommitted
-- inserts and makes the second one wait / fail, so no SERIALIZABLE retry loop is needed.
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (resource_id WITH =, during WITH &&)
  WHERE (status IN ('confirmed', 'arrived', 'in_progress'));
--> statement-breakpoint
-- bookings.consent_id <-> consents.booking_id reference each other; DEFERRABLE lets one
-- transaction insert both rows in any order (checked at COMMIT).
ALTER TABLE bookings ADD CONSTRAINT bookings_consent_fk
  FOREIGN KEY (consent_id) REFERENCES consents(id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE consents ADD CONSTRAINT consents_booking_fk
  FOREIGN KEY (booking_id) REFERENCES bookings(id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER menus_updated_at BEFORE UPDATE ON menus FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER time_blocks_updated_at BEFORE UPDATE ON time_blocks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
