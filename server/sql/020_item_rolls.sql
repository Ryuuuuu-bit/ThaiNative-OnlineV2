-- Additive: existing items retain their base stats; only newly rolled loot has this payload.
ALTER TABLE tn2_items ADD COLUMN IF NOT EXISTS roll jsonb;
