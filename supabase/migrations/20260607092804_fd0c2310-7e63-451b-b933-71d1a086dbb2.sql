
-- Tighten leads UPDATE: only creator, assignee, or admin can update
DROP POLICY "team can update leads" ON public.leads;
CREATE POLICY "team can update leads" ON public.leads FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = created_by OR auth.uid() = assigned_to OR public.has_role(auth.uid(),'admin'));

-- Lock down SECURITY DEFINER trigger functions (only triggers / privileged callers)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
-- has_role is intended for use inside RLS; revoke from anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
