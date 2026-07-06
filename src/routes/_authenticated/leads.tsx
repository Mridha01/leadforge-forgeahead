import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, UserRound, UsersRound, Flame, Snowflake, Sun, Pencil, ExternalLink, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

// Merged pipeline: old CRM stages + current outreach flow
const STAGES = [
  { key: "new",           label: "New Lead",      tone: "bg-muted text-muted-foreground" },
  { key: "contacted",     label: "Contacted",     tone: "bg-sky-500/15 text-sky-400" },
  { key: "audit_done",    label: "Audit Done",    tone: "bg-accent text-accent-foreground" },
  { key: "interested",    label: "Interested",    tone: "bg-cyan-500/15 text-cyan-400" },
  { key: "proposal_sent", label: "Proposal Sent", tone: "bg-indigo-500/15 text-indigo-400" },
  { key: "negotiation",   label: "Negotiation",   tone: "bg-warning/20 text-warning" },
  { key: "converted",     label: "Converted",     tone: "bg-success/20 text-success" },
  { key: "monthly_seo",   label: "Monthly SEO",   tone: "bg-emerald-500/20 text-emerald-400" },
  { key: "closed_lost",   label: "Lost",          tone: "bg-destructive/20 text-destructive" },
] as const;

const TAG_STYLES: Record<string, { icon: any; cls: string }> = {
  hot:  { icon: Flame,     cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  warm: { icon: Sun,       cls: "bg-success/15 text-success border-success/30" },
  cold: { icon: Snowflake, cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
};

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — LeadForge" }] }),
  component: LeadsPage,
});

type Lead = any;

function LeadsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterNiche, setFilterNiche] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const { data: niches = [] } = useQuery({ queryKey: ["niches"], queryFn: async () => (await supabase.from("niches").select("*").order("sort_order")).data ?? [] });
  const { data: countries = [] } = useQuery({ queryKey: ["countries"], queryFn: async () => (await supabase.from("countries").select("*").order("sort_order")).data ?? [] });
  const { data: cities = [] } = useQuery({ queryKey: ["cities"], queryFn: async () => (await supabase.from("cities").select("*").order("name")).data ?? [] });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => (await supabase.from("leads").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = useMemo(() => leads.filter((l: Lead) =>
    (scope === "team" || !userId || l.created_by === userId || l.assigned_to === userId) &&
    (filterNiche === "all" || l.niche_slug === filterNiche) &&
    (filterCountry === "all" || l.country_code === filterCountry) &&
    (filterTag === "all" || l.tag === filterTag) &&
    (search === "" || l.business_name?.toLowerCase().includes(search.toLowerCase()) || l.owner_name?.toLowerCase().includes(search.toLowerCase()))
  ), [leads, search, filterNiche, filterCountry, filterTag, scope, userId]);

  const grouped = useMemo(() => {
    const g: Record<string, Lead[]> = Object.fromEntries(STAGES.map((s) => [s.key, []]));
    for (const l of filtered) (g[l.status] ??= []).push(l);
    return g;
  }, [filtered]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("leads").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${filtered.length} of ${leads.length} leads`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" />New lead</Button></DialogTrigger>
            <LeadDialog onClose={() => setOpen(false)} niches={niches} countries={countries} cities={cities} />
          </Dialog>
        }
      />
      <div className="p-6 pt-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <Button size="sm" variant={scope === "mine" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => setScope("mine")}>
              <UserRound className="size-3.5" /> Mine
            </Button>
            <Button size="sm" variant={scope === "team" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => setScope("team")}>
              <UsersRound className="size-3.5" /> Team
            </Button>
          </div>
          <div className="relative flex-1 min-w-64">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search business or owner…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterNiche} onValueChange={setFilterNiche}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Niche" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All niches</SelectItem>{niches.map((n: any) => <SelectItem key={n.slug} value={n.slug}>{n.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterCountry} onValueChange={setFilterCountry}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All countries</SelectItem>{countries.map((c: any) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              <SelectItem value="hot">🔥 Hot</SelectItem>
              <SelectItem value="warm">☀️ Warm</SelectItem>
              <SelectItem value="cold">❄️ Cold</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-3 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div key={s.key} className="rounded-xl bg-card/40 border border-border min-h-64">
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${s.tone}`}>{s.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{grouped[s.key]?.length ?? 0}</span>
              </div>
              <div className="p-2 space-y-2">
                {(grouped[s.key] ?? []).map((l: Lead) => {
                  const TagIcon = TAG_STYLES[l.tag ?? "warm"]?.icon ?? Sun;
                  const tagCls = TAG_STYLES[l.tag ?? "warm"]?.cls ?? "";
                  return (
                    <div key={l.id} className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-medium truncate">{l.business_name}</div>
                            {l.tag && (
                              <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border ${tagCls}`}>
                                <TagIcon className="size-2.5" />{l.tag}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {l.niche_slug ?? "—"} · {l.country_code ?? "—"}
                          </div>
                          {(l.total_order_value > 0 || l.monthly_revenue > 0) && (
                            <div className="text-[11px] mt-1 text-success">
                              ${Number(l.total_order_value ?? 0).toLocaleString()} · ${Number(l.monthly_revenue ?? 0)}/mo
                            </div>
                          )}
                          {l.next_action_date && (
                            <div className="text-[11px] mt-1 text-warning">Next: {l.next_action_date}</div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={() => setEditing(l)} className="text-muted-foreground hover:text-primary transition">
                            <Pencil className="size-3.5" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="text-muted-foreground hover:text-destructive transition">
                                <Trash2 className="size-3.5" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                                <AlertDialogDescription>"{l.business_name}" will be permanently removed.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del.mutate(l.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                        {l.email && <Mail className="size-3" />}
                        {l.phone && <Phone className="size-3" />}
                        {l.website_url && <ExternalLink className="size-3" />}
                      </div>
                      <Select value={l.status} onValueChange={(v) => updateStatus.mutate({ id: l.id, status: v })}>
                        <SelectTrigger className="h-7 text-xs mt-2"><SelectValue /></SelectTrigger>
                        <SelectContent>{STAGES.map((s2) => <SelectItem key={s2.key} value={s2.key}>{s2.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  );
                })}
                {(grouped[s.key] ?? []).length === 0 && <p className="text-xs text-muted-foreground/60 px-2 py-3">No leads</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <LeadDialog onClose={() => setEditing(null)} niches={niches} countries={countries} cities={cities} lead={editing} />
        </Dialog>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  business_name: "", owner_name: "", email: "", phone: "", whatsapp: "", website_url: "", gbp_url: "",
  niche_slug: "", country_code: "", city_id: "", service_area: "", lead_source: "google_maps",
  status: "new", tag: "warm", order_status: "none",
  total_order_value: 0, monthly_revenue: 0,
  last_contact_date: "", found_date: new Date().toISOString().slice(0, 10), notes: "",
  // SEO scan
  website_seo_status: "none", gbp_status: "no", local_ranking_potential: "medium",
  competitor_strength: "medium", monthly_lead_potential: 0, recommended_seo_service: "", seo_weakness_notes: "",
  // Follow-ups
  first_contact_date: "", followup_1_date: "", followup_2_date: "", followup_3_date: "",
  next_action_date: "", response_status: "none",
};

function LeadDialog({ onClose, niches, countries, cities, lead }: any) {
  const qc = useQueryClient();
  const isEdit = !!lead;
  const [form, setForm] = useState<any>(() => {
    if (!lead) return { ...EMPTY_FORM };
    return { ...EMPTY_FORM, ...Object.fromEntries(Object.entries(lead).map(([k, v]) => [k, v ?? EMPTY_FORM[k as keyof typeof EMPTY_FORM] ?? ""])) };
  });
  const set = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not signed in");
      const clean: any = { ...form };
      // Normalize empty strings for optional FKs / dates / enums
      for (const k of ["city_id","country_code","niche_slug","last_contact_date","found_date","first_contact_date","followup_1_date","followup_2_date","followup_3_date","next_action_date"]) {
        if (clean[k] === "" || clean[k] == null) clean[k] = null;
      }
      clean.total_order_value = Number(clean.total_order_value) || 0;
      clean.monthly_revenue = Number(clean.monthly_revenue) || 0;
      clean.monthly_lead_potential = Number(clean.monthly_lead_potential) || 0;

      if (isEdit) {
        const { error } = await supabase.from("leads").update(clean).eq("id", lead.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leads").insert({
          ...clean, created_by: user.user.id, assigned_to: user.user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(isEdit ? "Lead updated" : "Lead added");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredCities = cities.filter((c: any) => !form.country_code || c.country_code === form.country_code);

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? `Edit — ${lead.business_name}` : "New Client / Lead"}</DialogTitle>
      </DialogHeader>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="seo">SEO Scan</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
        </TabsList>

        {/* BASIC */}
        <TabsContent value="basic" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Business name *" className="col-span-2"><Input value={form.business_name} onChange={(e) => set({ business_name: e.target.value })} /></Field>
            <Field label="Owner / Client name"><Input value={form.owner_name} onChange={(e) => set({ owner_name: e.target.value })} /></Field>
            <Field label="Industry / Niche">
              <Select value={form.niche_slug || ""} onValueChange={(v) => set({ niche_slug: v })}>
                <SelectTrigger><SelectValue placeholder="Pick niche" /></SelectTrigger>
                <SelectContent>{niches.map((n: any) => <SelectItem key={n.slug} value={n.slug}>{n.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Country">
              <Select value={form.country_code || ""} onValueChange={(v) => set({ country_code: v, city_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Pick country" /></SelectTrigger>
                <SelectContent>{countries.map((c: any) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="City">
              <Select value={form.city_id || ""} onValueChange={(v) => set({ city_id: v })} disabled={!form.country_code}>
                <SelectTrigger><SelectValue placeholder="Pick city" /></SelectTrigger>
                <SelectContent className="max-h-72">{filteredCities.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Service area"><Input value={form.service_area} onChange={(e) => set({ service_area: e.target.value })} placeholder="e.g. Berlin + 30km" /></Field>
            <Field label="Lead source">
              <Select value={form.lead_source || "google_maps"} onValueChange={(v) => set({ lead_source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google_maps">Google Maps</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="fiverr">Fiverr</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Website"><Input value={form.website_url} onChange={(e) => set({ website_url: e.target.value })} /></Field>
            <Field label="Google Maps / GBP URL"><Input value={form.gbp_url} onChange={(e) => set({ gbp_url: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
            <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
            <Field label="Pipeline stage">
              <Select value={form.status} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Order status">
              <Select value={form.order_status} onValueChange={(v) => set({ order_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Total order value ($)"><Input type="number" value={form.total_order_value} onChange={(e) => set({ total_order_value: e.target.value })} /></Field>
            <Field label="Monthly revenue ($)"><Input type="number" value={form.monthly_revenue} onChange={(e) => set({ monthly_revenue: e.target.value })} /></Field>
            <Field label="Last contact date"><Input type="date" value={form.last_contact_date || ""} onChange={(e) => set({ last_contact_date: e.target.value })} /></Field>
            <Field label="Found date"><Input type="date" value={form.found_date || ""} onChange={(e) => set({ found_date: e.target.value })} /></Field>
            <Field label="Tag" className="col-span-2">
              <div className="flex gap-2">
                {(["hot","warm","cold"] as const).map((t) => {
                  const Icon = TAG_STYLES[t].icon;
                  const active = form.tag === t;
                  return (
                    <button key={t} type="button" onClick={() => set({ tag: t })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition ${active ? TAG_STYLES[t].cls : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                      <Icon className="size-3.5" /> {t}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Notes" className="col-span-2">
              <Textarea rows={3} value={form.notes || ""} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
        </TabsContent>

        {/* SEO SCAN */}
        <TabsContent value="seo" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Website SEO status">
              <Select value={form.website_seo_status} onValueChange={(v) => set({ website_seo_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No website</SelectItem>
                  <SelectItem value="weak">Weak</SelectItem>
                  <SelectItem value="okay">Okay</SelectItem>
                  <SelectItem value="strong">Strong</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Google Business Profile">
              <Select value={form.gbp_status} onValueChange={(v) => set({ gbp_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">Not on Google</SelectItem>
                  <SelectItem value="unclaimed">Unclaimed</SelectItem>
                  <SelectItem value="claimed">Claimed</SelectItem>
                  <SelectItem value="optimized">Optimized</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Local ranking potential">
              <Select value={form.local_ranking_potential} onValueChange={(v) => set({ local_ranking_potential: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Competitor strength">
              <Select value={form.competitor_strength} onValueChange={(v) => set({ competitor_strength: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Monthly lead potential"><Input type="number" value={form.monthly_lead_potential} onChange={(e) => set({ monthly_lead_potential: e.target.value })} /></Field>
            <Field label="Recommended SEO service"><Input value={form.recommended_seo_service} onChange={(e) => set({ recommended_seo_service: e.target.value })} placeholder="e.g. Local SEO Pro" /></Field>
            <Field label="SEO weakness notes" className="col-span-2">
              <Textarea rows={4} value={form.seo_weakness_notes || ""} onChange={(e) => set({ seo_weakness_notes: e.target.value })} placeholder="Missing meta, no GBP posts, weak backlinks…" />
            </Field>
          </div>
        </TabsContent>

        {/* FOLLOW-UPS */}
        <TabsContent value="followups" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First contact date"><Input type="date" value={form.first_contact_date || ""} onChange={(e) => set({ first_contact_date: e.target.value })} /></Field>
            <Field label="Follow-up 1"><Input type="date" value={form.followup_1_date || ""} onChange={(e) => set({ followup_1_date: e.target.value })} /></Field>
            <Field label="Follow-up 2"><Input type="date" value={form.followup_2_date || ""} onChange={(e) => set({ followup_2_date: e.target.value })} /></Field>
            <Field label="Follow-up 3"><Input type="date" value={form.followup_3_date || ""} onChange={(e) => set({ followup_3_date: e.target.value })} /></Field>
            <Field label="Next action date"><Input type="date" value={form.next_action_date || ""} onChange={(e) => set({ next_action_date: e.target.value })} /></Field>
            <Field label="Response status">
              <Select value={form.response_status} onValueChange={(v) => set({ response_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No response yet</SelectItem>
                  <SelectItem value="no_reply">No reply</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="wants_more_info">Wants more info</SelectItem>
                  <SelectItem value="scheduled_call">Scheduled call</SelectItem>
                  <SelectItem value="not_interested">Not interested</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={!form.business_name || save.isPending}>
          {isEdit ? "Save changes" : "Create lead"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
