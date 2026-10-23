-- Version zero is backfilled from the accepted catalog by PostgresStore.init in this transaction.
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS masteries jsonb;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS mastery_exp jsonb;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS mastery_version smallint NOT NULL DEFAULT 0 CHECK (mastery_version >= 0);
