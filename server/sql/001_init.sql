CREATE TABLE IF NOT EXISTS tn2_accounts (
 id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('guest','google')), google_sub text UNIQUE,
 display_name text NOT NULL, guest_key_hash text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), last_login_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tn2_characters (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES tn2_accounts(id), name text NOT NULL, name_key text NOT NULL,
 level integer NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 99), xp integer NOT NULL DEFAULT 0 CHECK(xp>=0), gold integer NOT NULL DEFAULT 0 CHECK(gold>=0),
 kills integer NOT NULL DEFAULT 0 CHECK(kills>=0), potions integer NOT NULL DEFAULT 5 CHECK(potions BETWEEN 0 AND 5), pos_x double precision, pos_z double precision,
 created_at timestamptz NOT NULL DEFAULT now(), last_played_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS tn2_character_name_active ON tn2_characters(name_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tn2_character_account ON tn2_characters(account_id);
CREATE TABLE IF NOT EXISTS tn2_sessions (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES tn2_accounts(id), token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), user_agent text NOT NULL, selected_character_id uuid REFERENCES tn2_characters(id)
);
CREATE INDEX IF NOT EXISTS tn2_session_expiry ON tn2_sessions(expires_at);
