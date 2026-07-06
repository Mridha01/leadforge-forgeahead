
-- New pipeline stages (merge of old CRM + current)
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'contacted';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'interested';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'proposal_sent';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'negotiation';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'converted';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'monthly_seo';

-- Expanded lead fields
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS service_area text,
  ADD COLUMN IF NOT EXISTS tag text CHECK (tag IN ('hot','warm','cold')) DEFAULT 'warm',
  ADD COLUMN IF NOT EXISTS order_status text CHECK (order_status IN ('active','paused','completed','none')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS total_order_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact_date date,
  ADD COLUMN IF NOT EXISTS found_date date DEFAULT CURRENT_DATE,
  -- SEO scan
  ADD COLUMN IF NOT EXISTS website_seo_status text CHECK (website_seo_status IN ('none','weak','okay','strong')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS gbp_status text CHECK (gbp_status IN ('no','unclaimed','claimed','optimized')) DEFAULT 'no',
  ADD COLUMN IF NOT EXISTS local_ranking_potential text CHECK (local_ranking_potential IN ('low','medium','high')) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS competitor_strength text CHECK (competitor_strength IN ('low','medium','high')) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS monthly_lead_potential integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommended_seo_service text,
  ADD COLUMN IF NOT EXISTS seo_weakness_notes text,
  -- Follow-ups
  ADD COLUMN IF NOT EXISTS first_contact_date date,
  ADD COLUMN IF NOT EXISTS followup_1_date date,
  ADD COLUMN IF NOT EXISTS followup_2_date date,
  ADD COLUMN IF NOT EXISTS followup_3_date date,
  ADD COLUMN IF NOT EXISTS next_action_date date,
  ADD COLUMN IF NOT EXISTS response_status text CHECK (response_status IN ('none','no_reply','interested','not_interested','wants_more_info','scheduled_call')) DEFAULT 'none';

CREATE INDEX IF NOT EXISTS leads_next_action_idx ON public.leads(next_action_date);
CREATE INDEX IF NOT EXISTS leads_tag_idx ON public.leads(tag);
