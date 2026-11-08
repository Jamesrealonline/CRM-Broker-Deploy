-- ========================================================
-- ROLLBACK SCRIPT FOR MIGRATION 016
-- ========================================================

DROP POLICY IF EXISTS "lead_sources_update_authenticated" ON lead_sources;
DROP POLICY IF EXISTS "lead_sources_insert_authenticated" ON lead_sources;
DROP POLICY IF EXISTS "lead_sources_select_all" ON lead_sources;
