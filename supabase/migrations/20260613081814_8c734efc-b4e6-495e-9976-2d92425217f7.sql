
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS role_title text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS joined_at date DEFAULT CURRENT_DATE;

-- Facebook outreach tracker
CREATE TYPE public.fb_message_status AS ENUM ('to_contact','messaged','no_response','replied','not_interested','converted');

CREATE TABLE public.fb_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  fb_page_url text,
  contact_name text,
  niche_slug text REFERENCES public.niches(slug),
  country_code text REFERENCES public.countries(code),
  city_id uuid REFERENCES public.cities(id),
  message_status public.fb_message_status NOT NULL DEFAULT 'messaged',
  response text,
  notes text,
  messaged_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_outreach TO authenticated;
GRANT ALL ON public.fb_outreach TO service_role;
ALTER TABLE public.fb_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can view fb_outreach" ON public.fb_outreach
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert fb_outreach" ON public.fb_outreach
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "owner or admin can update fb_outreach" ON public.fb_outreach
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin can delete fb_outreach" ON public.fb_outreach
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_fb_outreach BEFORE UPDATE ON public.fb_outreach
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX fb_outreach_business_name_idx ON public.fb_outreach USING gin (to_tsvector('simple', business_name));
CREATE INDEX fb_outreach_created_by_idx ON public.fb_outreach (created_by);

-- Finance entries
CREATE TYPE public.finance_kind AS ENUM ('income','expense');

CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.finance_kind NOT NULL,
  category text NOT NULL,
  description text,
  amount_usd numeric(12,2) NOT NULL DEFAULT 0,
  usd_rate numeric(10,4),
  amount_bdt numeric(14,2) NOT NULL DEFAULT 0,
  client_name text,
  project_name text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_to text,
  split_member_a numeric(12,2),
  split_member_b numeric(12,2),
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can view finance" ON public.finance_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert finance" ON public.finance_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "owner or admin can update finance" ON public.finance_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin can delete finance" ON public.finance_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_finance_entries BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX finance_entries_date_idx ON public.finance_entries (entry_date DESC);

-- App settings (single-row key/value)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can view settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can upsert settings" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team can update settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value) VALUES ('usd_bdt_rate', '122'::jsonb)
ON CONFLICT (key) DO NOTHING;
