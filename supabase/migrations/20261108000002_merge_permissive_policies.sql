-- Merge overlapping permissive RLS policies (Supabase lint: multiple_permissive_policies).
-- Permissive policies are OR'd by Postgres, so each table now has one policy per command and role
-- whose expression is the OR of the policies that applied before. Access is unchanged.
-- Roles: authenticated gets public + authenticated policies; anon/authenticator/dashboard_user get the public ones.

-- ai_recommendations
DROP POLICY "Users can view their org ai recommendations" ON public."ai_recommendations";
DROP POLICY "ai_recommendations_org_access" ON public."ai_recommendations";
CREATE POLICY "ai_recommendations_select_auth" ON public."ai_recommendations" FOR SELECT TO authenticated USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "ai_recommendations_select_anon" ON public."ai_recommendations" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "ai_recommendations_insert_auth" ON public."ai_recommendations" FOR INSERT TO authenticated WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "ai_recommendations_insert_anon" ON public."ai_recommendations" FOR INSERT TO anon, authenticator, dashboard_user WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "ai_recommendations_update_auth" ON public."ai_recommendations" FOR UPDATE TO authenticated USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))) WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "ai_recommendations_update_anon" ON public."ai_recommendations" FOR UPDATE TO anon, authenticator, dashboard_user USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))) WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "ai_recommendations_delete_auth" ON public."ai_recommendations" FOR DELETE TO authenticated USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "ai_recommendations_delete_anon" ON public."ai_recommendations" FOR DELETE TO anon, authenticator, dashboard_user USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

-- api_keys
DROP POLICY "Users can view their org api keys" ON public."api_keys";
DROP POLICY "api_keys_manage_admin" ON public."api_keys";
DROP POLICY "api_keys_select_admin" ON public."api_keys";
CREATE POLICY "api_keys_select_auth" ON public."api_keys" FOR SELECT TO authenticated USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "api_keys_select_anon" ON public."api_keys" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "api_keys_insert_auth" ON public."api_keys" FOR INSERT TO authenticated WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "api_keys_insert_anon" ON public."api_keys" FOR INSERT TO anon, authenticator, dashboard_user WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "api_keys_update_auth" ON public."api_keys" FOR UPDATE TO authenticated USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))) WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "api_keys_update_anon" ON public."api_keys" FOR UPDATE TO anon, authenticator, dashboard_user USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))) WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "api_keys_delete_auth" ON public."api_keys" FOR DELETE TO authenticated USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "api_keys_delete_anon" ON public."api_keys" FOR DELETE TO anon, authenticator, dashboard_user USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));

-- crm_activities
DROP POLICY "Users can view their org activities" ON public."crm_activities";
DROP POLICY "crm_activities_select" ON public."crm_activities";
CREATE POLICY "crm_activities_select_auth" ON public."crm_activities" FOR SELECT TO authenticated USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "crm_activities_select_anon" ON public."crm_activities" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

-- crm_contacts
DROP POLICY "Users can view their org contacts" ON public."crm_contacts";
DROP POLICY "crm_contacts_insert" ON public."crm_contacts";
DROP POLICY "crm_contacts_select" ON public."crm_contacts";
CREATE POLICY "crm_contacts_select_auth" ON public."crm_contacts" FOR SELECT TO authenticated USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "crm_contacts_select_anon" ON public."crm_contacts" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "crm_contacts_insert_auth" ON public."crm_contacts" FOR INSERT TO authenticated WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

-- crm_deals
DROP POLICY "Users can view their org deals" ON public."crm_deals";
DROP POLICY "crm_deals_insert" ON public."crm_deals";
DROP POLICY "crm_deals_select" ON public."crm_deals";
CREATE POLICY "crm_deals_select_auth" ON public."crm_deals" FOR SELECT TO authenticated USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "crm_deals_select_anon" ON public."crm_deals" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "crm_deals_insert_auth" ON public."crm_deals" FOR INSERT TO authenticated WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

-- dsar_requests
DROP POLICY "Users can view their org dsar requests" ON public."dsar_requests";
DROP POLICY "dsar_insert" ON public."dsar_requests";
DROP POLICY "dsar_select" ON public."dsar_requests";
CREATE POLICY "dsar_requests_select_auth" ON public."dsar_requests" FOR SELECT TO authenticated USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "dsar_requests_select_anon" ON public."dsar_requests" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "dsar_requests_insert_auth" ON public."dsar_requests" FOR INSERT TO authenticated WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

-- feedback
DROP POLICY "Users can view their org feedback" ON public."feedback";
DROP POLICY "feedback_insert_org" ON public."feedback";
DROP POLICY "feedback_select_org" ON public."feedback";
CREATE POLICY "feedback_select_auth" ON public."feedback" FOR SELECT TO authenticated USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "feedback_select_anon" ON public."feedback" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "feedback_insert_auth" ON public."feedback" FOR INSERT TO authenticated WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

-- feedback_comments
DROP POLICY "Users can view their org feedback comments" ON public."feedback_comments";
DROP POLICY "feedback_comments_insert" ON public."feedback_comments";
DROP POLICY "feedback_comments_select" ON public."feedback_comments";
CREATE POLICY "feedback_comments_select_auth" ON public."feedback_comments" FOR SELECT TO authenticated USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND ((is_internal = false) OR (EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (r.organization_id = feedback_comments.organization_id) AND (r.is_system OR (lower(r.name) ~~* '%admin%'::text)))))))));
CREATE POLICY "feedback_comments_select_anon" ON public."feedback_comments" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "feedback_comments_insert_auth" ON public."feedback_comments" FOR INSERT TO authenticated WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

-- feedback_votes
DROP POLICY "Users can view their org feedback votes" ON public."feedback_votes";
DROP POLICY "feedback_votes_delete" ON public."feedback_votes";
DROP POLICY "feedback_votes_insert" ON public."feedback_votes";
DROP POLICY "feedback_votes_select" ON public."feedback_votes";
CREATE POLICY "feedback_votes_select_auth" ON public."feedback_votes" FOR SELECT TO authenticated USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "feedback_votes_select_anon" ON public."feedback_votes" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "feedback_votes_insert_auth" ON public."feedback_votes" FOR INSERT TO authenticated WITH CHECK ((((user_id = ( SELECT auth.uid() AS uid)) AND (organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY "feedback_votes_delete_auth" ON public."feedback_votes" FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid))));

-- notification_preferences
DROP POLICY "Users can view their own notification preferences" ON public."notification_preferences";
DROP POLICY "notification_prefs_all_own" ON public."notification_preferences";
CREATE POLICY "notification_preferences_select_auth" ON public."notification_preferences" FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid))) OR ((user_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY "notification_preferences_select_anon" ON public."notification_preferences" FOR SELECT TO anon, authenticator, dashboard_user USING (((user_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY "notification_preferences_insert_auth" ON public."notification_preferences" FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY "notification_preferences_update_auth" ON public."notification_preferences" FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY "notification_preferences_delete_auth" ON public."notification_preferences" FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid))));

-- organizations
DROP POLICY "Users can update their own organization" ON public."organizations";
DROP POLICY "Users can view their own organization" ON public."organizations";
DROP POLICY "organizations_select_member" ON public."organizations";
DROP POLICY "organizations_update_admin" ON public."organizations";
CREATE POLICY "organizations_select_auth" ON public."organizations" FOR SELECT TO authenticated USING (((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "organizations_select_anon" ON public."organizations" FOR SELECT TO anon, authenticator, dashboard_user USING (((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "organizations_update_auth" ON public."organizations" FOR UPDATE TO authenticated USING (((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))) WITH CHECK (((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "organizations_update_anon" ON public."organizations" FOR UPDATE TO anon, authenticator, dashboard_user USING (((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))) WITH CHECK (((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));

-- profiles
DROP POLICY "Users can update their own profile" ON public."profiles";
DROP POLICY "Users can view their own profile" ON public."profiles";
DROP POLICY "profiles_insert_own" ON public."profiles";
DROP POLICY "profiles_select_own" ON public."profiles";
DROP POLICY "profiles_update_own" ON public."profiles";
CREATE POLICY "profiles_select_auth" ON public."profiles" FOR SELECT TO authenticated USING (((id = ( SELECT auth.uid() AS uid))) OR ((( SELECT auth.uid() AS uid) = id)));
CREATE POLICY "profiles_select_anon" ON public."profiles" FOR SELECT TO anon, authenticator, dashboard_user USING (((id = ( SELECT auth.uid() AS uid))) OR ((( SELECT auth.uid() AS uid) = id)));
CREATE POLICY "profiles_insert_auth" ON public."profiles" FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = id)));
CREATE POLICY "profiles_insert_anon" ON public."profiles" FOR INSERT TO anon, authenticator, dashboard_user WITH CHECK (((( SELECT auth.uid() AS uid) = id)));
CREATE POLICY "profiles_update_auth" ON public."profiles" FOR UPDATE TO authenticated USING (((id = ( SELECT auth.uid() AS uid))) OR ((( SELECT auth.uid() AS uid) = id))) WITH CHECK (((id = ( SELECT auth.uid() AS uid))) OR ((( SELECT auth.uid() AS uid) = id)));
CREATE POLICY "profiles_update_anon" ON public."profiles" FOR UPDATE TO anon, authenticator, dashboard_user USING (((id = ( SELECT auth.uid() AS uid))) OR ((( SELECT auth.uid() AS uid) = id))) WITH CHECK (((id = ( SELECT auth.uid() AS uid))) OR ((( SELECT auth.uid() AS uid) = id)));

-- report_schedules
DROP POLICY "Users can view their org report schedules" ON public."report_schedules";
DROP POLICY "report_sched_select" ON public."report_schedules";
CREATE POLICY "report_schedules_select_auth" ON public."report_schedules" FOR SELECT TO authenticated USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "report_schedules_select_anon" ON public."report_schedules" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

-- roles
DROP POLICY "Users can view their org roles" ON public."roles";
DROP POLICY "roles_select_own_org" ON public."roles";
CREATE POLICY "roles_select_auth" ON public."roles" FOR SELECT TO authenticated USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT user_roles.organization_id
   FROM user_roles
  WHERE (user_roles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "roles_select_anon" ON public."roles" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id = ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

-- subscriptions
DROP POLICY "Users can view their org's subscription" ON public."subscriptions";
DROP POLICY "subscriptions_manage_admin" ON public."subscriptions";
DROP POLICY "subscriptions_select_member" ON public."subscriptions";
CREATE POLICY "subscriptions_select_auth" ON public."subscriptions" FOR SELECT TO authenticated USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "subscriptions_select_anon" ON public."subscriptions" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "subscriptions_insert_auth" ON public."subscriptions" FOR INSERT TO authenticated WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "subscriptions_insert_anon" ON public."subscriptions" FOR INSERT TO anon, authenticator, dashboard_user WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "subscriptions_update_auth" ON public."subscriptions" FOR UPDATE TO authenticated USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))) WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "subscriptions_update_anon" ON public."subscriptions" FOR UPDATE TO anon, authenticator, dashboard_user USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))) WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "subscriptions_delete_auth" ON public."subscriptions" FOR DELETE TO authenticated USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "subscriptions_delete_anon" ON public."subscriptions" FOR DELETE TO anon, authenticator, dashboard_user USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
