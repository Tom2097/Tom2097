-- These SECURITY DEFINER functions operate on platform-wide materialized
-- views. PostgreSQL grants EXECUTE to PUBLIC on new functions unless it is
-- explicitly revoked, which allowed anonymous RPC callers to trigger costly
-- global refreshes and observe cross-tenant aggregate row counts.

ALTER FUNCTION public.refresh_known_materialized_view(TEXT)
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.refresh_known_materialized_view(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_known_materialized_view(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_known_materialized_view(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_known_materialized_view(TEXT) TO service_role;

ALTER FUNCTION public.count_materialized_view_rows(TEXT)
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.count_materialized_view_rows(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_materialized_view_rows(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.count_materialized_view_rows(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.count_materialized_view_rows(TEXT) TO service_role;
