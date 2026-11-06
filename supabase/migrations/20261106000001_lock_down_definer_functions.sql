-- Resolves Supabase security advisor findings. SECURITY DEFINER functions ignore
-- RLS and had no caller checks, yet anyone holding the public anon key could call
-- them through /rest/v1/rpc. All are called through the service-role client, apart
-- from the two permission helpers noted below.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.analytics_event_breakdown(uuid,text,text,text,timestamptz,timestamptz,text,integer)',
    'public.analytics_event_summary(uuid,timestamptz,timestamptz)',
    'public.analytics_event_timeseries(uuid,text,text,timestamptz,timestamptz,text,text)',
    'public.audit_retention_cleanup(uuid,integer)',
    'public.check_email_registered(text)',
    'public.count_materialized_view_rows(text)',
    'public.data_retention_purge(uuid,text,integer)',
    'public.get_audit_log_stats(uuid,integer)',
    'public.get_due_monitors(integer)',
    'public.get_due_report_schedules(integer)',
    'public.get_due_retention_policies(integer)',
    'public.get_hospital_data(uuid)',
    'public.get_pending_integration_deliveries(integer)',
    'public.handle_new_user()',
    'public.increment_kb_article_views(uuid,uuid)',
    'public.notification_unread_count(uuid,uuid)',
    'public.refresh_known_materialized_view(text)',
    'public.seed_default_roles(uuid)'
  ]::regprocedure[] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- get_user_permissions and user_has_permission are deliberately left callable:
-- lib/auth/rbac.ts has called them with a cookie-only client, so mobile Bearer
-- requests reach them as anon. Revoke these only after the rbac.ts change that
-- moves them to the service client is deployed.

-- Pin search_path so these functions cannot resolve objects through a
-- caller-controlled path. Matches the previous effective path.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.claim_due_jobs(integer)',
    'public.claim_founding_slot(uuid,uuid)',
    'public.count_materialized_view_rows(text)',
    'public.get_hospital_data(uuid)',
    'public.merge_document_metadata(uuid,uuid,jsonb)',
    'public.next_invoice_number()',
    'public.redeem_discount_code(text,uuid,text)',
    'public.refresh_known_materialized_view(text)',
    'public.sync_feedback_vote_count()',
    'public.touch_crm_updated_at()',
    'public.touch_documents_updated_at()',
    'public.touch_feedback_updated_at()',
    'public.touch_integration_updated_at()',
    'public.touch_kb_updated_at()',
    'public.touch_legal_updated_at()',
    'public.touch_localization_updated_at()',
    'public.touch_monitoring_updated_at()',
    'public.touch_report_updated_at()',
    'public.touch_retention_updated_at()',
    'public.transfer_org_ownership(uuid,uuid,uuid)'
  ]::regprocedure[] LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', fn);
  END LOOP;
END $$;

-- These hold every tenant's scores and are only read through the service role.
REVOKE ALL ON public.digit_scores_summary FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.organization_score_benchmarks FROM PUBLIC, anon, authenticated;

-- Read only by the founding-slots API route, through the service role.
ALTER VIEW public.founding_slots_public SET (security_invoker = true);
REVOKE ALL ON public.founding_slots_public FROM PUBLIC, anon, authenticated;
