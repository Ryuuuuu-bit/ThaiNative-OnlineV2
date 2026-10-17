-- Re-runnable. Username/password accounts and a short public UID for every account.
ALTER TABLE tn2_accounts ADD COLUMN IF NOT EXISTS uid text;
ALTER TABLE tn2_accounts ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE tn2_accounts ADD COLUMN IF NOT EXISTS username_key text;
ALTER TABLE tn2_accounts ADD COLUMN IF NOT EXISTS password_hash text;
DO $$BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='tn2_accounts'::regclass AND conname='tn2_accounts_kind_check' AND pg_get_constraintdef(oid) LIKE '%password%') THEN
  ALTER TABLE tn2_accounts DROP CONSTRAINT IF EXISTS tn2_accounts_kind_check;
  ALTER TABLE tn2_accounts ADD CONSTRAINT tn2_accounts_kind_check CHECK(kind IN ('guest','google','password'));
 END IF;
END$$;
CREATE UNIQUE INDEX IF NOT EXISTS tn2_accounts_username_key ON tn2_accounts(username_key);
-- 9 random digits (not sequential, so it leaks no account count). Retries on the rare collision.
CREATE OR REPLACE FUNCTION tn2_new_uid() RETURNS text LANGUAGE plpgsql VOLATILE AS $$
DECLARE candidate text;
BEGIN
 LOOP
  candidate := (100000000 + floor(random()*900000000))::bigint::text;
  EXIT WHEN NOT EXISTS (SELECT 1 FROM tn2_accounts WHERE uid=candidate);
 END LOOP;
 RETURN candidate;
END$$;
-- Backfill (NULL→uid is the only update the trigger below allows) one row per statement so each sees the uids already assigned.
DO $$DECLARE r record;
BEGIN
 FOR r IN SELECT id FROM tn2_accounts WHERE uid IS NULL ORDER BY created_at LOOP
  UPDATE tn2_accounts SET uid=tn2_new_uid() WHERE id=r.id;
 END LOOP;
END$$;
ALTER TABLE tn2_accounts ALTER COLUMN uid SET DEFAULT tn2_new_uid();
ALTER TABLE tn2_accounts ALTER COLUMN uid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tn2_accounts_uid ON tn2_accounts(uid);
CREATE OR REPLACE FUNCTION tn2_uid_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.uid IS NOT NULL AND NEW.uid IS DISTINCT FROM OLD.uid THEN RAISE EXCEPTION 'tn2_accounts.uid is immutable'; END IF;
 RETURN NEW;
END$$;
DROP TRIGGER IF EXISTS tn2_accounts_uid_immutable ON tn2_accounts;
CREATE TRIGGER tn2_accounts_uid_immutable BEFORE UPDATE OF uid ON tn2_accounts FOR EACH ROW EXECUTE FUNCTION tn2_uid_immutable();
