ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female'));
