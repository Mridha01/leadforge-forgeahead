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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, ExternalLink, ShieldAlert, ShieldCheck, MessageCircle, Edit3 } from "lucide-react";
import { toast } from "sonner";

const STATUSES = [
  { key: "to_contact", label: "To contact", tone: "bg-muted text-muted-foreground" },
  { key: "messaged", label: "Messaged", tone: "bg-primary/15 text-primary" },
  { key: "no_response", label: "No response", tone: "bg-muted text-muted-foreground" },
  { key: "replied", label: "Replied", tone: "bg-warning/20 text-warning" },
  { key: "not_interested", label: "Not interested", tone: "bg-destructive/15 text-destructive" },
  { key: "converted", label: "Converted", tone: "bg-success/20 text-success" },
] as const;

export const Route = createFileRoute("/_authenticated/fb-outreach")({
  head: () => ({ meta: [{ title: "FB Outreach — LeadForge" }] }),
  component: FbOutreachPage,
});

function FbOutreachPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const { data: niches = [] } = useQuery({ queryKey: ["niches"], queryFn: async () => (await supabase.from("niches").select("*").order("sort_order")).data ?? [] });
  const { data: countries = [] } = useQuery({ queryKey: ["countries"], queryFn: async () => (await supabase.from("countries").select("*").order("sort_order")).data ?? [] });
  const { data: cities = [] } = useQuery({ queryKey: ["cities"], queryFn: async () => (await supabase.from("cities").select("*").order("name")).data ?? [] });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: async () => (await supabase.from("profiles").select("*")).data ?? [] });

  const { data: rows = [] } = useQuery({
    queryKey: ["fb_outreach"],
    queryFn: async () => (await (supabase as any).from("fb_outreach").select("*").order("messaged_at", { ascending: false })).data ?? [],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r: any) =>
      (scope !== "mine" || r.created_by === userId) &&
      (filterStatus === "all" || r.message_status === filterStatus) &&
      (q === "" ||
        r.business_name?.toLowerCase().includes(q) ||
        r.contact_name?.toLowerCase().includes(q) ||
        r.fb_page_url?.toLowerCase().includes(q))
    );
  }, [rows, search, filterStatus, scope, userId]);

  // Duplicate detection for the search bar
  const possibleDuplicate = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 3) return null;
    return rows.find((r: any) =>
      r.business_name?.toLowerCase().includes(q) ||
      r.fb_page_url?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("fb_outreach").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fb_outreach"] }); toast.success("Entry deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, message_status }: any) => {
      const { error } = await (supabase as any).from("fb_outreach").update({ message_status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fb_outreach"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const ownerName = (id: string) => {
    const p: any = profiles.find((p: any) => p.id === id);
    return p?.full_name || p?.email || "—";
  };

  return (
    <div>
      <PageHeader
        title="Facebook Outreach"
        subtitle="Track who has already been messaged on Facebook — avoid double outreach."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" />Log outreach</Button></DialogTrigger>
            <OutreachDialog onClose={() => setOpen(false)} niches={niches} countries={countries} cities={cities} />
          </Dialog>
        }
      />
      <div className="p-6 pt-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <Button size="sm" variant={scope === "all" ? "default" : "ghost"} className="h-8" onClick={() => setScope("all")}>Team</Button>
            <Button size="sm" variant={scope === "mine" ? "default" : "ghost"} className="h-8" onClick={() => setScope("mine")}>Mine</Button>
          </div>
          <div className="relative flex-1 min-w-64">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search business name, contact, or FB URL…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Duplicate warning banner */}
        {possibleDuplicate ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 flex items-start gap-3">
            <ShieldAlert className="size-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-warning">Already in the system — don't double message.</div>
              <div className="text-muted-foreground mt-0.5">
                <span className="font-medium text-foreground">{possibleDuplicate.business_name}</span> was contacted by{" "}
                <span className="font-medium text-foreground">{ownerName(possibleDuplicate.created_by)}</span> on{" "}
                {new Date(possibleDuplicate.messaged_at || possibleDuplicate.created_at).toLocaleDateString()} ·{" "}
                status: <span className="font-medium text-foreground">{STATUSES.find(s => s.key === possibleDuplicate.message_status)?.label}</span>
              </div>
            </div>
          </div>
        ) : search.trim().length >= 3 ? (
          <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 flex items-center gap-3">
            <ShieldCheck className="size-5 text-success" />
            <div className="text-sm"><span className="font-medium text-success">Clear to message.</span> <span className="text-muted-foreground">No prior outreach found for "{search}".</span></div>
          </div>
        ) : null}

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Business</th>
                <th className="text-left px-4 py-2.5">Contact / FB</th>
                <th className="text-left px-4 py-2.5">Niche · Location</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Messaged by</th>
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => {
                const s = STATUSES.find(s => s.key === r.message_status);
                const city: any = cities.find((c: any) => c.id === r.city_id);
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{r.business_name}</div>
                      {r.notes && <div className="text-xs text-muted-foreground line-clamp-1">{r.notes}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div>{r.contact_name || "—"}</div>
                      {r.fb_page_url && (
                        <a href={r.fb_page_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                          Open FB <ExternalLink className="size-3" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {r.niche_slug || "—"}
                      <div>{city?.name || r.country_code || "—"}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Select value={r.message_status} onValueChange={(v) => updateStatus.mutate({ id: r.id, message_status: v })}>
                        <SelectTrigger className={`h-7 text-xs w-36 ${s?.tone}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s2) => <SelectItem key={s2.key} value={s2.key}>{s2.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{ownerName(r.created_by)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(r.messaged_at || r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(r)}><Edit3 className="size-3.5" /></Button>
                        <DeleteButton onConfirm={() => del.mutate(r.id)} name={r.business_name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <MessageCircle className="size-6 mx-auto mb-2 opacity-40" />
                  No outreach logged yet. Click "Log outreach" to add the first one.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <OutreachDialog onClose={() => setEditing(null)} niches={niches} countries={countries} cities={cities} initial={editing} />}
      </Dialog>
    </div>
  );
}

function DeleteButton({ onConfirm, name }: { onConfirm: () => void; name: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
          <AlertDialogDescription>"{name}" will be permanently removed. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function OutreachDialog({ onClose, niches, countries, cities, initial }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    business_name: initial?.business_name ?? "",
    contact_name: initial?.contact_name ?? "",
    fb_page_url: initial?.fb_page_url ?? "",
    niche_slug: initial?.niche_slug ?? "",
    country_code: initial?.country_code ?? "",
    city_id: initial?.city_id ?? "",
    message_status: initial?.message_status ?? "messaged",
    response: initial?.response ?? "",
    notes: initial?.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload: any = {
        ...form,
        city_id: form.city_id || null,
        country_code: form.country_code || null,
        niche_slug: form.niche_slug || null,
      };
      if (initial) {
        const { error } = await (supabase as any).from("fb_outreach").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("fb_outreach").insert({ ...payload, created_by: u.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fb_outreach"] }); toast.success(initial ? "Updated" : "Outreach logged"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredCities = cities.filter((c: any) => !form.country_code || c.country_code === form.country_code);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit outreach" : "Log Facebook outreach"}</DialogTitle>
        <DialogDescription>Record who you messaged so the rest of the team won't double-contact them.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Business / Page name *" className="col-span-2"><Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></Field>
        <Field label="Contact person"><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Field>
        <Field label="Facebook page URL"><Input placeholder="https://facebook.com/…" value={form.fb_page_url} onChange={(e) => setForm({ ...form, fb_page_url: e.target.value })} /></Field>
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
        <Field label="Status">
          <Select value={form.message_status} onValueChange={(v) => setForm({ ...form, message_status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Their response" className="col-span-2"><Textarea rows={2} value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} /></Field>
        <Field label="Internal notes" className="col-span-2"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={!form.business_name || save.isPending}>{initial ? "Save" : "Log outreach"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
