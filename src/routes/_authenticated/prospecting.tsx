import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Plus, History } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/prospecting")({
  head: () => ({ meta: [{ title: "Prospecting — LeadForge" }] }),
  component: ProspectingPage,
});

const QUERY_TEMPLATES: Record<string, string[]> = {
  roofing: ["roofing company {city}", "roofing contractor {city}", "best roofers {city}", "roof repair {city}"],
  plumbing: ["plumber {city}", "emergency plumber {city}", "plumbing company {city}", "best plumber near {city}"],
  handyman: ["handyman {city}", "handyman services {city}", "local handyman {city}"],
  cleaning: ["cleaning company {city}", "house cleaning {city}", "commercial cleaning {city}"],
  dentist: ["dentist {city}", "cosmetic dentist {city}", "family dentist {city}", "emergency dentist {city}"],
  electrician: ["electrician {city}", "licensed electrician {city}", "emergency electrician {city}"],
  hvac: ["hvac company {city}", "air conditioning repair {city}", "heating contractor {city}"],
  landscaping: ["landscaping company {city}", "lawn care {city}", "landscape designer {city}"],
  pest_control: ["pest control {city}", "exterminator {city}", "termite control {city}"],
  auto_repair: ["auto repair {city}", "mechanic {city}", "car service {city}"],
  chiropractic: ["chiropractor {city}", "chiropractic clinic {city}"],
  restaurant: ["restaurant {city}", "best restaurants {city}"],
  lawyer: ["lawyer {city}", "personal injury lawyer {city}", "family law attorney {city}"],
  accountant: ["accountant {city}", "tax accountant {city}", "small business accountant {city}"],
  gym: ["gym {city}", "personal trainer {city}", "fitness studio {city}"],
  real_estate: ["real estate agent {city}", "realtor {city}", "property agent {city}"],
};

function ProspectingPage() {
  const qc = useQueryClient();
  const [niche, setNiche] = useState<string>("dentist");
  const [country, setCountry] = useState<string>("");
  const [cityId, setCityId] = useState<string>("");

  const { data: niches = [] } = useQuery({ queryKey: ["niches"], queryFn: async () => (await supabase.from("niches").select("*").order("sort_order")).data ?? [] });
  const { data: countries = [] } = useQuery({ queryKey: ["countries"], queryFn: async () => (await supabase.from("countries").select("*").order("sort_order")).data ?? [] });
  const { data: cities = [] } = useQuery({ queryKey: ["cities"], queryFn: async () => (await supabase.from("cities").select("*").order("name")).data ?? [] });
  const { data: history = [] } = useQuery({
    queryKey: ["search-history"],
    queryFn: async () => (await supabase.from("search_history").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const filteredCities = useMemo(() => cities.filter((c) => !country || c.country_code === country), [cities, country]);
  const selectedCity = cities.find((c) => c.id === cityId);
  const selectedNiche = niches.find((n) => n.slug === niche);
  const queries = useMemo(() => {
    if (!selectedCity || !niche) return [];
    return (QUERY_TEMPLATES[niche] ?? [`${niche} {city}`]).map((t) => t.replace("{city}", selectedCity.name));
  }, [niche, selectedCity]);

  const save = useMutation({
    mutationFn: async (query: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not signed in");
      const { error } = await supabase.from("search_history").insert({
        user_id: user.user.id, niche_slug: niche, city_id: cityId, query,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["search-history"] }),
  });

  async function copyQuery(q: string) {
    await navigator.clipboard.writeText(q);
    toast.success("Copied");
    save.mutate(q);
  }

  function openInMaps(q: string) {
    save.mutate(q);
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(q)}`, "_blank");
  }

  return (
    <div>
      <PageHeader title="Prospecting" subtitle="Pick a niche and city — we generate Google Maps queries instantly." />
      <div className="p-6 pt-4 space-y-6">
        {/* Niche grid */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Niche</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {niches.map((n) => (
              <button key={n.slug} onClick={() => setNiche(n.slug)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition ${niche === n.slug ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card hover:border-primary/50 text-muted-foreground hover:text-foreground"}`}>
                {n.name}
              </button>
            ))}
          </div>
        </section>

        {/* Country picker */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Country</h3>
          <div className="flex flex-wrap gap-1.5">
            {countries.map((c) => (
              <button key={c.code} onClick={() => { setCountry(c.code); setCityId(""); }}
                className={`px-3 py-1.5 rounded-md text-xs border transition ${country === c.code ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
                {c.name}
              </button>
            ))}
          </div>
        </section>

        {/* Cities */}
        {country && (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">City</h3>
            <div className="flex flex-wrap gap-1.5">
              {filteredCities.map((c) => (
                <button key={c.id} onClick={() => setCityId(c.id)}
                  className={`px-3 py-1.5 rounded-md text-xs border transition ${cityId === c.id ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Queries */}
        {queries.length > 0 && (
          <Card className="p-5 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Google Maps queries · {selectedNiche?.name} in {selectedCity?.name}</h3>
            </div>
            <div className="space-y-2">
              {queries.map((q) => (
                <div key={q} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-background border border-border">
                  <code className="text-sm text-foreground/90 font-mono">{q}</code>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => copyQuery(q)}><Copy className="size-3.5 mr-1" />Copy</Button>
                    <Button size="sm" variant="outline" onClick={() => openInMaps(q)}><Plus className="size-3.5 mr-1" />Open in Maps</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* History */}
        {history.length > 0 && (
          <Card className="p-5 bg-card border-border">
            <div className="flex items-center gap-2 mb-3"><History className="size-4 text-muted-foreground" /><h3 className="text-sm font-medium">Recent searches</h3></div>
            <div className="space-y-1.5">
              {history.map((h) => (
                <div key={h.id} className="flex justify-between text-sm px-3 py-2 rounded-md hover:bg-accent/40">
                  <code className="text-foreground/80 font-mono text-xs">{h.query}</code>
                  <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
