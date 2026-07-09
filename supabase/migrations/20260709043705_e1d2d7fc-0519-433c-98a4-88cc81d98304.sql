
DROP POLICY IF EXISTS "Team can update tasks" ON public.tasks;
CREATE POLICY "Owner or assignee can update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to)
  WITH CHECK (auth.uid() = created_by OR auth.uid() = assigned_to);
