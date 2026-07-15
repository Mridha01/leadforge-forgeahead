import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Edit3, TrendingUp, TrendingDown, Wallet, DollarSign, Settings2, Users } from "lucide-react";
import { toast } from "sonner";

const INCOME_CATEGORIES = ["Web design", "SEO", "Hosting", "Maintenance", "Consulting", "Other"];
const EXPENSE_CATEGORIES = ["Domain", "Hosting", "Subscription", "Tools / Software", "Ads", "Salary", "Other"];

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — LeadForge" }] }),
  component: FinancePage,
});

function FinancePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [monthFilter, setMonthFilter] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [kindFilter, setKindFilter] = useState<"all" | "income" | "expense">("all");

  const { data: rate = 122 } = useQuery({
    queryKey: ["usd_bdt_rate"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("app_settings").select("value").eq("key", "usd_bdt_rate").maybeSingle();
      const v = data?.value;
      return typeof v === "number" ? v : Number(v) || 122;
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["finance_entries"],
    queryFn: async () => (await (supabase as any).from("finance_entries").select("*").order("entry_date", { ascending: false })).data ?? [],
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at")).data ?? [],
  });

  const months = useMemo(() => {
    const set = new Set<string>();
    set.add(new Date().toISOString().slice(0, 7));
    entries.forEach((e: any) => set.add(String(e.entry_date).slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [entries]);

  const filtered = useMemo(() => entries.filter((e: any) =>
    String(e.entry_date).startsWith(monthFilter) && (kindFilter === "all" || e.kind === kindFilter)
  ), [entries, monthFilter, kindFilter]);

  const totals = useMemo(() => {
    let incomeUsd = 0, incomeBdt = 0, expenseUsd = 0, expenseBdt = 0;
    filtered.forEach((e: any) => {
      if (e.kind === "income") { incomeUsd += Number(e.amount_usd) || 0; incomeBdt += Number(e.amount_bdt) || 0; }
      else { expenseUsd += Number(e.amount_usd) || 0; expenseBdt += Number(e.amount_bdt) || 0; }
    });
    return {
      incomeUsd, incomeBdt, expenseUsd, expenseBdt,
      netUsd: incomeUsd - expenseUsd,
      netBdt: incomeBdt - expenseBdt,
    };
  }, [filtered]);

  const splitTotals = useMemo(() => {
    let a = 0, b = 0;
    filtered.forEach((e: any) => {
      a += Number(e.split_member_a) || 0;
      b += Number(e.split_member_b) || 0;
    });
    return { a, b };
  }, [filtered]);

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("finance_entries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance_entries"] }); toast.success("Entry deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const memberA = profiles[0] as any;
  const memberB = profiles[1] as any;

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Track agency income (USD), expenses, and monthly profit split."
        action={
          <div className="flex gap-2">
            <RateDialog currentRate={rate} />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" />New entry</Button></DialogTrigger>
              <EntryDialog onClose={() => setOpen(false)} rate={rate} memberA={memberA} memberB={memberB} />
            </Dialog>
          </div>
        }
      />

      <div className="p-6 pt-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {new Date(m + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {(["all", "income", "expense"] as const).map((k) => (
              <Button key={k} size="sm" variant={kindFilter === k ? "default" : "ghost"} className="h-8 capitalize" onClick={() => setKindFilter(k)}>{k}</Button>
            ))}
          </div>
          <div className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <DollarSign className="size-3.5" /> 1 USD = <span className="font-medium text-foreground">৳{rate}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Income" usd={totals.incomeUsd} bdt={totals.incomeBdt} icon={<TrendingUp className="size-4" />} tone="success" />
          <StatCard label="Expenses" usd={totals.expenseUsd} bdt={totals.expenseBdt} icon={<TrendingDown className="size-4" />} tone="destructive" />
          <StatCard label="Net profit" usd={totals.netUsd} bdt={totals.netBdt} icon={<Wallet className="size-4" />} tone={totals.netUsd >= 0 ? "primary" : "destructive"} />
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" /> Profit split</div>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground truncate max-w-32">{memberA?.full_name ?? memberA?.email ?? "Member A"}</span>
                <span className="font-medium tabular-nums">${splitTotals.a.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground truncate max-w-32">{memberB?.full_name ?? memberB?.email ?? "Member B"}</span>
                <span className="font-medium tabular-nums">${splitTotals.b.toFixed(2)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Category · Description</th>
                <th className="text-left px-4 py-2.5">Client / Project</th>
                <th className="text-right px-4 py-2.5">USD</th>
                <th className="text-right px-4 py-2.5">BDT</th>
                <th className="text-right px-4 py-2.5">Split (A / B)</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e: any) => (
                <tr key={e.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(e.entry_date).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${e.kind === "income" ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {e.kind}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{e.category}</div>
                    {e.description && <div className="text-xs text-muted-foreground line-clamp-1">{e.description}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {e.client_name || "—"}
                    {e.project_name && <div className="text-muted-foreground">{e.project_name}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">${Number(e.amount_usd).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">৳{Number(e.amount_bdt).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {e.split_member_a || e.split_member_b
                      ? `$${Number(e.split_member_a || 0).toFixed(0)} / $${Number(e.split_member_b || 0).toFixed(0)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(e)}><Edit3 className="size-3.5" /></Button>
                      <ConfirmDelete onConfirm={() => del.mutate(e.id)} label={`${e.category} · $${Number(e.amount_usd).toFixed(2)}`} />
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <Wallet className="size-6 mx-auto mb-2 opacity-40" />
                  No entries for this month yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <EntryDialog onClose={() => setEditing(null)} rate={rate} memberA={memberA} memberB={memberB} initial={editing} />}
      </Dialog>
    </div>
  );
}

function StatCard({ label, usd, bdt, icon, tone }: { label: string; usd: number; bdt: number; icon: any; tone: "success" | "destructive" | "primary" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card className="p-4 bg-card border-border">
      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground`}>{icon} {label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneCls}`}>${usd.toFixed(2)}</div>
      <div className="text-xs text-muted-foreground tabular-nums">৳{bdt.toLocaleString()}</div>
    </Card>
  );
}

function ConfirmDelete({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
          <AlertDialogDescription>{label} — this cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RateDialog({ currentRate }: { currentRate: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(String(currentRate));
  useEffect(() => setVal(String(currentRate)), [currentRate]);

  const save = useMutation({
    mutationFn: async () => {
      const n = Number(val);
      if (!n || n <= 0) throw new Error("Enter a valid rate");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("app_settings").upsert({
        key: "usd_bdt_rate", value: n, updated_by: u.user?.id, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["usd_bdt_rate"] }); toast.success("Rate updated"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Settings2 className="size-4 mr-1.5" />USD rate</Button></DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>USD → BDT exchange rate</DialogTitle>
          <DialogDescription>Used to convert USD amounts to BDT in new entries.</DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs">1 USD =</Label>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm text-muted-foreground">৳</span>
            <Input type="number" step="0.01" value={val} onChange={(e) => setVal(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntryDialog({ onClose, rate, memberA, memberB, initial }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    kind: initial?.kind ?? "income",
    currency: initial?.currency ?? "USD",
    category: initial?.category ?? "Web design",
    description: initial?.description ?? "",
    amount_usd: initial?.amount_usd != null ? String(initial.amount_usd) : "",
    usd_rate: initial?.usd_rate != null ? String(initial.usd_rate) : String(rate),
    amount_bdt: initial?.amount_bdt != null ? String(initial.amount_bdt) : "",
    client_name: initial?.client_name ?? "",
    project_name: initial?.project_name ?? "",
    entry_date: initial?.entry_date ?? new Date().toISOString().slice(0, 10),
    paid_to: initial?.paid_to ?? "",
    split_member_a: initial?.split_member_a != null ? String(initial.split_member_a) : "",
    split_member_b: initial?.split_member_b != null ? String(initial.split_member_b) : "",
    notes: initial?.notes ?? "",
  });

  // Auto-convert between USD ↔ BDT based on selected primary currency
  useEffect(() => {
    const r = Number(form.usd_rate) || rate;
    if (form.currency === "USD") {
      const usd = Number(form.amount_usd) || 0;
      setForm((f) => ({ ...f, amount_bdt: (usd * r).toFixed(2) }));
    } else {
      const bdt = Number(form.amount_bdt) || 0;
      setForm((f) => ({ ...f, amount_usd: r > 0 ? (bdt / r).toFixed(2) : "0" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.amount_usd, form.amount_bdt, form.usd_rate, form.currency]);

  const fillEqualSplit = () => {
    const usd = Number(form.amount_usd) || 0;
    const half = (usd / 2).toFixed(2);
    setForm((f) => ({ ...f, split_member_a: half, split_member_b: half }));
  };

  const categories = form.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload: any = {
        kind: form.kind,
        currency: form.currency,
        category: form.category,
        description: form.description || null,
        amount_usd: Number(form.amount_usd) || 0,
        usd_rate: Number(form.usd_rate) || rate,
        amount_bdt: Number(form.amount_bdt) || 0,
        client_name: form.client_name || null,
        project_name: form.project_name || null,
        entry_date: form.entry_date,
        paid_to: form.paid_to || null,
        split_member_a: form.split_member_a ? Number(form.split_member_a) : null,
        split_member_b: form.split_member_b ? Number(form.split_member_b) : null,
        notes: form.notes || null,
      };
      if (initial) {
        const { error } = await (supabase as any).from("finance_entries").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("finance_entries").insert({ ...payload, created_by: u.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance_entries"] }); toast.success(initial ? "Updated" : "Entry added"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit entry" : "New finance entry"}</DialogTitle>
        <DialogDescription>Record an income or expense. USD amounts are auto-converted to BDT.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v, category: v === "income" ? "Web design" : "Domain" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Category">
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></Field>
        <Field label={form.kind === "income" ? "Client name" : "Paid to / Vendor"}>
          <Input value={form.kind === "income" ? form.client_name : form.paid_to}
            onChange={(e) => setForm({ ...form, [form.kind === "income" ? "client_name" : "paid_to"]: e.target.value } as any)} />
        </Field>
        {form.kind === "income" && (
          <Field label="Project" className="col-span-2"><Input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} /></Field>
        )}
        <Field label="Amount (USD) *">
          <Input type="number" step="0.01" value={form.amount_usd} onChange={(e) => setForm({ ...form, amount_usd: e.target.value })} />
        </Field>
        <Field label="USD → BDT rate">
          <Input type="number" step="0.01" value={form.usd_rate} onChange={(e) => setForm({ ...form, usd_rate: e.target.value })} />
        </Field>
        <Field label="Amount (BDT)" className="col-span-2">
          <Input type="number" step="0.01" value={form.amount_bdt} onChange={(e) => setForm({ ...form, amount_bdt: e.target.value })} />
        </Field>

        {form.kind === "income" && (
          <>
            <div className="col-span-2 border-t border-border pt-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Profit split</span>
              <Button type="button" variant="outline" size="sm" onClick={fillEqualSplit}>Split 50/50</Button>
            </div>
            <Field label={`${memberA?.full_name ?? memberA?.email ?? "Member A"} (USD)`}>
              <Input type="number" step="0.01" value={form.split_member_a} onChange={(e) => setForm({ ...form, split_member_a: e.target.value })} />
            </Field>
            <Field label={`${memberB?.full_name ?? memberB?.email ?? "Member B"} (USD)`}>
              <Input type="number" step="0.01" value={form.split_member_b} onChange={(e) => setForm({ ...form, split_member_b: e.target.value })} />
            </Field>
          </>
        )}

        <Field label="Description / Notes" className="col-span-2"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={!form.amount_usd || save.isPending}>{initial ? "Save" : "Add entry"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
