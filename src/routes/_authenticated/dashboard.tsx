import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users2, Send, MailOpen, Reply, CheckCircle2, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LeadForge" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data: leads } = await supabase.from("leads").select("status,niche_slug,country_code,created_at");
      const all = leads ?? [];
      const by = (s: string) => all.filter((l) => l.status === s).length;
      return {
        total: all.length,
        emailsSent: by("email_sent") + by("followup_1") + by("followup_2") + by("replied") + by("meeting") + by("proposal") + by("closed_won") + by("closed_lost"),
        replied: by("replied") + by("meeting") + by("proposal") + by("closed_won"),
        won: by("closed_won"),
        byNiche: groupCount(all, "niche_slug"),
        byCountry: groupCount(all, "country_code"),
      };
    },
  });

  const cards = [
    { label: "Total leads", value: stats?.total ?? 0, icon: Users2, accent: "text-primary" },
    { label: "Emails sent", value: stats?.emailsSent ?? 0, icon: Send, accent: "text-warning" },
    { label: "Opens (est.)", value: Math.round((stats?.emailsSent ?? 0) * 0.42), icon: MailOpen, accent: "text-foreground" },
    { label: "Replies", value: stats?.replied ?? 0, icon: Reply, accent: "text-success" },
    { label: "Deals won", value: stats?.won ?? 0, icon: CheckCircle2, accent: "text-success" },
    { label: "Reply rate", value: `${stats?.emailsSent ? Math.round(((stats?.replied ?? 0) / stats.emailsSent) * 100) : 0}%`, icon: TrendingUp, accent: "text-primary" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live snapshot of your outreach pipeline." />
      <div className="p-6 pt-4 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
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

        <div className="grid lg:grid-cols-2 gap-4">
          <DistributionCard title="Leads by niche" data={stats?.byNiche ?? {}} />
          <DistributionCard title="Leads by country" data={stats?.byCountry ?? {}} />
        </div>
      </div>
    </div>
  );
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
