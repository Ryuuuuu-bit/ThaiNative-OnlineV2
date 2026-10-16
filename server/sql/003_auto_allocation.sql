ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS auto_allocate boolean NOT NULL DEFAULT true;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS auto_alloc_cursor integer NOT NULL DEFAULT 0;
