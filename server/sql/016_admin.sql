-- Re-runnable. Stored admin role on accounts (granted by public UID), GM audit log and a once-only admin seed.
ALTER TABLE tn2_accounts ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS tn2_accounts_admin ON tn2_accounts(created_at) WHERE is_admin;
CREATE TABLE IF NOT EXISTS tn2_gm_audit (
 id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(),
 actor_account_id uuid REFERENCES tn2_accounts(id), actor_uid text, action text NOT NULL, target_uid text,
 detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS tn2_gm_audit_at ON tn2_gm_audit(at DESC);
CREATE TABLE IF NOT EXISTS tn2_admin_seeds (uid text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
-- Each seed applies once, and only once its account exists, so a later /gm admin remove survives restarts.
WITH seeded AS (
 INSERT INTO tn2_admin_seeds(uid) SELECT uid FROM tn2_accounts WHERE uid IN ('269718289') ON CONFLICT (uid) DO NOTHING RETURNING uid
), granted AS (
 UPDATE tn2_accounts a SET is_admin=true FROM seeded s WHERE a.uid=s.uid RETURNING a.uid
)
INSERT INTO tn2_gm_audit(action,target_uid,detail) SELECT 'admin.seed',uid,'{"source":"016_admin.sql"}'::jsonb FROM granted;
