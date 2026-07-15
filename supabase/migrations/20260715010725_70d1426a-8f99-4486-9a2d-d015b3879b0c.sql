
-- 1) Fix log_activity: finance_entries has 'kind', not 'type'
CREATE OR REPLACE FUNCTION public.log_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF v_entity = 'leads' THEN
      v_summary := 'Added lead: ' || COALESCE(NEW.business_name,'(no name)');
    ELSIF v_entity = 'fb_outreach' THEN
      v_summary := 'FB outreach added: ' || COALESCE(NEW.business_name, NEW.person_name, '(no name)');
    ELSIF v_entity = 'tasks' THEN
      v_summary := 'New task: "' || COALESCE(NEW.title,'(untitled)') || '"'
                   || CASE WHEN NEW.scheduled_time IS NOT NULL
                        THEN ' at ' || to_char(NEW.scheduled_time, 'HH24:MI') ELSE '' END
                   || ' for ' || to_char(NEW.scheduled_date, 'Mon DD');
    ELSIF v_entity = 'finance_entries' THEN
      v_summary := 'Finance ' || COALESCE(NEW.kind::text,'entry') || ': ' || COALESCE(NEW.description, NEW.category, '') || ' (' || COALESCE(NEW.amount_usd::text,'0') || ' USD)';
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
    ELSIF v_entity = 'fb_outreach' THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_summary := COALESCE(NEW.business_name, NEW.person_name,'Outreach') || ' → ' || NEW.status;
        v_action := 'status_changed';
      ELSE
        v_summary := 'FB outreach updated: ' || COALESCE(NEW.business_name, NEW.person_name,'(no name)');
      END IF;
    ELSIF v_entity = 'tasks' THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_action := 'status_changed';
        IF NEW.status = 'done' THEN
          v_summary := 'Completed task: "' || COALESCE(NEW.title,'(untitled)') || '"';
        ELSIF NEW.status = 'in_progress' THEN
          v_summary := 'Started task: "' || COALESCE(NEW.title,'(untitled)') || '"';
        ELSIF NEW.status = 'skipped' THEN
          v_summary := 'Skipped task: "' || COALESCE(NEW.title,'(untitled)') || '"';
        ELSE
          v_summary := 'Task "' || COALESCE(NEW.title,'(untitled)') || '" → ' || NEW.status;
        END IF;
      ELSIF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date THEN
        v_summary := 'Rescheduled "' || COALESCE(NEW.title,'(untitled)') || '" to ' || to_char(NEW.scheduled_date, 'Mon DD');
      ELSIF NEW.title IS DISTINCT FROM OLD.title THEN
        v_summary := 'Renamed task to "' || COALESCE(NEW.title,'(untitled)') || '"';
      ELSE
        v_summary := 'Updated task: "' || COALESCE(NEW.title,'(untitled)') || '"';
      END IF;
    ELSIF v_entity = 'finance_entries' THEN
      v_summary := 'Updated finance entry';
    ELSE v_summary := 'Updated ' || v_entity;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_id := OLD.id;
    IF v_entity = 'tasks' THEN
      v_summary := 'Deleted task: "' || COALESCE(OLD.title,'(untitled)') || '"';
    ELSIF v_entity = 'leads' THEN
      v_summary := 'Deleted lead: ' || COALESCE(OLD.business_name,'(no name)');
    ELSIF v_entity = 'fb_outreach' THEN
      v_summary := 'Deleted FB outreach: ' || COALESCE(OLD.business_name, OLD.person_name,'(no name)');
    ELSE
      v_summary := 'Deleted ' || v_entity;
    END IF;
  END IF;

  INSERT INTO public.activity_log(actor_id, entity_type, entity_id, action, summary)
  VALUES (v_actor, v_entity, v_id, v_action, v_summary);

  RETURN COALESCE(NEW, OLD);
END $function$;

-- 2) Finance currency field
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

ALTER TABLE public.finance_entries
  DROP CONSTRAINT IF EXISTS finance_entries_currency_check;
ALTER TABLE public.finance_entries
  ADD CONSTRAINT finance_entries_currency_check CHECK (currency IN ('USD','BDT'));

-- 3) Task Lists (reusable templates)
CREATE TABLE IF NOT EXISTS public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;
GRANT ALL ON public.task_templates TO service_role;

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can view task_templates" ON public.task_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert task_templates" ON public.task_templates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "owner or admin update task_templates" ON public.task_templates
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner or admin delete task_templates" ON public.task_templates
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER task_templates_updated_at BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.task_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  default_duration_minutes integer,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_template_items TO authenticated;
GRANT ALL ON public.task_template_items TO service_role;

ALTER TABLE public.task_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can view task_template_items" ON public.task_template_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert task_template_items" ON public.task_template_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.task_templates t
            WHERE t.id = template_id
              AND (t.created_by = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );
CREATE POLICY "owner or admin update task_template_items" ON public.task_template_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.task_templates t WHERE t.id = template_id AND (t.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.task_templates t WHERE t.id = template_id AND (t.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "owner or admin delete task_template_items" ON public.task_template_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.task_templates t WHERE t.id = template_id AND (t.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER task_template_items_updated_at BEFORE UPDATE ON public.task_template_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS task_template_items_template_idx ON public.task_template_items(template_id, sort_order);
