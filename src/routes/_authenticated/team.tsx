import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { User2, Edit3, Mail, Phone, Clock, Briefcase, Calendar, ShieldCheck, TrendingUp, MessageCircle, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — LeadForge" }] }),
  component: TeamPage,
});

function TeamPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at")).data ?? [],
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-team"],
    queryFn: async () => (await supabase.from("leads").select("created_by,status")).data ?? [],
  });
  const { data: fb = [] } = useQuery({
    queryKey: ["fb-team"],
    queryFn: async () => (await (supabase as any).from("fb_outreach").select("created_by,message_status")).data ?? [],
  });

  const perUser = (id: string) => {
    const mine = leads.filter((l: any) => l.created_by === id);
    const fbMine = fb.filter((f: any) => f.created_by === id);
    const replied = mine.filter((l: any) => ["replied", "meeting", "proposal", "closed_won"].includes(l.status)).length;
    return {
      total: mine.length,
      won: mine.filter((l: any) => l.status === "closed_won").length,
      replied,
      replyRate: mine.length ? Math.round((replied / mine.length) * 100) : 0,
      fbCount: fbMine.length,
      fbConverted: fbMine.filter((f: any) => f.message_status === "converted").length,
    };
  };

  const roleOf = (id: string) => (roles as any[]).find((r) => r.user_id === id)?.role ?? "member";

  // Find top performer
  const top = profiles.reduce((best: any, p: any) => {
    const s = perUser(p.id);
    return !best || s.won > best.score ? { id: p.id, score: s.won } : best;
  }, null as any);

  return (
    <div>
      <PageHeader title="Team" subtitle="Members, roles, contact info, and lifetime performance." />
      <div className="p-6 pt-4 grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {profiles.map((p: any) => {
          const s = perUser(p.id);
          const role = roleOf(p.id);
          const isMe = p.id === userId;
          const isTop = top?.id === p.id && top?.score > 0;
          return (
            <Card key={p.id} className="p-5 bg-card border-border relative overflow-hidden">
              {isTop && (
                <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning/20 text-warning text-[10px] font-medium uppercase tracking-wider">
                  <Trophy className="size-3" /> Top performer
                </div>
              )}
              <div className="flex items-start gap-3 mb-4">
                <div className="size-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <User2 className="size-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold truncate">{p.full_name ?? p.email}</div>
                    {isMe && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary">You</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.role_title || (role === "admin" ? "Administrator" : "Team member")}</div>
                  {role === "admin" && (
                    <div className="inline-flex items-center gap-1 text-[10px] text-success mt-1">
                      <ShieldCheck className="size-3" /> Admin access
                    </div>
                  )}
                </div>
                {isMe && (
                  <EditProfileDialog profile={p}>
                    <Button size="sm" variant="outline"><Edit3 className="size-3.5 mr-1" />Edit</Button>
                  </EditProfileDialog>
                )}
              </div>

              {/* Contact strip */}
              <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground mb-4">
                <InfoRow icon={<Mail className="size-3.5" />} value={p.email} />
                {p.phone && <InfoRow icon={<Phone className="size-3.5" />} value={p.phone} />}
                {p.timezone && <InfoRow icon={<Clock className="size-3.5" />} value={p.timezone} />}
                {p.joined_at && <InfoRow icon={<Calendar className="size-3.5" />} value={`Joined ${new Date(p.joined_at).toLocaleDateString()}`} />}
              </div>

              {p.bio && <p className="text-xs text-muted-foreground mb-4 italic border-l-2 border-border pl-2">{p.bio}</p>}

              {/* Performance */}
              <div className="grid grid-cols-3 gap-2 text-center mb-2">
                <Stat label="Leads" value={s.total} />
                <Stat label="Replied" value={s.replied} />
                <Stat label="Won" value={s.won} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Reply rate" value={`${s.replyRate}%`} icon={<TrendingUp className="size-3" />} />
                <Stat label="FB outreach" value={s.fbCount} icon={<MessageCircle className="size-3" />} />
                <Stat label="FB converted" value={s.fbConverted} icon={<Briefcase className="size-3" />} />
              </div>
            </Card>
          );
        })}
        {profiles.length === 0 && <p className="text-sm text-muted-foreground">No teammates yet.</p>}
      </div>
    </div>
  );
}

function InfoRow({ icon, value }: { icon: any; value: string }) {
  return <div className="inline-flex items-center gap-2"><span className="text-muted-foreground/60">{icon}</span><span className="truncate">{value}</span></div>;
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon?: any }) {
  return (
    <div className="rounded-lg bg-background border border-border py-2">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">{icon}{label}</div>
    </div>
  );
}

function EditProfileDialog({ profile, children }: { profile: any; children: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    role_title: profile.role_title ?? "",
    timezone: profile.timezone ?? "",
    bio: profile.bio ?? "",
    joined_at: profile.joined_at ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        full_name: form.full_name || null,
        phone: form.phone || null,
        role_title: form.role_title || null,
        timezone: form.timezone || null,
        bio: form.bio || null,
        joined_at: form.joined_at || null,
      };
      const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles"] }); toast.success("Profile updated"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit your profile</DialogTitle>
          <DialogDescription>This info shows on your team card.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" className="col-span-2"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Role title"><Input placeholder="e.g. Co-founder" value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Timezone"><Input placeholder="GMT+6" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></Field>
          <Field label="Joined"><Input type="date" value={form.joined_at} onChange={(e) => setForm({ ...form, joined_at: e.target.value })} /></Field>
          <Field label="Bio" className="col-span-2"><Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
