-- Rollback for 20261108000002: recreate the original policies.

-- ai_recommendations
DROP POLICY "ai_recommendations_select_auth" ON public."ai_recommendations";
DROP POLICY "ai_recommendations_select_anon" ON public."ai_recommendations";
DROP POLICY "ai_recommendations_insert_auth" ON public."ai_recommendations";
DROP POLICY "ai_recommendations_insert_anon" ON public."ai_recommendations";
DROP POLICY "ai_recommendations_update_auth" ON public."ai_recommendations";
DROP POLICY "ai_recommendations_update_anon" ON public."ai_recommendations";
DROP POLICY "ai_recommendations_delete_auth" ON public."ai_recommendations";
DROP POLICY "ai_recommendations_delete_anon" ON public."ai_recommendations";
CREATE POLICY "Users can view their org ai recommendations" ON public."ai_recommendations" FOR SELECT TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "ai_recommendations_org_access" ON public."ai_recommendations" FOR ALL TO public USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- api_keys
DROP POLICY "api_keys_select_auth" ON public."api_keys";
DROP POLICY "api_keys_select_anon" ON public."api_keys";
DROP POLICY "api_keys_insert_auth" ON public."api_keys";
DROP POLICY "api_keys_insert_anon" ON public."api_keys";
DROP POLICY "api_keys_update_auth" ON public."api_keys";
DROP POLICY "api_keys_update_anon" ON public."api_keys";
DROP POLICY "api_keys_delete_auth" ON public."api_keys";
DROP POLICY "api_keys_delete_anon" ON public."api_keys";
CREATE POLICY "Users can view their org api keys" ON public."api_keys" FOR SELECT TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "api_keys_manage_admin" ON public."api_keys" FOR ALL TO public USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
CREATE POLICY "api_keys_select_admin" ON public."api_keys" FOR SELECT TO public USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

-- crm_activities
DROP POLICY "crm_activities_select_auth" ON public."crm_activities";
DROP POLICY "crm_activities_select_anon" ON public."crm_activities";
CREATE POLICY "Users can view their org activities" ON public."crm_activities" FOR SELECT TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "crm_activities_select" ON public."crm_activities" FOR SELECT TO authenticated USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- crm_contacts
DROP POLICY "crm_contacts_select_auth" ON public."crm_contacts";
DROP POLICY "crm_contacts_select_anon" ON public."crm_contacts";
DROP POLICY "crm_contacts_insert_auth" ON public."crm_contacts";
CREATE POLICY "Users can view their org contacts" ON public."crm_contacts" FOR SELECT TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "crm_contacts_insert" ON public."crm_contacts" FOR INSERT TO authenticated WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "crm_contacts_select" ON public."crm_contacts" FOR SELECT TO authenticated USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- crm_deals
DROP POLICY "crm_deals_select_auth" ON public."crm_deals";
DROP POLICY "crm_deals_select_anon" ON public."crm_deals";
DROP POLICY "crm_deals_insert_auth" ON public."crm_deals";
CREATE POLICY "Users can view their org deals" ON public."crm_deals" FOR SELECT TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "crm_deals_insert" ON public."crm_deals" FOR INSERT TO authenticated WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "crm_deals_select" ON public."crm_deals" FOR SELECT TO authenticated USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- dsar_requests
DROP POLICY "dsar_requests_select_auth" ON public."dsar_requests";
DROP POLICY "dsar_requests_select_anon" ON public."dsar_requests";
DROP POLICY "dsar_requests_insert_auth" ON public."dsar_requests";
CREATE POLICY "Users can view their org dsar requests" ON public."dsar_requests" FOR SELECT TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "dsar_insert" ON public."dsar_requests" FOR INSERT TO authenticated WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "dsar_select" ON public."dsar_requests" FOR SELECT TO authenticated USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- feedback
DROP POLICY "feedback_select_auth" ON public."feedback";
DROP POLICY "feedback_select_anon" ON public."feedback";
DROP POLICY "feedback_insert_auth" ON public."feedback";
CREATE POLICY "Users can view their org feedback" ON public."feedback" FOR SELECT TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "feedback_insert_org" ON public."feedback" FOR INSERT TO authenticated WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "feedback_select_org" ON public."feedback" FOR SELECT TO authenticated USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- feedback_comments
DROP POLICY "feedback_comments_select_auth" ON public."feedback_comments";
DROP POLICY "feedback_comments_select_anon" ON public."feedback_comments";
DROP POLICY "feedback_comments_insert_auth" ON public."feedback_comments";
CREATE POLICY "Users can view their org feedback comments" ON public."feedback_comments" FOR SELECT TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "feedback_comments_insert" ON public."feedback_comments" FOR INSERT TO authenticated WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "feedback_comments_select" ON public."feedback_comments" FOR SELECT TO authenticated USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND ((is_internal = false) OR (EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (r.organization_id = feedback_comments.organization_id) AND (r.is_system OR (lower(r.name) ~~* '%admin%'::text))))))));

-- feedback_votes
DROP POLICY "feedback_votes_select_auth" ON public."feedback_votes";
DROP POLICY "feedback_votes_select_anon" ON public."feedback_votes";
DROP POLICY "feedback_votes_insert_auth" ON public."feedback_votes";
DROP POLICY "feedback_votes_delete_auth" ON public."feedback_votes";
CREATE POLICY "Users can view their org feedback votes" ON public."feedback_votes" FOR SELECT TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "feedback_votes_delete" ON public."feedback_votes" FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "feedback_votes_insert" ON public."feedback_votes" FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "feedback_votes_select" ON public."feedback_votes" FOR SELECT TO authenticated USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- notification_preferences
DROP POLICY "notification_preferences_select_auth" ON public."notification_preferences";
DROP POLICY "notification_preferences_select_anon" ON public."notification_preferences";
DROP POLICY "notification_preferences_insert_auth" ON public."notification_preferences";
DROP POLICY "notification_preferences_update_auth" ON public."notification_preferences";
DROP POLICY "notification_preferences_delete_auth" ON public."notification_preferences";
CREATE POLICY "Users can view their own notification preferences" ON public."notification_preferences" FOR SELECT TO public USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "notification_prefs_all_own" ON public."notification_preferences" FOR ALL TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

-- organizations
DROP POLICY "organizations_select_auth" ON public."organizations";
DROP POLICY "organizations_select_anon" ON public."organizations";
DROP POLICY "organizations_update_auth" ON public."organizations";
DROP POLICY "organizations_update_anon" ON public."organizations";
CREATE POLICY "Users can update their own organization" ON public."organizations" FOR UPDATE TO public USING ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Users can view their own organization" ON public."organizations" FOR SELECT TO public USING ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "organizations_select_member" ON public."organizations" FOR SELECT TO public USING ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "organizations_update_admin" ON public."organizations" FOR UPDATE TO public USING ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

-- profiles
DROP POLICY "profiles_select_auth" ON public."profiles";
DROP POLICY "profiles_select_anon" ON public."profiles";
DROP POLICY "profiles_insert_auth" ON public."profiles";
DROP POLICY "profiles_insert_anon" ON public."profiles";
DROP POLICY "profiles_update_auth" ON public."profiles";
DROP POLICY "profiles_update_anon" ON public."profiles";
CREATE POLICY "Users can update their own profile" ON public."profiles" FOR UPDATE TO public USING ((id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can view their own profile" ON public."profiles" FOR SELECT TO public USING ((id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "profiles_insert_own" ON public."profiles" FOR INSERT TO public WITH CHECK ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "profiles_select_own" ON public."profiles" FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "profiles_update_own" ON public."profiles" FOR UPDATE TO public USING ((( SELECT auth.uid() AS uid) = id));

-- report_schedules
DROP POLICY "report_schedules_select_auth" ON public."report_schedules";
DROP POLICY "report_schedules_select_anon" ON public."report_schedules";
CREATE POLICY "Users can view their org report schedules" ON public."report_schedules" FOR SELECT TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "report_sched_select" ON public."report_schedules" FOR SELECT TO authenticated USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- roles
DROP POLICY "roles_select_auth" ON public."roles";
DROP POLICY "roles_select_anon" ON public."roles";
CREATE POLICY "Users can view their org roles" ON public."roles" FOR SELECT TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "roles_select_own_org" ON public."roles" FOR SELECT TO authenticated USING ((organization_id IN ( SELECT user_roles.organization_id
   FROM user_roles
  WHERE (user_roles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- subscriptions
DROP POLICY "subscriptions_select_auth" ON public."subscriptions";
DROP POLICY "subscriptions_select_anon" ON public."subscriptions";
DROP POLICY "subscriptions_insert_auth" ON public."subscriptions";
DROP POLICY "subscriptions_insert_anon" ON public."subscriptions";
DROP POLICY "subscriptions_update_auth" ON public."subscriptions";
DROP POLICY "subscriptions_update_anon" ON public."subscriptions";
DROP POLICY "subscriptions_delete_auth" ON public."subscriptions";
DROP POLICY "subscriptions_delete_anon" ON public."subscriptions";
CREATE POLICY "Users can view their org's subscription" ON public."subscriptions" FOR SELECT TO public USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "subscriptions_manage_admin" ON public."subscriptions" FOR ALL TO public USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
CREATE POLICY "subscriptions_select_member" ON public."subscriptions" FOR SELECT TO public USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
