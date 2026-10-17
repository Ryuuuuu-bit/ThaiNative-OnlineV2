-- Re-runnable: storage + quest ledger kinds and per-character quest state.
ALTER TABLE tn2_ledger DROP CONSTRAINT IF EXISTS tn2_ledger_kind_check;
ALTER TABLE tn2_ledger ADD CONSTRAINT tn2_ledger_kind_check CHECK(kind IN ('drop','pickup','npc_buy','npc_sell','use','equip','unequip','discard','admin','storage_in','storage_out','quest'));
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS quests jsonb NOT NULL DEFAULT '{}'::jsonb;
