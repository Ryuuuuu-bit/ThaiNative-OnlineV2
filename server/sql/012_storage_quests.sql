-- Re-runnable: storage + quest ledger kinds and per-character quest state.
-- Later migrations add trade kinds; never narrow their constraint on restart.
DO $$BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='tn2_ledger'::regclass AND conname='tn2_ledger_kind_check' AND pg_get_constraintdef(oid) LIKE '%storage_in%') THEN
  ALTER TABLE tn2_ledger DROP CONSTRAINT IF EXISTS tn2_ledger_kind_check;
  ALTER TABLE tn2_ledger ADD CONSTRAINT tn2_ledger_kind_check CHECK(kind IN ('drop','pickup','npc_buy','npc_sell','use','equip','unequip','discard','admin','storage_in','storage_out','quest'));
 END IF;
END$$;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS quests jsonb NOT NULL DEFAULT '{}'::jsonb;
