
-- activity_log
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  summary text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity read all authed" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity insert own" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);
CREATE INDEX activity_log_created_idx ON public.activity_log(created_at DESC);

-- saved_offers
CREATE TABLE public.saved_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  title text NOT NULL,
  template_key text NOT NULL,
  business_name text,
  content text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_offers TO authenticated;
GRANT ALL ON public.saved_offers TO service_role;
ALTER TABLE public.saved_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers all authed read" ON public.saved_offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "offers owner write" ON public.saved_offers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "offers owner update" ON public.saved_offers FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "offers owner delete" ON public.saved_offers FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER saved_offers_touch BEFORE UPDATE ON public.saved_offers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- fcm_tokens
CREATE TABLE public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT ALL ON public.fcm_tokens TO service_role;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fcm owner all" ON public.fcm_tokens FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Activity logger function
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_summary text;
  v_action text;
  v_entity text := TG_TABLE_NAME;
  v_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_id := NEW.id;
    IF v_entity = 'leads' THEN v_summary := 'Added lead: ' || COALESCE(NEW.business_name,'(no name)');
    ELSIF v_entity = 'fb_outreach' THEN v_summary := 'FB outreach added: ' || COALESCE(NEW.business_name, NEW.person_name, '(no name)');
    ELSE v_summary := 'New ' || v_entity || ' entry';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_id := NEW.id;
    IF v_entity = 'leads' THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_summary := COALESCE(NEW.business_name,'Lead') || ' → ' || NEW.status;
        v_action := 'status_changed';
      ELSE
        v_summary := 'Updated lead: ' || COALESCE(NEW.business_name,'(no name)');
      END IF;
    ELSIF v_entity = 'fb_outreach' THEN v_summary := 'FB outreach updated: ' || COALESCE(NEW.business_name, NEW.person_name,'(no name)');
    ELSE v_summary := 'Updated ' || v_entity;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_id := OLD.id;
    v_summary := 'Deleted ' || v_entity;
  END IF;

  INSERT INTO public.activity_log(actor_id, entity_type, entity_id, action, summary)
  VALUES (v_actor, v_entity, v_id, v_action, v_summary);

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER leads_activity AFTER INSERT OR UPDATE OR DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER fb_outreach_activity AFTER INSERT OR UPDATE OR DELETE ON public.fb_outreach FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER finance_activity AFTER INSERT OR UPDATE OR DELETE ON public.finance_entries FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Realtime
ALTER TABLE public.activity_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
