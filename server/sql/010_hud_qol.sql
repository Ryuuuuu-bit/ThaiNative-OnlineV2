ALTER TABLE tn2_accounts ADD COLUMN IF NOT EXISTS ui_settings jsonb;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS return_ready_at double precision NOT NULL DEFAULT 0;
