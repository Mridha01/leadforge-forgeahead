import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { User2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — LeadForge" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at")).data ?? [],
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-team"],
    queryFn: async () => (await supabase.from("leads").select("created_by,status")).data ?? [],
  });

  const perUser = (id: string) => {
    const mine = leads.filter((l) => l.created_by === id);
    return {
      total: mine.length,
      won: mine.filter((l) => l.status === "closed_won").length,
      replied: mine.filter((l) => ["replied", "meeting", "proposal", "closed_won"].includes(l.status)).length,
    };
  };

  return (
    <div>
      <PageHeader title="Team" subtitle="Performance of every team member." />
      <div className="p-6 pt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {profiles.map((p) => {
          const s = perUser(p.id);
          return (
            <Card key={p.id} className="p-5 bg-card border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <User2 className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.full_name ?? p.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Leads" value={s.total} />
                <Stat label="Replied" value={s.replied} />
                <Stat label="Won" value={s.won} />
              </div>
            </Card>
          );
        })}
        {profiles.length === 0 && <p className="text-sm text-muted-foreground">No teammates yet.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background border border-border py-2">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
