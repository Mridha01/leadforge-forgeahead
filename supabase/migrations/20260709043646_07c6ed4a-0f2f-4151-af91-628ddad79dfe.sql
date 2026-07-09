
CREATE TYPE public.task_status AS ENUM ('pending','in_progress','done','skipped');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high');

CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  scheduled_time TIME,
  duration_minutes INTEGER,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Team can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner or assignee can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = created_by OR auth.uid() = assigned_to);

CREATE TRIGGER touch_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER log_tasks_activity AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE INDEX idx_tasks_scheduled_date ON public.tasks(scheduled_date);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
