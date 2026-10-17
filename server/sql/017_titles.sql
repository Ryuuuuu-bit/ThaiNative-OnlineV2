-- Re-runnable; historical boss counts are unknown and are never fabricated.
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS title_id text;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS unlocked_titles jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS title_records jsonb NOT NULL DEFAULT '{"bosses":{}}'::jsonb;
CREATE INDEX IF NOT EXISTS tn2_ranking_level ON tn2_characters(level DESC,xp DESC,id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tn2_ranking_hunt ON tn2_characters(kills DESC,level DESC,id) WHERE deleted_at IS NULL;
