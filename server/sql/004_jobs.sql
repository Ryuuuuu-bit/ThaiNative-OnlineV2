ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS job_id text;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS job_level integer NOT NULL DEFAULT 1;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS job_exp bigint NOT NULL DEFAULT 0;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS skill_points integer NOT NULL DEFAULT 0;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '{}';
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS hotbar jsonb NOT NULL DEFAULT '[]';
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS jobs_version integer NOT NULL DEFAULT 1;
UPDATE tn2_characters SET jobs_version=0,job_id='swordsman',"class"='swordsman',job_level=1,job_exp=0,
 skill_points=LEAST(49,9+level-1),skills='{"basic":1,"dodge":1,"potion":1,"whirlwind":1,"earth_break":1}',
 hotbar='[{"key":"KeyQ","skill":"whirlwind"},{"key":"KeyE","skill":"earth_break"},{"key":"Digit1","skill":null},{"key":"Digit2","skill":null},{"key":"Digit3","skill":null},{"key":"Digit4","skill":null},{"key":"Digit5","skill":"potion"},{"key":"Digit6","skill":null},{"key":"Digit7","skill":null},{"key":"Digit8","skill":null}]'
 WHERE job_id IS NULL;
ALTER TABLE tn2_characters ALTER COLUMN job_id SET DEFAULT 'villager';
ALTER TABLE tn2_characters ALTER COLUMN job_id SET NOT NULL;
ALTER TABLE tn2_characters ALTER COLUMN "class" SET DEFAULT 'villager';
ALTER TABLE tn2_characters ALTER COLUMN skills SET DEFAULT '{"basic":1,"dodge":1,"potion":1}';
ALTER TABLE tn2_characters ALTER COLUMN hotbar SET DEFAULT '[{"key":"KeyQ","skill":"basic"},{"key":"KeyE","skill":"dodge"},{"key":"Digit1","skill":null},{"key":"Digit2","skill":null},{"key":"Digit3","skill":null},{"key":"Digit4","skill":null},{"key":"Digit5","skill":"potion"},{"key":"Digit6","skill":null},{"key":"Digit7","skill":null},{"key":"Digit8","skill":null}]';
