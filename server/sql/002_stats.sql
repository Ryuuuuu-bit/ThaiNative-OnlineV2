ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS base_stats jsonb NOT NULL DEFAULT '{"str":5,"agi":3,"vit":4,"int":3,"dex":3,"luk":1}'::jsonb;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS race text NOT NULL DEFAULT 'human';
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS "class" text NOT NULL DEFAULT 'novice_knight';
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS stat_points integer NOT NULL DEFAULT 0;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS data_version integer NOT NULL DEFAULT 1;

-- The level-99 EXP table exceeds signed int32; retain exact integer progress.
ALTER TABLE tn2_characters ALTER COLUMN xp TYPE bigint;
