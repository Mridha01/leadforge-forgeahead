import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";

const STATUSES = [
  { key: "new", label: "New", tone: "bg-muted text-muted-foreground" },
  { key: "audit_done", label: "Audit done", tone: "bg-accent text-accent-foreground" },
  { key: "email_sent", label: "Email sent", tone: "bg-primary/15 text-primary" },
  { key: "followup_1", label: "Follow-up 1", tone: "bg-primary/15 text-primary" },
  { key: "followup_2", label: "Follow-up 2", tone: "bg-primary/15 text-primary" },
  { key: "replied", label: "Replied", tone: "bg-warning/20 text-warning" },
  { key: "meeting", label: "Meeting", tone: "bg-warning/20 text-warning" },
  { key: "proposal", label: "Proposal", tone: "bg-warning/20 text-warning" },
  { key: "closed_won", label: "Won", tone: "bg-success/20 text-success" },
  { key: "closed_lost", label: "Lost", tone: "bg-destructive/20 text-destructive" },
] as const;

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — LeadForge" }] }),
  component: LeadsPage,
});

function LeadsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterNiche, setFilterNiche] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: niches = [] } = useQuery({ queryKey: ["niches"], queryFn: async () => (await supabase.from("niches").select("*").order("sort_order")).data ?? [] });
  const { data: countries = [] } = useQuery({ queryKey: ["countries"], queryFn: async () => (await supabase.from("countries").select("*").order("sort_order")).data ?? [] });
  const { data: cities = [] } = useQuery({ queryKey: ["cities"], queryFn: async () => (await supabase.from("cities").select("*").order("name")).data ?? [] });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => (await supabase.from("leads").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = useMemo(() => leads.filter((l) =>
    (scope === "team" || !userId || l.created_by === userId || l.assigned_to === userId) &&
    (filterNiche === "all" || l.niche_slug === filterNiche) &&
    (filterCountry === "all" || l.country_code === filterCountry) &&
    (search === "" || l.business_name.toLowerCase().includes(search.toLowerCase()))
  ), [leads, search, filterNiche, filterCountry, scope, userId]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof leads> = Object.fromEntries(STATUSES.map((s) => [s.key, []]));
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
            <NewLeadDialog onClose={() => setOpen(false)} niches={niches} countries={countries} cities={cities} />
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
            <Input placeholder="Search business name…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterNiche} onValueChange={setFilterNiche}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Niche" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All niches</SelectItem>{niches.map((n) => <SelectItem key={n.slug} value={n.slug}>{n.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterCountry} onValueChange={setFilterCountry}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All countries</SelectItem>{countries.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-3 overflow-x-auto pb-4">
          {STATUSES.map((s) => (
            <div key={s.key} className="rounded-xl bg-card/40 border border-border min-h-64">
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${s.tone}`}>{s.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{grouped[s.key]?.length ?? 0}</span>
              </div>
              <div className="p-2 space-y-2">
                {(grouped[s.key] ?? []).map((l) => (
                  <div key={l.id} className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{l.business_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{l.niche_slug} · {l.country_code}</div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="text-muted-foreground hover:text-destructive transition shrink-0">
                            <Trash2 className="size-3.5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                            <AlertDialogDescription>"{l.business_name}" will be permanently removed. This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => del.mutate(l.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    {l.email && <div className="text-xs text-muted-foreground mt-1 truncate">{l.email}</div>}
                    <Select value={l.status} onValueChange={(v) => updateStatus.mutate({ id: l.id, status: v })}>
                      <SelectTrigger className="h-7 text-xs mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s2) => <SelectItem key={s2.key} value={s2.key}>{s2.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
                {(grouped[s.key] ?? []).length === 0 && <p className="text-xs text-muted-foreground/60 px-2 py-3">No leads</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewLeadDialog({ onClose, niches, countries, cities }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    business_name: "", owner_name: "", email: "", phone: "", website_url: "", gbp_url: "",
    niche_slug: "", country_code: "", city_id: "", lead_source: "google_maps",
  });
  const create = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not signed in");
      const { error } = await supabase.from("leads").insert({
        ...form,
        city_id: form.city_id || null,
        country_code: form.country_code || null,
        niche_slug: form.niche_slug || null,
        created_by: user.user.id,
        assigned_to: user.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead added"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredCities = cities.filter((c: any) => !form.country_code || c.country_code === form.country_code);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New lead</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Business name *" className="col-span-2"><Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></Field>
        <Field label="Owner"><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Website"><Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} /></Field>
        <Field label="Niche">
          <Select value={form.niche_slug} onValueChange={(v) => setForm({ ...form, niche_slug: v })}>
            <SelectTrigger><SelectValue placeholder="Pick niche" /></SelectTrigger>
            <SelectContent>{niches.map((n: any) => <SelectItem key={n.slug} value={n.slug}>{n.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Country">
          <Select value={form.country_code} onValueChange={(v) => setForm({ ...form, country_code: v, city_id: "" })}>
            <SelectTrigger><SelectValue placeholder="Pick country" /></SelectTrigger>
            <SelectContent>{countries.map((c: any) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="City">
          <Select value={form.city_id} onValueChange={(v) => setForm({ ...form, city_id: v })} disabled={!form.country_code}>
            <SelectTrigger><SelectValue placeholder="Pick city" /></SelectTrigger>
            <SelectContent className="max-h-72">{filteredCities.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="GBP URL" className="col-span-2"><Input value={form.gbp_url} onChange={(e) => setForm({ ...form, gbp_url: e.target.value })} /></Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => create.mutate()} disabled={!form.business_name || create.isPending}>Create lead</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
