import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sparkles, Copy, Save, Trash2, MessageCircle, FileText, Send, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/offer-builder")({
  head: () => ({ meta: [{ title: "Offer Builder — LeadForge" }] }),
  component: OfferBuilderPage,
});

type Vars = {
  business_name: string;
  owner_name: string;
  city: string;
  niche: string;
  pain: string;
  offer_price: string;
  sender_name: string;
};

const TEMPLATES = [
  {
    key: "fb_short_dm",
    label: "FB Short DM",
    icon: MessageCircle,
    description: "Punchy 4-line Messenger opener. No fluff, hook + soft CTA.",
    build: (v: Vars) => `Hey ${v.owner_name || "there"} 👋

Saw ${v.business_name || "your page"} in ${v.city || "your area"} — love what you're doing in the ${v.niche || "local"} space. Noticed ${v.pain || "you're not showing up in Google's top 3 for local searches"}, which is where 78% of new customers come from.

We help local ${v.niche || "businesses"} rank in the Google 3-pack in 60–90 days. Would a free 5-min audit be useful?

— ${v.sender_name || "Team"}`,
  },
  {
    key: "fb_value_dm",
    label: "FB Value DM",
    icon: FileText,
    description: "Longer, value-first message. Shows insight + gives 3 quick wins.",
    build: (v: Vars) => `Hi ${v.owner_name || "there"},

I run a small SEO team and I've been quietly auditing ${v.niche || "local"} businesses in ${v.city || "your city"} — ${v.business_name || "your business"} caught my eye.

Here's what I noticed (took me 3 minutes):
 1. ${v.pain || "Your Google Business Profile isn't optimised for the top 3-pack"}
 2. Reviews aren't being responded to → hurts local ranking
 3. Website isn't showing city-specific keywords Google needs to trust you

Quick wins from these 3 alone usually push a listing 4–7 positions up in 30 days.

If you want, I'll send you the full audit PDF free — no pitch. Just reply "send it".

— ${v.sender_name || "Team"}`,
  },
  {
    key: "fb_proposal",
    label: "Full Proposal",
    icon: Send,
    description: "Ready-to-send proposal after a positive reply. Includes scope + price.",
    build: (v: Vars) => `Hi ${v.owner_name || "there"},

Thanks for the reply! Here's the plan for ${v.business_name || "your business"}:

🎯 GOAL — Rank ${v.business_name || "you"} in the Google Local 3-pack for "${v.niche || "your service"} in ${v.city || "your city"}" within 60–90 days.

📦 WHAT'S INCLUDED (Monthly)
 • Google Business Profile optimisation & weekly posts
 • 8 hyper-local citations / month
 • On-page SEO for 3 service pages (city + niche keywords)
 • Review generation system (auto-request from customers)
 • Monthly ranking report with the exact 3-pack position
 • Competitor tracking (top 5 local competitors)

💰 INVESTMENT
${v.offer_price || "$${offer_price}"} / month — no lock-in, cancel anytime after month 3.
Setup fee: waived if you start this month.

📅 TIMELINE
 • Week 1  — Audit + GBP fixes
 • Week 2–4 — Citations + on-page
 • Month 2 — Reviews + tracking live
 • Month 3+ — 3-pack push

Ready to start? Reply "let's go" and I'll send the onboarding link.

— ${v.sender_name || "Team"}`,
  },
] as const;

function OfferBuilderPage() {
  const qc = useQueryClient();
  const [tplKey, setTplKey] = useState<string>(TEMPLATES[0].key);
  const [vars, setVars] = useState<Vars>({
    business_name: "", owner_name: "", city: "", niche: "",
    pain: "", offer_price: "", sender_name: "",
  });
  const [customContent, setCustomContent] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");

  const tpl = TEMPLATES.find((t) => t.key === tplKey)!;
  const content = customContent ?? tpl.build(vars);

  const { data: leads = [] } = useQuery({
    queryKey: ["offer-leads"],
    queryFn: async () => (await supabase.from("leads").select("id,business_name,owner_name,niche_slug,country_code").order("updated_at", { ascending: false }).limit(200)).data ?? [],
  });

  const { data: saved = [] } = useQuery({
    queryKey: ["saved-offers"],
    queryFn: async () => (await supabase.from("saved_offers").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const setV = (patch: Partial<Vars>) => { setVars((s) => ({ ...s, ...patch })); setCustomContent(null); };

  const fillFromLead = (id: string) => {
    const l = (leads as any[]).find((x) => x.id === id);
    if (!l) return;
    setV({ business_name: l.business_name ?? "", owner_name: l.owner_name ?? "", niche: l.niche_slug ?? "" });
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("saved_offers").insert({
        user_id: user.user!.id,
        title: saveTitle || `${tpl.label} — ${vars.business_name || "Untitled"}`,
        template_key: tplKey,
        business_name: vars.business_name || null,
        content,
        meta: vars,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Offer saved"); setSaveOpen(false); setSaveTitle(""); qc.invalidateQueries({ queryKey: ["saved-offers"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("saved_offers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["saved-offers"] }); },
  });

  const copy = () => { navigator.clipboard.writeText(content); toast.success("Copied to clipboard"); };

  return (
    <div>
      <PageHeader
        title="Offer Builder"
        subtitle="Generate FB cold-outreach messages and proposals in seconds"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copy} className="gap-1.5"><Copy className="size-3.5" /> Copy</Button>
            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Save className="size-3.5" /> Save</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Save offer</DialogTitle></DialogHeader>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder={`${tpl.label} — ${vars.business_name || "Untitled"}`} />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
                  <Button onClick={() => save.mutate()} disabled={save.isPending}>Save offer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="p-6 pt-4 grid lg:grid-cols-[380px_1fr] gap-4">
        <div className="space-y-4">
          {/* Template picker */}
          <Card className="p-4 bg-card border-border space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Template</Label>
            <div className="grid gap-2">
              {TEMPLATES.map((t) => {
                const Icon = t.icon;
                const active = t.key === tplKey;
                return (
                  <button
                    key={t.key}
                    onClick={() => { setTplKey(t.key); setCustomContent(null); }}
                    className={`text-left p-3 rounded-lg border transition-colors ${active ? "border-primary/60 bg-primary/[0.06]" : "border-border hover:bg-accent/40"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm font-medium">{t.label}</span>
                      {active && <Badge variant="secondary" className="text-[10px] ml-auto">selected</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{t.description}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Variables */}
          <Card className="p-4 bg-card border-border space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Sparkles className="size-3" /> Personalise</Label>

            <div className="space-y-2">
              <Label className="text-xs">Autofill from lead</Label>
              <Select onValueChange={fillFromLead}>
                <SelectTrigger><SelectValue placeholder="Pick a lead…" /></SelectTrigger>
                <SelectContent>
                  {(leads as any[]).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.business_name} · {l.niche_slug ?? "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <F label="Business name"><Input value={vars.business_name} onChange={(e) => setV({ business_name: e.target.value })} /></F>
            <F label="Owner name"><Input value={vars.owner_name} onChange={(e) => setV({ owner_name: e.target.value })} placeholder="First name" /></F>
            <div className="grid grid-cols-2 gap-2">
              <F label="City"><Input value={vars.city} onChange={(e) => setV({ city: e.target.value })} /></F>
              <F label="Niche"><Input value={vars.niche} onChange={(e) => setV({ niche: e.target.value })} placeholder="dentist" /></F>
            </div>
            <F label="Pain point (specific)"><Textarea rows={2} value={vars.pain} onChange={(e) => setV({ pain: e.target.value })} placeholder="e.g. not showing up in Google 3-pack for 'dentist near me'" /></F>
            <div className="grid grid-cols-2 gap-2">
              <F label="Monthly price"><Input value={vars.offer_price} onChange={(e) => setV({ offer_price: e.target.value })} placeholder="$499" /></F>
              <F label="Sender"><Input value={vars.sender_name} onChange={(e) => setV({ sender_name: e.target.value })} placeholder="Your name" /></F>
            </div>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Card className="p-5 bg-card border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <tpl.icon className="size-4 text-primary" />
                <h3 className="text-sm font-medium">{tpl.label} preview</h3>
                {customContent && <Badge variant="outline" className="text-[10px]">edited</Badge>}
              </div>
              <span className="text-[10px] text-muted-foreground">{content.length} chars</span>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setCustomContent(e.target.value)}
              className="min-h-[420px] font-mono text-sm leading-relaxed"
            />
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={copy} className="gap-1.5"><Copy className="size-3.5" /> Copy</Button>
              {customContent && (
                <Button variant="ghost" size="sm" onClick={() => setCustomContent(null)}>Reset to template</Button>
              )}
            </div>
          </Card>

          {/* Saved offers */}
          <Card className="p-5 bg-card border-border">
            <h3 className="text-sm font-medium mb-3">Saved offers ({(saved as any[]).length})</h3>
            {(saved as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved offers yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(saved as any[]).map((s) => (
                  <li key={s.id} className="py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{s.title}</span>
                        <Badge variant="secondary" className="text-[10px]">{TEMPLATES.find(t => t.key === s.template_key)?.label ?? s.template_key}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{s.content.slice(0, 90)}…</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(s.content); toast.success("Copied"); }}>
                      <Copy className="size-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="size-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete offer?</AlertDialogTitle>
                          <AlertDialogDescription>"{s.title}" will be permanently removed.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(s.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
