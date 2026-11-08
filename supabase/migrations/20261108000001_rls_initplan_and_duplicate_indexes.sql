-- Wrap auth.*() calls in RLS policies in a sub-select so Postgres evaluates them once per query, not per row.
-- Policy logic is unchanged. Supabase advisor lint: auth_rls_initplan.
ALTER POLICY "Users can view their org's analytics" ON public."analytics_metrics" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "dashboard_stats_select_org" ON public."dashboard_stats" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's staff" ON public."healthcare_staff" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's medications" ON public."healthcare_medications" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's prescriptions" ON public."healthcare_prescriptions" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's lab orders" ON public."healthcare_lab_orders" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's radiology orders" ON public."healthcare_radiology_orders" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's OR schedule" ON public."healthcare_or_schedule" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's supplies" ON public."healthcare_supplies" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's incidents" ON public."healthcare_incidents" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's feedback" ON public."healthcare_feedback" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's billing" ON public."healthcare_billing" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's compliance" ON public."healthcare_compliance" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "usage_select_member" ON public."usage" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org api keys" ON public."api_keys" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "api_keys_manage_admin" ON public."api_keys" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
ALTER POLICY "api_keys_select_admin" ON public."api_keys" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
ALTER POLICY "workflows_select_own_org" ON public."workflows" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "workflow_executions_select_own_org" ON public."workflow_executions" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "workflow_tasks_select_own_org" ON public."workflow_tasks" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "business_profiles_org_access" ON public."business_profiles" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "industry_intelligence_org_access" ON public."industry_intelligence" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "ai_learning_feedback_org_access" ON public."ai_learning_feedback" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "onboarding_progress_org_access" ON public."onboarding_progress" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org deals" ON public."crm_deals" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "crm_deals_insert" ON public."crm_deals" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "crm_deals_select" ON public."crm_deals" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org contacts" ON public."crm_contacts" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "crm_contacts_insert" ON public."crm_contacts" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "crm_contacts_select" ON public."crm_contacts" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org activities" ON public."crm_activities" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "crm_activities_select" ON public."crm_activities" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org quotes" ON public."crm_quotes" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org timeline" ON public."crm_timeline" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org tasks" ON public."crm_tasks" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org communications" ON public."crm_communications" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org templates" ON public."crm_templates" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org customer accounts" ON public."customer_accounts" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org support tickets" ON public."support_tickets" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org lead scores" ON public."crm_lead_scores" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org crm events" ON public."crm_events" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's services" ON public."organization_services" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "role_permissions_select_own_org" ON public."role_permissions" USING ((role_id IN ( SELECT roles.id
   FROM roles
  WHERE (roles.organization_id IN ( SELECT profiles.organization_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "user_roles_select_own_org" ON public."user_roles" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "teams_select_own_org" ON public."teams" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "team_members_select_own_org" ON public."team_members" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "team_roles_select_own_org" ON public."team_roles" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org whatsapp messages" ON public."whatsapp_messages" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org crm integration status" ON public."crm_integration_status" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can insert patients to their org" ON public."healthcare_patients" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can update their org's patients" ON public."healthcare_patients" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's healthcare patients" ON public."healthcare_patients" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's departments" ON public."healthcare_departments" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can update their org's alerts" ON public."healthcare_alerts" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's alerts" ON public."healthcare_alerts" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "ai_conversations_select_own" ON public."ai_conversations" USING (((user_id = (SELECT auth.uid())) AND (organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid()))))));
ALTER POLICY "ai_messages_select_own_org" ON public."ai_messages" USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))) AND (conversation_id IN ( SELECT ai_conversations.id
   FROM ai_conversations
  WHERE (ai_conversations.user_id = (SELECT auth.uid()))))));
ALTER POLICY "Users can view their org ai recommendations" ON public."ai_recommendations" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "ai_recommendations_org_access" ON public."ai_recommendations" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "analytics_events_select_own_org" ON public."analytics_events" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "analytics_reports_select_own_org" ON public."analytics_reports" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "billing_events_select_admin" ON public."billing_events" USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))) AND (EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = (SELECT auth.uid())) AND (r.organization_id = billing_events.organization_id) AND (r.is_system OR (lower(r.name) ~~* '%admin%'::text)))))));
ALTER POLICY "notifications_delete_own" ON public."notifications" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "notifications_select_own" ON public."notifications" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "notifications_update_own" ON public."notifications" USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "Users can view their own notification preferences" ON public."notification_preferences" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "notification_prefs_all_own" ON public."notification_preferences" USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "documents_insert_org" ON public."documents" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "documents_select_org" ON public."documents" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "doc_folders_rw" ON public."document_folders" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid()))))) WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org feedback" ON public."feedback" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "feedback_insert_org" ON public."feedback" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "feedback_select_org" ON public."feedback" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org feedback comments" ON public."feedback_comments" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "feedback_comments_insert" ON public."feedback_comments" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "feedback_comments_select" ON public."feedback_comments" USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))) AND ((is_internal = false) OR (EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = (SELECT auth.uid())) AND (r.organization_id = feedback_comments.organization_id) AND (r.is_system OR (lower(r.name) ~~* '%admin%'::text))))))));
ALTER POLICY "doc_versions_select_org" ON public."document_versions" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "report_defs_insert" ON public."report_definitions" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "report_defs_select" ON public."report_definitions" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "report_runs_select" ON public."report_runs" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org report schedules" ON public."report_schedules" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "report_sched_select" ON public."report_schedules" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "monitors_insert" ON public."monitors" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "monitors_select" ON public."monitors" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "monitor_checks_select" ON public."monitor_checks" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "incidents_insert" ON public."incidents" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "incidents_select" ON public."incidents" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "incident_events_select" ON public."incident_events" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "integrations_insert" ON public."integrations" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "integrations_select" ON public."integrations" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "int_deliveries_select" ON public."integration_deliveries" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "crm_companies_insert" ON public."crm_companies" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "crm_companies_select" ON public."crm_companies" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "kb_categories_insert" ON public."kb_categories" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "kb_categories_select" ON public."kb_categories" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "kb_articles_insert" ON public."kb_articles" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "kb_articles_select" ON public."kb_articles" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "kb_feedback_select" ON public."kb_article_feedback" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "kb_feedback_upsert" ON public."kb_article_feedback" WITH CHECK (((user_id = (SELECT auth.uid())) AND (organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid()))))));
ALTER POLICY "legal_docs_insert" ON public."legal_documents" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "legal_docs_select" ON public."legal_documents" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "legal_consents_insert" ON public."legal_consents" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "legal_consents_select" ON public."legal_consents" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "retention_policies_insert" ON public."retention_policies" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "retention_policies_select" ON public."retention_policies" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "retention_runs_select" ON public."retention_runs" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org dsar requests" ON public."dsar_requests" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "dsar_insert" ON public."dsar_requests" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "dsar_select" ON public."dsar_requests" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org capa records" ON public."capa_records" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org payables" ON public."accounts_payable" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org objectives" ON public."okr_objectives" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "locales_insert" ON public."locales" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "locales_select" ON public."locales" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "tkeys_insert" ON public."translation_keys" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "tkeys_select" ON public."translation_keys" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "translations_insert" ON public."translations" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "translations_select" ON public."translations" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org key results" ON public."okr_key_results" USING ((objective_id IN ( SELECT okr_objectives.id
   FROM okr_objectives
  WHERE (okr_objectives.organization_id = ( SELECT profiles.organization_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "Users can view their org inventory" ON public."inventory_items" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org bookings" ON public."resource_bookings" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org workspaces" ON public."workspaces" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org settings" ON public."organization_settings" USING ((id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org usage records" ON public."usage_records" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org webhook endpoints" ON public."webhook_endpoints" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org webhook deliveries" ON public."webhook_deliveries" USING ((endpoint_id IN ( SELECT webhook_endpoints.id
   FROM webhook_endpoints
  WHERE (webhook_endpoints.organization_id = ( SELECT profiles.organization_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "Users can view their org connectors" ON public."connectors" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org retention policies" ON public."audit_retention_policies" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org retention history" ON public."audit_retention_history" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org assets" ON public."assets" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org asset telemetry" ON public."asset_telemetry" USING ((asset_id IN ( SELECT assets.id
   FROM assets
  WHERE (assets.organization_id = ( SELECT profiles.organization_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "Users can view their org skill requirements" ON public."skill_requirements" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org skill profiles" ON public."skill_profiles" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org auth audit logs" ON public."auth_audit_logs" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org digit scores" ON public."digit_scores" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their own row" ON public."users" USING (((SELECT auth.uid()) = id));
ALTER POLICY "Users can view their org billing analytics" ON public."billing_analytics" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can manage their own devices" ON public."user_devices" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Users can view their org operational reports" ON public."operational_reports" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org intelligence briefings" ON public."intelligence_briefings" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org compliance evidence" ON public."compliance_evidence" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org compliance certificates" ON public."compliance_certificates" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org compliance frameworks" ON public."compliance_frameworks" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org dunning attempts" ON public."dunning_attempts" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org hitl reviews" ON public."hitl_reviews" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org workspace events" ON public."workspace_events" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org asset tags" ON public."asset_tags" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org asset scans" ON public."asset_scans" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org renewal reminders" ON public."renewal_reminders" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org onboarding steps" ON public."onboarding_steps" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org onboarding plans" ON public."onboarding_plans" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org booking slots" ON public."booking_slots" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org alert rules" ON public."alert_rules" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org alert events" ON public."alert_events" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org elt pipelines" ON public."elt_pipelines" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org elt run logs" ON public."elt_run_logs" USING ((pipeline_id IN ( SELECT elt_pipelines.id
   FROM elt_pipelines
  WHERE (elt_pipelines.organization_id = ( SELECT profiles.organization_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "Users can view their org elt sync log" ON public."elt_sync_log" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org semantic metrics" ON public."semantic_metrics" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org semantic dimensions" ON public."semantic_dimensions" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org scheduled reports" ON public."scheduled_reports" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org uploaded files" ON public."uploaded_files" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org document reports" ON public."document_reports" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their own oauth accounts" ON public."oauth_accounts" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Users can view their own kyc results" ON public."kyc_verification_results" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Users can view their own kyc reviews" ON public."kyc_verification_reviews" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Users can view their own company verification reviews" ON public."company_verification_reviews" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Users can view their org members" ON public."organization_members" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org role approval requests" ON public."role_approval_requests" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their own workspace access" ON public."workspace_users" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Users can view their org correlated events" ON public."correlated_events" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org datasets" ON public."datasets" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org ai models" ON public."ai_models" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org scheduled tasks" ON public."intelligence_scheduled_tasks" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view controls of their org frameworks" ON public."compliance_controls" USING ((framework_id IN ( SELECT compliance_frameworks.id
   FROM compliance_frameworks
  WHERE (compliance_frameworks.organization_id = ( SELECT profiles.organization_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "Users can view their org audit trail" ON public."compliance_audit_trail" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org traceability matrices" ON public."traceability_matrices" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org esignature requests" ON public."esignature_requests" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org esignature records" ON public."esignature_records" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org signature requests" ON public."signature_requests" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org companies" ON public."companies" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org deals" ON public."deals" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org activities" ON public."activities" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org consent records" ON public."consent_records" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org simulations" ON public."simulations" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their own sessions" ON public."sessions" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "Users can update their own organization" ON public."organizations" USING ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their own organization" ON public."organizations" USING ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "organizations_select_member" ON public."organizations" USING ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "organizations_update_admin" ON public."organizations" USING ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
ALTER POLICY "audit_logs_insert_own_org" ON public."audit_logs" WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "audit_logs_select_admin" ON public."audit_logs" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
ALTER POLICY "Users can update their own profile" ON public."profiles" USING ((id = (SELECT auth.uid())));
ALTER POLICY "Users can view their own profile" ON public."profiles" USING ((id = (SELECT auth.uid())));
ALTER POLICY "profiles_insert_own" ON public."profiles" WITH CHECK (((SELECT auth.uid()) = id));
ALTER POLICY "profiles_select_own" ON public."profiles" USING (((SELECT auth.uid()) = id));
ALTER POLICY "profiles_update_own" ON public."profiles" USING (((SELECT auth.uid()) = id));
ALTER POLICY "Users can view their own feedback" ON public."recommendation_feedback" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "Org members can view their recording action items" ON public."recording_action_items" USING ((recording_id IN ( SELECT recordings.id
   FROM recordings
  WHERE (recordings.organization_id IN ( SELECT profiles.organization_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "Org members can view their recordings" ON public."recordings" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Org members can view their recording segments" ON public."recording_segments" USING ((recording_id IN ( SELECT recordings.id
   FROM recordings
  WHERE (recordings.organization_id IN ( SELECT profiles.organization_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "Org members can view their bulk files" ON public."bulk_files" USING ((job_id IN ( SELECT bulk_jobs.id
   FROM bulk_jobs
  WHERE (bulk_jobs.organization_id IN ( SELECT profiles.organization_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "Authenticated users can view discount codes" ON public."discount_codes" USING (((SELECT auth.uid()) IS NOT NULL));
ALTER POLICY "Users can view their org discount redemptions" ON public."discount_redemptions" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Org members can view their bulk jobs" ON public."bulk_jobs" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org skill catalog" ON public."hr_skill_catalog" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org skill assessments" ON public."hr_skill_assessments" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can delete their own passkeys" ON public."passkeys" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Users can read their own passkeys" ON public."passkeys" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "Users can view their own onboarding response" ON public."onboarding_responses" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "Users can view their org document tasks" ON public."document_tasks" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org roles" ON public."roles" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "roles_select_own_org" ON public."roles" USING ((organization_id IN ( SELECT user_roles.organization_id
   FROM user_roles
  WHERE (user_roles.user_id = (SELECT auth.uid()))
UNION
 SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org feedback votes" ON public."feedback_votes" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "feedback_votes_delete" ON public."feedback_votes" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "feedback_votes_insert" ON public."feedback_votes" WITH CHECK (((user_id = (SELECT auth.uid())) AND (organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid()))))));
ALTER POLICY "feedback_votes_select" ON public."feedback_votes" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org nps responses" ON public."nps_responses" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org intelligence findings" ON public."intelligence_findings" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org domain events" ON public."domain_events" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can manage their org event subscriptions" ON public."event_subscriptions" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org background jobs" ON public."background_jobs" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org document events" ON public."document_events" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org workflow runs" ON public."workflow_runs" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org human action requests" ON public."human_action_requests" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org har assignments" ON public."har_assignments" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org har actions" ON public."har_actions" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org's subscription" ON public."subscriptions" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "subscriptions_manage_admin" ON public."subscriptions" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
ALTER POLICY "subscriptions_select_member" ON public."subscriptions" USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org billing account" ON public."billing_accounts" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org payment methods" ON public."payment_methods" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org invoices" ON public."invoices" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org payments" ON public."payments" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org instalment schedule" ON public."instalment_schedule" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can view their org export requests" ON public."export_requests" USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

-- Drop exact duplicate indexes (Supabase advisor lint: duplicate_index). Constraint-backed indexes are kept.
DROP INDEX IF EXISTS public."idx_api_keys_organization";
DROP INDEX IF EXISTS public."idx_audit_logs_organization";
DROP INDEX IF EXISTS public."idx_feedback_org_time";
DROP INDEX IF EXISTS public."idx_feedback_votes_desc";
DROP INDEX IF EXISTS public."idx_notification_preferences_unique";
DROP INDEX IF EXISTS public."passkeys_user_id_idx";
DROP INDEX IF EXISTS public."idx_passkeys_credential_id";
DROP INDEX IF EXISTS public."idx_profiles_organization";
DROP INDEX IF EXISTS public."idx_report_schedules_org";
DROP INDEX IF EXISTS public."idx_report_schedules_definition";
DROP INDEX IF EXISTS public."idx_subscriptions_organization";
DROP INDEX IF EXISTS public."idx_subscriptions_stripe_customer_id";
DROP INDEX IF EXISTS public."idx_webhook_events_provider_event";
