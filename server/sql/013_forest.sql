-- Re-runnable: per-boss cooldowns for field bosses other than the King (which keeps boss_ready_at).
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS boss_cooldowns jsonb NOT NULL DEFAULT '{}'::jsonb;
