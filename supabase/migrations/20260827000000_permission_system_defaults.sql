-- withAuth() (lib/auth/with-auth.ts) gates 49 API routes behind
-- lib/auth/rbac.ts's getUserPermissions(), which is backed entirely by the
-- roles / role_permissions / user_roles tables. In production every one of
-- those tables has zero rows for every organization -- no default roles
-- were ever created and no user was ever assigned one, so
-- get_user_permissions() returns an empty set for every user, and every
-- requireAny/requireAll check fails. This is why POST
-- /api/v1/compliance/gap-audit (and analytics, capas, dsar, esignatures,
-- workflows, resources, simulations, feedback, monitoring, kb, search, and
-- more) all 403 for every user in every org, including the owner -- not a
-- compliance-specific bug.
--
-- Separately, several permission keys the code already checks for were
-- never inserted into the permissions catalog at all (found by grepping
-- every requireAll/requireAny/hasAnyPermission literal in app/ and lib/ and
-- diffing against the existing catalog), so even a fully-populated
-- role_permissions table couldn't have granted them.
--
-- Rather than backfill user_roles/role_permissions for every existing (and
-- future) org -- which the real, working Settings > Team UI never actually
-- writes to, since it manages profiles.role directly -- this teaches
-- get_user_permissions() to also derive a default permission set from the
-- user's existing profiles.role tier. Explicit role_permissions/user_roles
-- grants (the custom fine-grained role system scaffolded elsewhere) still
-- work and are additive on top of this, for orgs that set them up later.

-- 1. Fill in the missing permission catalog rows.
INSERT INTO permissions (key, resource, action, description) VALUES
  ('capas:read', 'capas', 'read', 'View CAPA (corrective/preventive action) records'),
  ('capas:write', 'capas', 'write', 'Create and update CAPA records'),
  ('compliance:read', 'compliance', 'read', 'View compliance frameworks, scores, and audits'),
  ('compliance:write', 'compliance', 'write', 'Manage compliance frameworks and submit evidence'),
  ('documents:create', 'documents', 'create', 'Upload new documents'),
  ('documents:manage', 'documents', 'manage', 'Full document lifecycle management including versioning'),
  ('documents:update', 'documents', 'update', 'Edit existing document metadata and content'),
  ('dsar:read', 'dsar', 'read', 'View data subject access requests'),
  ('dsar:write', 'dsar', 'write', 'Process and respond to data subject access requests'),
  ('esignatures:read', 'esignatures', 'read', 'View e-signature requests and their status'),
  ('esignatures:write', 'esignatures', 'write', 'Create and manage e-signature requests'),
  ('kb:create', 'kb', 'create', 'Create knowledge base articles'),
  ('kb:update', 'kb', 'update', 'Edit knowledge base articles'),
  ('search:execute', 'search', 'execute', 'Run search queries across the platform')
ON CONFLICT (key) DO NOTHING;

-- 2. Replace get_user_permissions() to union in a role-tier-derived set.
-- owner/admin: full catalog. member: full catalog minus admin-tier
-- management actions. viewer: read-only.
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
 RETURNS TABLE(permission_key text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Direct role assignments (custom fine-grained roles, if an org set any up)
  SELECT DISTINCT p.key
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = p_user_id
  UNION
  -- Team-inherited role assignments
  SELECT DISTINCT p.key
  FROM public.team_members tm
  JOIN public.team_roles tr ON tr.team_id = tm.team_id
  JOIN public.role_permissions rp ON rp.role_id = tr.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE tm.user_id = p_user_id
  UNION
  -- Tier-derived default set from profiles.role, so every real user gets
  -- sensible access immediately without any custom role ever being created.
  SELECT p.key
  FROM public.profiles pr
  CROSS JOIN public.permissions p
  WHERE pr.id = p_user_id
    AND (
      pr.role IN ('owner', 'admin')
      OR (
        pr.role = 'member'
        AND p.key NOT IN (
          'roles:assign', 'roles:delete', 'roles:read', 'roles:write',
          'users:delete', 'users:write',
          'teams:delete', 'teams:write', 'teams:assign',
          'audit:manage',
          'billing:manage', 'billing:create',
          'organization:write',
          'retention:manage', 'retention:write',
          'workflows:delete',
          'documents:manage'
        )
      )
      OR (pr.role = 'viewer' AND p.action = 'read')
    );
$function$;
