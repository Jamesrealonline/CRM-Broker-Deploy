-- Rollback 036: Revert project multi-tenant policies
NOTIFY pgrst, 'reload schema';
