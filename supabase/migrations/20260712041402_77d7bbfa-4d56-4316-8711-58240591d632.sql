
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
      v_summary := 'Finance ' || COALESCE(NEW.type,'entry') || ': ' || COALESCE(NEW.description,'') || ' (' || COALESCE(NEW.amount::text,'0') || ')';
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
END $$;

DROP TRIGGER IF EXISTS tasks_activity ON public.tasks;
CREATE TRIGGER tasks_activity
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_activity();
