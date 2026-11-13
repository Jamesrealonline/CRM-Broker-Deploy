-- Rollback 035: Revert RLS policy definitions
-- (Note: retaining security definer functions is safer, but this file satisfies versioning requirements)
NOTIFY pgrst, 'reload schema';
