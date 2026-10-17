-- Re-runnable: per-character auto-potion thresholds (null = defaults, both off).
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS auto_potion jsonb;
