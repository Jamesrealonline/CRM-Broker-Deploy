-- Rollback Migration 037: Revert to previous permissive policies

ALTER POLICY "profiles_select_all_authenticated" ON "public"."profiles" USING (true);
ALTER POLICY "org_select_authenticated" ON "public"."organizations" USING (true);
ALTER POLICY "regions_select_authenticated" ON "public"."regions" USING (true);
ALTER POLICY "agencies_select_authenticated" ON "public"."agencies" USING ((organization_id = current_organization_id()) OR (current_organization_id() IS NULL));
ALTER POLICY "teams_select_authenticated" ON "public"."teams" USING (true);
ALTER POLICY "knowledge_select_all" ON "public"."project_knowledge" USING (true);
ALTER POLICY "faq_select_all" ON "public"."project_faq" USING (true);
ALTER POLICY "scripts_select_all" ON "public"."sales_scripts" USING (true);
ALTER POLICY "p_contracts_select" ON "public"."contracts" USING (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
