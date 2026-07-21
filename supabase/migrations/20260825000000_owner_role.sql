-- profiles.role is a bare TEXT column with no CHECK constraint -- production
-- has admin/member/viewer values in practice, with no distinct owner. The
-- founder's target model adds a genuine Owner role (billing, org deletion,
-- promoting/demoting Admins, transferring ownership) on top of the working
-- Admin/Member/Viewer set that already backs the invite flow
-- (app/api/v1/auth/invite/route.ts's ALLOWED_ROLES). This migration:
--
-- 1. Normalizes any role value outside the target set to 'member' *before*
--    adding the CHECK constraint. This worktree has no DB access to confirm
--    exactly what's in profiles.role in production, so the constraint is
--    written defensively -- it must be impossible for this migration to
--    fail on unexpected legacy data, rather than assuming only
--    admin/member/viewer are present.
-- 2. Backfills a real owner per organization: the admin-role profile with
--    the earliest created_at in that org becomes 'owner' (a reasonable
--    stand-in for "whoever's actually paying" on orgs that already exist,
--    since new self-signups up to this point were created as 'admin' --
--    see app/auth/callback/route.ts's ensureUserProfile, which now inserts
--    'owner' instead of 'admin' for brand-new orgs going forward). Only
--    admin-role rows are touched -- existing member/viewer rows are left
--    alone, and orgs with zero admin-role profiles are skipped (nothing to
--    promote).
-- 3. Adds the CHECK constraint so 'owner' is a real, enforced value.
-- 4. Adds an atomic transfer_org_ownership() RPC (same
--    claim-then-verify-then-rollback-on-failure pattern as
--    redeem_discount_code() in 20260718090000_discount_redemptions.sql) so
--    app/api/v1/auth/team/transfer-ownership/route.ts can never leave an
--    org with zero or multiple owners, even under concurrent calls.
--
-- Defensive (IF NOT EXISTS / re-runnable) throughout, per this repo's
-- established migration convention.

-- 1. Normalize anything unexpected to 'member' first, so the CHECK
--    constraint below can never fail on legacy data this worktree can't
--    inspect.
UPDATE profiles
SET role = 'member'
WHERE role IS NULL OR role NOT IN ('owner', 'admin', 'member', 'viewer');

-- 2. Backfill: promote the earliest-created admin-role profile in each org
--    to 'owner'. The correlated subquery picks, per organization_id, the id
--    of the admin-role profile with the earliest created_at (ties broken by
--    id for determinism) -- exactly one row per org matches and gets
--    updated. Orgs with no admin-role profiles have no matching row here
--    and are left untouched.
DO $$
BEGIN
  UPDATE profiles p
  SET role = 'owner'
  WHERE p.role = 'admin'
    AND p.id = (
      SELECT p2.id
      FROM profiles p2
      WHERE p2.organization_id = p.organization_id
        AND p2.role = 'admin'
      ORDER BY p2.created_at ASC, p2.id ASC
      LIMIT 1
    );
END $$;

-- 3. Enforce the 4-value per-org role set at the DB level. Guarded so this
--    migration can be re-run without erroring on an already-added
--    constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
  END IF;
END $$;

-- 4. Atomic ownership transfer: demotes the current owner to 'admin' and
--    promotes the target to 'owner' in one function invocation (Postgres
--    functions run inside the calling statement's transaction, so both
--    updates commit or roll back together). The first UPDATE's WHERE
--    clause requires the caller to currently hold 'owner' in this exact
--    org -- if that predicate doesn't match (stale caller, or a concurrent
--    transfer already ran), zero rows update and the function returns
--    false before touching the new owner at all. If the new-owner update
--    then fails to match exactly one row (target not in this org), the
--    demotion is rolled back by hand so the org is never left without an
--    owner. Returns true only when the transfer fully succeeded.
CREATE OR REPLACE FUNCTION transfer_org_ownership(
  p_organization_id UUID,
  p_current_owner_id UUID,
  p_new_owner_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE profiles
  SET role = 'admin'
  WHERE id = p_current_owner_id
    AND organization_id = p_organization_id
    AND role = 'owner';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RETURN FALSE;
  END IF;

  UPDATE profiles
  SET role = 'owner'
  WHERE id = p_new_owner_id
    AND organization_id = p_organization_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    -- New owner row didn't exist / wasn't in this org -- undo the
    -- demotion above so we never leave the org without an owner.
    UPDATE profiles
    SET role = 'owner'
    WHERE id = p_current_owner_id
      AND organization_id = p_organization_id;
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION transfer_org_ownership(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transfer_org_ownership(UUID, UUID, UUID) TO service_role;
