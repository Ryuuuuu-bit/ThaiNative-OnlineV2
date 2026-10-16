-- Re-runnable: preserve existing cooldowns and leases.
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS boss_ready_at bigint NOT NULL DEFAULT 0;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS online_lease_until timestamptz;
ALTER TABLE tn2_characters ADD COLUMN IF NOT EXISTS online_node_id text;
CREATE INDEX IF NOT EXISTS tn2_requests_time_idx ON tn2_requests(time);
