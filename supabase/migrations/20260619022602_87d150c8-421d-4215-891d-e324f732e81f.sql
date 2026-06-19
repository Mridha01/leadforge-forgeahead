ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.fb_outreach REPLICA IDENTITY FULL;
ALTER TABLE public.finance_entries REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.leads; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fb_outreach; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_entries; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;