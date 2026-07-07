import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users2,
  Send,
  MailOpen,
  Reply,
  CheckCircle2,
  TrendingUp,
  Clock,
  CalendarDays,
  ListChecks,
  Activity,
  Trophy,
  UserRound,
  UsersRound,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ActivityFeed } from "@/components/activity-feed";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LeadForge" }] }),
  component: DashboardPage,
});

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  audit_done: "Audit done",
  email_sent: "Email sent",
  followup_1: "Follow-up 1",
  followup_2: "Follow-up 2",
  replied: "Replied",
  meeting: "Meeting",
  proposal: "Proposal",
  closed_won: "Won",
  closed_lost: "Lost",
};

const STATUS_TONE: Record<string, string> = {
  new: "bg-muted text-foreground",
  audit_done: "bg-primary/15 text-primary",
  email_sent: "bg-warning/15 text-warning",
  followup_1: "bg-warning/15 text-warning",
  followup_2: "bg-warning/20 text-warning",
  replied: "bg-success/15 text-success",
  meeting: "bg-success/20 text-success",
  proposal: "bg-primary/20 text-primary",
  closed_won: "bg-success/25 text-success",
  closed_lost: "bg-destructive/15 text-destructive",
};

type Lead = {
  id: string;
  business_name: string;
  status: string;
  niche_slug: string | null;
  country_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  assigned_to: string | null;
};

function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<"mine" | "team">("mine");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: allLeads = [] } = useQuery({
    queryKey: ["dashboard-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id,business_name,status,niche_slug,country_code,notes,created_at,updated_at,created_by,assigned_to")
        .order("updated_at", { ascending: false });
      return (data ?? []) as Lead[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["dashboard-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,email,avatar_url")).data ?? [],
  });

  const profileMap = useMemo(() => {
    const m: Record<string, { full_name: string | null; email: string | null; avatar_url: string | null }> = {};
    for (const p of profiles) m[p.id] = p as any;
    return m;
  }, [profiles]);

  const mine = useMemo(
    () => (userId ? allLeads.filter((l) => l.created_by === userId || l.assigned_to === userId) : []),
    [allLeads, userId],
  );

  const scoped = view === "mine" ? mine : allLeads;
  const stats = useMemo(() => computeStats(scoped), [scoped]);

  const responses = useMemo(
    () =>
      scoped
        .filter((l) => ["replied", "meeting", "proposal", "closed_won"].includes(l.status))
        .slice(0, 6),
    [scoped],
  );

  const todo = useMemo(
    () =>
      scoped
        .filter((l) => ["new", "audit_done", "email_sent", "followup_1", "followup_2"].includes(l.status))
        .slice()
        .sort((a, b) => +new Date(a.updated_at) - +new Date(b.updated_at))
        .slice(0, 10),
    [scoped],
  );

  const recent = scoped.slice(0, 8);

  // Leaderboard — always team-wide
  const leaderboard = useMemo(() => {
    const byUser: Record<string, { added: number; replied: number; won: number; emails: number }> = {};
    for (const l of allLeads) {
      const uid = l.created_by;
      if (!byUser[uid]) byUser[uid] = { added: 0, replied: 0, won: 0, emails: 0 };
      byUser[uid].added++;
      if (["email_sent", "followup_1", "followup_2", "replied", "meeting", "proposal", "closed_won", "closed_lost"].includes(l.status))
        byUser[uid].emails++;
      if (["replied", "meeting", "proposal", "closed_won"].includes(l.status)) byUser[uid].replied++;
      if (l.status === "closed_won") byUser[uid].won++;
    }
    return Object.entries(byUser)
      .map(([uid, s]) => ({
        uid,
        name: profileMap[uid]?.full_name ?? profileMap[uid]?.email ?? "Unknown",
        ...s,
        replyRate: s.emails ? Math.round((s.replied / s.emails) * 100) : 0,
      }))
      .sort((a, b) => b.won - a.won || b.replied - a.replied || b.added - a.added);
  }, [allLeads, profileMap]);

  const cards = [
    { label: "Total leads", value: stats.total, icon: Users2, accent: "from-primary/20 to-primary/0", iconClass: "text-primary" },
    { label: "Added today", value: stats.addedToday, icon: CalendarDays, accent: "from-primary/20 to-primary/0", iconClass: "text-primary" },
    { label: "Added 7d", value: stats.addedThisWeek, icon: TrendingUp, accent: "from-primary/20 to-primary/0", iconClass: "text-primary" },
    { label: "Emails sent", value: stats.emailsSent, icon: Send, accent: "from-warning/20 to-warning/0", iconClass: "text-warning" },
    { label: "Opens (est.)", value: Math.round(stats.emailsSent * 0.42), icon: MailOpen, accent: "from-muted/40 to-transparent", iconClass: "text-foreground" },
    { label: "Replies", value: stats.replied, icon: Reply, accent: "from-success/20 to-success/0", iconClass: "text-success" },
    { label: "Deals won", value: stats.won, icon: CheckCircle2, accent: "from-success/25 to-success/0", iconClass: "text-success" },
    {
      label: "Reply rate",
      value: `${stats.emailsSent ? Math.round((stats.replied / stats.emailsSent) * 100) : 0}%`,
      icon: Activity,
      accent: "from-primary/20 to-primary/0",
      iconClass: "text-primary",
    },
  ];

  const me = userId ? profileMap[userId] : null;
  const myName = me?.full_name ?? me?.email ?? "You";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={view === "mine" ? `Your personal pipeline, ${myName}.` : "Combined team performance and leaderboard."}
        action={
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <Button
              size="sm"
              variant={view === "mine" ? "default" : "ghost"}
              className="h-8 gap-1.5"
              onClick={() => setView("mine")}
            >
              <UserRound className="size-3.5" /> Mine
            </Button>
            <Button
              size="sm"
              variant={view === "team" ? "default" : "ghost"}
              className="h-8 gap-1.5"
              onClick={() => setView("team")}
            >
              <UsersRound className="size-3.5" /> Team
            </Button>
          </div>
        }
      />
      <div className="p-6 pt-4 space-y-6">
        {/* Stat grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {cards.map((c) => (
            <Card
              key={c.label}
              className={`relative overflow-hidden p-4 bg-card border-border`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${c.accent} pointer-events-none`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{c.label}</span>
                  <c.icon className={`size-4 ${c.iconClass}`} />
                </div>
                <div className="text-2xl font-semibold tabular-nums">{c.value}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Team leaderboard (combined success) */}
        <Card className="p-5 bg-card border-border relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Trophy className="size-4 text-warning" /> Team leaderboard
              <span className="text-xs text-muted-foreground font-normal">· combined results</span>
            </h3>
            <Link to="/team" className="text-xs text-primary hover:underline">Team page</Link>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team activity yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {leaderboard.map((m, idx) => (
                <div
                  key={m.uid}
                  className={`relative rounded-xl border p-4 flex items-center gap-4 transition-colors ${
                    m.uid === userId
                      ? "border-primary/40 bg-primary/[0.04]"
                      : "border-border bg-background/40"
                  }`}
                >
                  <div className="size-11 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/20 flex items-center justify-center text-sm font-semibold">
                    {initials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{m.name}</span>
                      {idx === 0 && <Badge className="bg-warning/15 text-warning border-warning/20 text-[10px]" variant="outline">#1</Badge>}
                      {m.uid === userId && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-center">
                      <Stat label="Leads" value={m.added} />
                      <Stat label="Emails" value={m.emails} />
                      <Stat label="Replies" value={m.replied} accent="text-success" />
                      <Stat label="Won" value={m.won} accent="text-success" />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Reply</div>
                    <div className="text-lg font-semibold tabular-nums">{m.replyRate}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="grid xl:grid-cols-3 gap-4">
          <div className="xl:col-span-1"><ActivityFeed /></div>
          <div className="xl:col-span-2 grid gap-4">
        <div className="grid xl:grid-cols-3 gap-4">
          <Card className="p-5 bg-card border-border xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Reply className="size-4 text-success" /> Client responses
                <span className="text-xs text-muted-foreground font-normal">
                  · {view === "mine" ? "your" : "team"} replies
                </span>
              </h3>
              <Link to="/leads" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {responses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No replies yet. Keep sending outreach.</p>
            ) : (
              <ul className="divide-y divide-border">
                {responses.map((l) => (
                  <li key={l.id} className="py-2.5 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{l.business_name}</span>
                        <Badge className={`text-[10px] ${STATUS_TONE[l.status] ?? ""}`} variant="secondary">
                          {STATUS_LABEL[l.status]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {l.niche_slug ?? "—"} · {l.country_code ?? "—"}
                        </span>
                        {view === "team" && (
                          <span className="text-[10px] text-muted-foreground">by {profileMap[l.created_by]?.full_name ?? "—"}</span>
                        )}
                      </div>
                      {l.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.notes}</p>}
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo(l.updated_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <ListChecks className="size-4 text-primary" /> {view === "mine" ? "Your" : "Team"} to-do
              </h3>
              <Link to="/leads" className="text-xs text-primary hover:underline">Open board</Link>
            </div>
            {todo.length === 0 ? (
              <p className="text-sm text-muted-foreground">All caught up — add new leads to start outreach.</p>
            ) : (
              <ul className="space-y-2">
                {todo.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-sm">
                    <span className="size-1.5 rounded-full bg-primary shrink-0" />
                    <span className="flex-1 truncate">{l.business_name}</span>
                    <Badge variant="secondary" className={`text-[10px] ${STATUS_TONE[l.status] ?? ""}`}>
                      {nextAction(l.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="p-5 bg-card border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" /> Recent updates
            </h3>
            <Link to="/leads" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">Business</th>
                    <th className="py-2 pr-4 font-medium">Niche</th>
                    <th className="py-2 pr-4 font-medium">Country</th>
                    <th className="py-2 pr-4 font-medium">Owner</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((l) => (
                    <tr key={l.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 font-medium">{l.business_name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{l.niche_slug ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{l.country_code ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">
                        {profileMap[l.created_by]?.full_name ?? profileMap[l.created_by]?.email ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary" className={`text-[10px] ${STATUS_TONE[l.status] ?? ""}`}>
                          {STATUS_LABEL[l.status]}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{timeAgo(l.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="grid lg:grid-cols-2 gap-4">
          <DistributionCard title="Leads by niche" data={stats.byNiche} icon={<Target className="size-4 text-primary" />} />
          <DistributionCard title="Leads by country" data={stats.byCountry} icon={<Target className="size-4 text-primary" />} />
        </div>
      </div>
    </div>
  );
}

function computeStats(leads: Lead[]) {
  const by = (s: string) => leads.filter((l) => l.status === s).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  return {
    total: leads.length,
    addedToday: leads.filter((l) => new Date(l.created_at) >= today).length,
    addedThisWeek: leads.filter((l) => new Date(l.created_at) >= weekAgo).length,
    emailsSent:
      by("email_sent") + by("followup_1") + by("followup_2") + by("replied") + by("meeting") + by("proposal") + by("closed_won") + by("closed_lost"),
    replied: by("replied") + by("meeting") + by("proposal") + by("closed_won"),
    won: by("closed_won"),
    byNiche: groupCount(leads, "niche_slug"),
    byCountry: groupCount(leads, "country_code"),
  };
}

function Stat({ label, value, accent = "" }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <div className={`text-base font-semibold tabular-nums ${accent}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function nextAction(status: string) {
  switch (status) {
    case "new": return "Run audit";
    case "audit_done": return "Send email";
    case "email_sent": return "Follow up";
    case "followup_1": return "Follow up #2";
    case "followup_2": return "Final nudge";
    default: return STATUS_LABEL[status] ?? status;
  }
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function groupCount<T extends Record<string, any>>(items: T[], key: keyof T) {
  const out: Record<string, number> = {};
  for (const i of items) {
    const k = String(i[key] ?? "unknown");
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function DistributionCard({ title, data, icon }: { title: string; data: Record<string, number>; icon?: React.ReactNode }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <Card className="p-5 bg-card border-border">
      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">{icon}{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet. Add leads to see distribution.</p>
      ) : (
        <div className="space-y-2.5">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="text-xs w-28 truncate text-muted-foreground">{k}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full" style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <span className="text-xs tabular-nums w-8 text-right">{v}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
