-- Migration 0002: area_mentions index table
-- Purpose: lightweight index for future server-side mention queries / analytics.
-- In v1 this table is created but not yet populated; mentions are parsed client-side
-- from the document JSON.  A future background job or document-save hook will
-- populate/refresh rows here when the document is written.
--
-- To apply locally:
--   wrangler d1 execute glyco-organograma --local --file=migrations/0002_area_mentions.sql
-- To apply to production:
--   wrangler d1 execute glyco-organograma --file=migrations/0002_area_mentions.sql
-- (Do NOT include secrets or credentials in this file.)

CREATE TABLE IF NOT EXISTS area_mentions (
  id           TEXT PRIMARY KEY,        -- uuid
  area_id      TEXT NOT NULL,           -- references Area.id (in document JSON)
  area_title   TEXT NOT NULL,
  source_kind  TEXT NOT NULL,           -- 'task_description' | 'task_block' | 'responsibility'
  source_id    TEXT NOT NULL,           -- task.id or block.id
  scenario_id  TEXT NOT NULL,           -- 'atual' | 'planejada'
  updated_at   TEXT NOT NULL            -- ISO-8601 timestamp
);

CREATE INDEX IF NOT EXISTS area_mentions_area_id      ON area_mentions(area_id);
CREATE INDEX IF NOT EXISTS area_mentions_source_id    ON area_mentions(source_id);
CREATE INDEX IF NOT EXISTS area_mentions_scenario_id  ON area_mentions(scenario_id);
