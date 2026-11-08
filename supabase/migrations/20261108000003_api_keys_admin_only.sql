-- API keys are visible to organization owners and admins only. Drops the old
-- "Users can view their org api keys" rule, which let every member read them.
DROP POLICY "api_keys_select_auth" ON public."api_keys";
DROP POLICY "api_keys_select_anon" ON public."api_keys";
CREATE POLICY "api_keys_select_auth" ON public."api_keys" FOR SELECT TO authenticated USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
CREATE POLICY "api_keys_select_anon" ON public."api_keys" FOR SELECT TO anon, authenticator, dashboard_user USING (((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))) OR ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
