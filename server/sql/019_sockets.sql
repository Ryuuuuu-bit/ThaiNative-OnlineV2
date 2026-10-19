-- Card slots the forge drilled into a unique item, on top of its template's own.
ALTER TABLE tn2_items ADD COLUMN IF NOT EXISTS sockets integer NOT NULL DEFAULT 0 CHECK(sockets>=0);
