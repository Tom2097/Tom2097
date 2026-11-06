-- Follows 20261106000001. These two stayed callable until lib/auth/rbac.ts moved
-- to the service client, because mobile Bearer requests reached them as anon.
REVOKE EXECUTE ON FUNCTION public.get_user_permissions(uuid), public.user_has_permission(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid), public.user_has_permission(uuid, text) TO service_role;
