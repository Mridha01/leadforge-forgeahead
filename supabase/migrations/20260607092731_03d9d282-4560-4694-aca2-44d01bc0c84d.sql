
-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('admin','member');
CREATE TYPE public.lead_status AS ENUM (
  'new','audit_done','email_sent','followup_1','followup_2',
  'replied','meeting','proposal','closed_won','closed_lost'
);

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ===== USER ROLES =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ===== AUTO PROFILE + DEFAULT ROLE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== NICHES =====
CREATE TABLE public.niches (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.niches TO authenticated, anon;
GRANT ALL ON public.niches TO service_role;
ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "niches readable" ON public.niches FOR SELECT USING (true);

INSERT INTO public.niches (slug, name, sort_order) VALUES
('roofing','Roofing',1),('plumbing','Plumbing',2),('handyman','Handyman',3),
('cleaning','Cleaning Services',4),('dentist','Dentist',5),('electrician','Electrician',6),
('hvac','HVAC',7),('landscaping','Landscaping',8),('pest_control','Pest Control',9),
('auto_repair','Auto Repair',10),('chiropractic','Chiropractic',11),('restaurant','Restaurant',12),
('lawyer','Lawyer',13),('accountant','Accountant',14),('gym','Gym & Fitness',15),
('real_estate','Real Estate',16);

-- ===== COUNTRIES + CITIES =====
CREATE TABLE public.countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(country_code, name)
);
GRANT SELECT ON public.countries TO authenticated, anon;
GRANT SELECT ON public.cities TO authenticated, anon;
GRANT ALL ON public.countries TO service_role;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "countries readable" ON public.countries FOR SELECT USING (true);
CREATE POLICY "cities readable" ON public.cities FOR SELECT USING (true);

INSERT INTO public.countries (code, name, sort_order) VALUES
('AU','Australia',1),('CA','Canada',2),('GB','United Kingdom',3),('IE','Ireland',4),
('NZ','New Zealand',5),('SG','Singapore',6),('AE','UAE',7),('ZA','South Africa',8),
('GH','Ghana',9),('KE','Kenya',10),('NG','Nigeria',11),('JM','Jamaica',12),
('PH','Philippines',13),('MY','Malaysia',14),('TT','Trinidad and Tobago',15);

INSERT INTO public.cities (country_code, name) VALUES
('AU','Sydney'),('AU','Melbourne'),('AU','Brisbane'),('AU','Perth'),('AU','Adelaide'),('AU','Gold Coast'),('AU','Newcastle'),('AU','Canberra'),('AU','Sunshine Coast'),('AU','Wollongong'),('AU','Hobart'),('AU','Geelong'),('AU','Townsville'),('AU','Cairns'),('AU','Darwin'),('AU','Toowoomba'),('AU','Ballarat'),('AU','Bendigo'),('AU','Launceston'),('AU','Mackay'),
('CA','Toronto'),('CA','Vancouver'),('CA','Calgary'),('CA','Edmonton'),('CA','Ottawa'),('CA','Winnipeg'),('CA','Hamilton'),('CA','Kitchener'),('CA','Halifax'),('CA','Victoria'),('CA','Saskatoon'),('CA','Regina'),('CA','Kelowna'),('CA','Barrie'),('CA','Windsor'),('CA','London'),('CA','Abbotsford'),('CA','Sudbury'),('CA','Quebec City'),('CA','St. John''s'),
('GB','London'),('GB','Manchester'),('GB','Birmingham'),('GB','Leeds'),('GB','Glasgow'),('GB','Liverpool'),('GB','Bristol'),('GB','Sheffield'),('GB','Edinburgh'),('GB','Leicester'),('GB','Coventry'),('GB','Bradford'),('GB','Nottingham'),('GB','Cardiff'),('GB','Belfast'),('GB','Southampton'),('GB','Portsmouth'),('GB','Newcastle'),('GB','Derby'),('GB','Plymouth'),
('IE','Dublin'),('IE','Cork'),('IE','Limerick'),('IE','Galway'),('IE','Waterford'),('IE','Drogheda'),('IE','Dundalk'),('IE','Swords'),('IE','Bray'),('IE','Navan'),('IE','Kilkenny'),('IE','Ennis'),('IE','Tralee'),('IE','Carlow'),('IE','Newbridge'),('IE','Naas'),('IE','Athlone'),('IE','Portlaoise'),('IE','Mullingar'),('IE','Wexford'),
('NZ','Auckland'),('NZ','Wellington'),('NZ','Christchurch'),('NZ','Hamilton'),('NZ','Tauranga'),('NZ','Napier'),('NZ','Dunedin'),('NZ','Nelson'),('NZ','Rotorua'),('NZ','Palmerston North'),('NZ','New Plymouth'),('NZ','Whangarei'),('NZ','Invercargill'),('NZ','Gisborne'),('NZ','Blenheim'),('NZ','Lower Hutt'),('NZ','Upper Hutt'),('NZ','Porirua'),('NZ','Timaru'),('NZ','Whanganui'),
('SG','Orchard'),('SG','Marina Bay'),('SG','Tampines'),('SG','Jurong East'),('SG','Woodlands'),('SG','Ang Mo Kio'),('SG','Bedok'),('SG','Clementi'),('SG','Yishun'),('SG','Hougang'),('SG','Sengkang'),('SG','Punggol'),('SG','Bishan'),('SG','Toa Payoh'),('SG','Queenstown'),('SG','Kallang'),('SG','Novena'),('SG','Geylang'),('SG','Bukit Timah'),('SG','Buona Vista'),
('AE','Dubai'),('AE','Abu Dhabi'),('AE','Sharjah'),('AE','Ajman'),('AE','Ras Al Khaimah'),('AE','Fujairah'),('AE','Al Ain'),('AE','Deira'),('AE','Bur Dubai'),('AE','Jumeirah'),('AE','Business Bay'),('AE','Downtown Dubai'),('AE','Dubai Marina'),('AE','JLT'),('AE','Al Barsha'),('AE','Mirdif'),('AE','Silicon Oasis'),('AE','Mussafah'),('AE','Khalifa City'),('AE','Umm Al Quwain'),
('ZA','Cape Town'),('ZA','Johannesburg'),('ZA','Durban'),('ZA','Pretoria'),('ZA','Port Elizabeth'),('ZA','Bloemfontein'),('ZA','East London'),('ZA','Nelspruit'),('ZA','Polokwane'),('ZA','Kimberley'),('ZA','Rustenburg'),('ZA','George'),('ZA','Pietermaritzburg'),('ZA','Benoni'),('ZA','Boksburg'),('ZA','Soweto'),('ZA','Midrand'),('ZA','Centurion'),('ZA','Welkom'),('ZA','Vanderbijlpark'),
('GH','Accra'),('GH','Kumasi'),('GH','Tamale'),('GH','Takoradi'),('GH','Cape Coast'),('GH','Tema'),('GH','Koforidua'),('GH','Sunyani'),('GH','Ho'),('GH','Wa'),('GH','Bolgatanga'),('GH','Techiman'),('GH','Winneba'),('GH','Teshie'),('GH','Madina'),('GH','Ashaiman'),('GH','Dome'),('GH','Kasoa'),('GH','Obuasi'),('GH','Nkoranza'),
('KE','Nairobi'),('KE','Mombasa'),('KE','Kisumu'),('KE','Nakuru'),('KE','Eldoret'),('KE','Thika'),('KE','Malindi'),('KE','Kitale'),('KE','Nyeri'),('KE','Machakos'),('KE','Meru'),('KE','Kakamega'),('KE','Embu'),('KE','Kisii'),('KE','Kericho'),('KE','Lamu'),('KE','Nanyuki'),('KE','Isiolo'),('KE','Bungoma'),('KE','Garissa'),
('NG','Lagos'),('NG','Abuja'),('NG','Kano'),('NG','Ibadan'),('NG','Port Harcourt'),('NG','Benin City'),('NG','Zaria'),('NG','Aba'),('NG','Jos'),('NG','Ilorin'),('NG','Oyo'),('NG','Enugu'),('NG','Abeokuta'),('NG','Onitsha'),('NG','Warri'),('NG','Kaduna'),('NG','Uyo'),('NG','Calabar'),('NG','Owerri'),('NG','Maiduguri'),
('JM','Kingston'),('JM','Montego Bay'),('JM','Spanish Town'),('JM','Portmore'),('JM','May Pen'),('JM','Mandeville'),('JM','Old Harbour'),('JM','Linstead'),('JM','Ocho Rios'),('JM','Port Antonio'),('JM','Savanna-la-Mar'),('JM','Morant Bay'),('JM','Black River'),('JM','Lucea'),('JM','Falmouth'),('JM','St. Ann''s Bay'),('JM','Bog Walk'),('JM','Chapelton'),('JM','Browns Town'),('JM','Half Way Tree'),
('PH','Manila'),('PH','Cebu City'),('PH','Davao City'),('PH','Quezon City'),('PH','Makati'),('PH','Taguig'),('PH','Pasig'),('PH','Cagayan de Oro'),('PH','Iloilo City'),('PH','Bacolod'),('PH','Antipolo'),('PH','Pasay'),('PH','Las Piñas'),('PH','Parañaque'),('PH','Caloocan'),('PH','General Santos'),('PH','Lapu-Lapu City'),('PH','Mandaue'),('PH','Butuan'),('PH','Zamboanga City'),
('MY','Kuala Lumpur'),('MY','George Town'),('MY','Johor Bahru'),('MY','Ipoh'),('MY','Shah Alam'),('MY','Petaling Jaya'),('MY','Subang Jaya'),('MY','Klang'),('MY','Kuching'),('MY','Kota Kinabalu'),('MY','Malacca City'),('MY','Seremban'),('MY','Alor Setar'),('MY','Miri'),('MY','Sandakan'),('MY','Kuantan'),('MY','Kota Bharu'),('MY','Sibu'),('MY','Batu Pahat'),('MY','Taiping'),
('TT','Port of Spain'),('TT','San Fernando'),('TT','Chaguanas'),('TT','Arima'),('TT','Point Fortin'),('TT','Scarborough'),('TT','Couva'),('TT','Tunapuna'),('TT','Sangre Grande'),('TT','Princes Town'),('TT','Rio Claro'),('TT','Siparia'),('TT','Penal'),('TT','Debe'),('TT','Fyzabad'),('TT','Cunupia'),('TT','Marabella'),('TT','La Romaine'),('TT','Laventille'),('TT','Diego Martin');

-- ===== LEADS =====
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  owner_name TEXT,
  website_url TEXT,
  email TEXT,
  phone TEXT,
  gbp_url TEXT,
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  country_code TEXT REFERENCES public.countries(code) ON DELETE SET NULL,
  niche_slug TEXT REFERENCES public.niches(slug) ON DELETE SET NULL,
  lead_source TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.lead_status NOT NULL DEFAULT 'new',
  notes TEXT,
  website_score INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leads_status_idx ON public.leads(status);
CREATE INDEX leads_niche_idx ON public.leads(niche_slug);
CREATE INDEX leads_country_idx ON public.leads(country_code);
CREATE INDEX leads_assigned_idx ON public.leads(assigned_to);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- All authenticated team members can view & manage all leads (shared team CRM)
CREATE POLICY "team can view leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "team can update leads" ON public.leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "creator or admin can delete" ON public.leads FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== SEARCH HISTORY =====
CREATE TABLE public.search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche_slug TEXT,
  city_id UUID,
  query TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.search_history TO authenticated;
GRANT ALL ON public.search_history TO service_role;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own search history view" ON public.search_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own search history insert" ON public.search_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own search history delete" ON public.search_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
