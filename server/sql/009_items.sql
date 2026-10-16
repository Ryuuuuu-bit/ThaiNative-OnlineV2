ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS auto_seconds double precision NOT NULL DEFAULT 0;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS inventory_version integer NOT NULL DEFAULT 0;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS auto_pickup boolean NOT NULL DEFAULT true;
ALTER TABLE tn2_characters DROP CONSTRAINT IF EXISTS tn2_characters_potions_check;
CREATE TABLE IF NOT EXISTS tn2_items (
 id uuid PRIMARY KEY, template text NOT NULL, character_id uuid NOT NULL REFERENCES tn2_characters(id),
 location text NOT NULL CHECK(location IN ('bag','equip','storage','mail','escrow','market','auction')),
 slot text, slot_index integer CHECK(slot_index>=0), refine integer NOT NULL DEFAULT 0 CHECK(refine>=0), cards jsonb NOT NULL DEFAULT '[]',
 bound boolean NOT NULL DEFAULT false, source text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tn2_items ADD COLUMN IF NOT EXISTS slot_index integer CHECK(slot_index>=0);
CREATE UNIQUE INDEX IF NOT EXISTS tn2_equipment_slot ON tn2_items(character_id,slot) WHERE location='equip';
CREATE TABLE IF NOT EXISTS tn2_item_stacks (
 character_id uuid NOT NULL REFERENCES tn2_characters(id), template text NOT NULL, qty integer NOT NULL CHECK(qty>0),
 location text NOT NULL CHECK(location IN ('bag','storage','mail','escrow','market','auction')), source text NOT NULL DEFAULT 'drop',
 PRIMARY KEY(character_id,template,location)
);
CREATE TABLE IF NOT EXISTS tn2_ledger (
 id bigserial PRIMARY KEY, time timestamptz NOT NULL DEFAULT now(), kind text NOT NULL CHECK(kind IN ('drop','pickup','npc_buy','npc_sell','use','equip','unequip','discard','admin')),
 character_id uuid NOT NULL REFERENCES tn2_characters(id), item_id text, template text, qty integer NOT NULL,
 gold_delta bigint NOT NULL, room text, tick bigint, request_id uuid NOT NULL
);
CREATE INDEX IF NOT EXISTS tn2_ledger_character ON tn2_ledger(character_id);
CREATE TABLE IF NOT EXISTS tn2_requests (
 character_id uuid NOT NULL REFERENCES tn2_characters(id), req uuid NOT NULL, time timestamptz NOT NULL DEFAULT now(),
 result jsonb NOT NULL, PRIMARY KEY(character_id,req)
);
-- An invariant, including when the application role owns these tables.
CREATE OR REPLACE FUNCTION tn2_ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'tn2_ledger is append-only'; END $$;
DROP TRIGGER IF EXISTS tn2_ledger_append_only ON tn2_ledger;
CREATE TRIGGER tn2_ledger_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON tn2_ledger FOR EACH STATEMENT EXECUTE FUNCTION tn2_ledger_immutable();
REVOKE UPDATE, DELETE, TRUNCATE ON tn2_ledger FROM PUBLIC;
