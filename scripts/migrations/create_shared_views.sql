-- Frozen shareable distribution views
-- Run once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS shared_views (
  id           text        PRIMARY KEY,           -- 8-char slug, e.g. "ab3x7qzm"
  client       text        NOT NULL,              -- 'beiersdorf' for now
  filter_state jsonb       NOT NULL DEFAULT '{}', -- { state, rep, classification, search }
  snapshot     jsonb       NOT NULL DEFAULT '[]', -- array of { id, name, state, chain, banner, address, region, rep, rows[] }
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   text        NULL                   -- email of creator, nullable
);

ALTER TABLE shared_views ENABLE ROW LEVEL SECURITY;

-- Public read — no role restriction so anon, authenticated, and service_role all match.
-- TO anon alone does not match unauthenticated Supabase JS client requests reliably.
DO $$ BEGIN
  CREATE POLICY "public_select_shared_views"
    ON shared_views
    FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Authenticated users can insert (Share button fires under active session)
DO $$ BEGIN
  CREATE POLICY "auth_insert_shared_views"
    ON shared_views
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No UPDATE or DELETE policies — rows are immutable once created.

-- Explicit SELECT grant needed for anon role — RLS policy alone is not sufficient.
GRANT SELECT ON shared_views TO anon;
