-- Version 3: preserve base progress; defer legacy villagers to the creation picker.
UPDATE tn2_characters SET job_id='needs_job',"class"='needs_job',job_level=1,job_exp=0,
 skill_points=1,skills='{"basic":1,"dodge":1,"potion":1}',hotbar='[]',jobs_version=3
 WHERE job_id='villager';
UPDATE tn2_characters SET
 skill_points=skill_points+COALESCE((skills->>'fighter_basics')::integer,0),
 skills=skills-'punch'-'fighter_basics',
 hotbar=COALESCE((SELECT jsonb_agg(CASE WHEN slot->>'skill' IN ('punch','fighter_basics') THEN jsonb_set(slot,'{skill}','null'::jsonb) ELSE slot END ORDER BY ord)
 FROM jsonb_array_elements(hotbar) WITH ORDINALITY AS entries(slot,ord)),'[]'::jsonb),
 jobs_version=3 WHERE jobs_version<3;
ALTER TABLE tn2_characters ALTER COLUMN job_id SET DEFAULT 'swordsman';
ALTER TABLE tn2_characters ALTER COLUMN "class" SET DEFAULT 'swordsman';
ALTER TABLE tn2_characters ALTER COLUMN jobs_version SET DEFAULT 3;
ALTER TABLE tn2_characters ALTER COLUMN skill_points SET DEFAULT 1;
ALTER TABLE tn2_characters ALTER COLUMN hotbar SET DEFAULT '[{"key":"Digit1","skill":"slash"},{"key":"Digit2","skill":"whirlwind"},{"key":"Digit3","skill":"dash_strike"},{"key":"Digit4","skill":"earth_break"},{"key":"Digit5","skill":"endure"},{"key":"Digit6","skill":"provoke"},{"key":"Digit7","skill":null},{"key":"Digit8","skill":null},{"key":"Digit9","skill":null},{"key":"Digit0","skill":null}]';
