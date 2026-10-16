-- NULL marks characters that have never received the map migration.
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS map_id text;
UPDATE tn2_characters SET map_id='city_plaza',pos_x=0,pos_z=5 WHERE map_id IS NULL;
ALTER TABLE tn2_characters ALTER COLUMN map_id SET DEFAULT 'city_plaza';
ALTER TABLE tn2_characters ALTER COLUMN map_id SET NOT NULL;
ALTER TABLE tn2_characters ALTER COLUMN pos_x SET DEFAULT 0;
ALTER TABLE tn2_characters ALTER COLUMN pos_z SET DEFAULT 5;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS healer_ready_at bigint NOT NULL DEFAULT 0;
