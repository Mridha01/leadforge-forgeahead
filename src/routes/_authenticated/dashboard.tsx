import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

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

function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data: leads } = await supabase
        .from("leads")
        .select("status,niche_slug,country_code,created_at");
      const all = leads ?? [];
      const by = (s: string) => all.filter((l) => l.status === s).length;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const addedToday = all.filter((l) => new Date(l.created_at) >= today).length;
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const addedThisWeek = all.filter((l) => new Date(l.created_at) >= weekAgo).length;
      return {
        total: all.length,
        addedToday,
        addedThisWeek,
        emailsSent:
          by("email_sent") +
          by("followup_1") +
          by("followup_2") +
          by("replied") +
          by("meeting") +
          by("proposal") +
          by("closed_won") +
          by("closed_lost"),
        replied: by("replied") + by("meeting") + by("proposal") + by("closed_won"),
        won: by("closed_won"),
        byNiche: groupCount(all, "niche_slug"),
        byCountry: groupCount(all, "country_code"),
      };
    },
  });

  const { data: recentLeads } = useQuery({
    queryKey: ["dashboard-recent-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id,business_name,status,niche_slug,country_code,created_at,created_by,updated_at")
        .order("updated_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: responses } = useQuery({
    queryKey: ["dashboard-responses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id,business_name,status,niche_slug,country_code,updated_at,notes")
        .in("status", ["replied", "meeting", "proposal", "closed_won"])
        .order("updated_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: todo } = useQuery({
    queryKey: ["dashboard-todo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id,business_name,status,niche_slug,country_code,updated_at")
        .in("status", ["new", "audit_done", "email_sent", "followup_1", "followup_2"])
        .order("updated_at", { ascending: true })
        .limit(10);
      return data ?? [];
    },
  });

  const cards = [
    { label: "Total leads", value: stats?.total ?? 0, icon: Users2, accent: "text-primary" },
    { label: "Added today", value: stats?.addedToday ?? 0, icon: CalendarDays, accent: "text-primary" },
    { label: "Added 7d", value: stats?.addedThisWeek ?? 0, icon: TrendingUp, accent: "text-primary" },
    { label: "Emails sent", value: stats?.emailsSent ?? 0, icon: Send, accent: "text-warning" },
    { label: "Opens (est.)", value: Math.round((stats?.emailsSent ?? 0) * 0.42), icon: MailOpen, accent: "text-foreground" },
    { label: "Replies", value: stats?.replied ?? 0, icon: Reply, accent: "text-success" },
    { label: "Deals won", value: stats?.won ?? 0, icon: CheckCircle2, accent: "text-success" },
    {
      label: "Reply rate",
      value: `${stats?.emailsSent ? Math.round(((stats?.replied ?? 0) / stats.emailsSent) * 100) : 0}%`,
      icon: Activity,
      accent: "text-primary",
    },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your daily snapshot — pipeline, responses and what to work on next." />
      <div className="p-6 pt-4 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {cards.map((c) => (
            <Card key={c.label} className="p-4 bg-card border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</span>
                <c.icon className={`size-4 ${c.accent}`} />
              </div>
              <div className="text-2xl font-semibold tabular-nums">{c.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid xl:grid-cols-3 gap-4">
          <Card className="p-5 bg-card border-border xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Reply className="size-4 text-success" /> Client responses
              </h3>
              <Link to="/leads" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {(!responses || responses.length === 0) ? (
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
                      </div>
                      {l.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.notes}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {timeAgo(l.updated_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <ListChecks className="size-4 text-primary" /> Today's to-do
              </h3>
              <Link to="/leads" className="text-xs text-primary hover:underline">Open board</Link>
            </div>
            {(!todo || todo.length === 0) ? (
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
          {(!recentLeads || recentLeads.length === 0) ? (
            <p className="text-sm text-muted-foreground">No leads yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 font-medium">Business</th>
                    <th className="py-2 pr-4 font-medium">Niche</th>
                    <th className="py-2 pr-4 font-medium">Country</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((l) => (
                    <tr key={l.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 font-medium">{l.business_name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{l.niche_slug ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{l.country_code ?? "—"}</td>
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
          <DistributionCard title="Leads by niche" data={stats?.byNiche ?? {}} />
          <DistributionCard title="Leads by country" data={stats?.byCountry ?? {}} />
        </div>
      </div>
    </div>
  );
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

function DistributionCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <Card className="p-5 bg-card border-border">
      <h3 className="text-sm font-medium mb-4">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet. Add leads to see distribution.</p>
      ) : (
        <div className="space-y-2.5">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="text-xs w-28 truncate text-muted-foreground">{k}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <span className="text-xs tabular-nums w-8 text-right">{v}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
