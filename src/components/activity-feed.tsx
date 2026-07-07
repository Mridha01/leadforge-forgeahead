import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Plus, RefreshCw, Trash2, ArrowRight } from "lucide-react";

type Row = {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string;
  created_at: string;
};

const ACTION_META: Record<string, { icon: any; cls: string; label: string }> = {
  created:        { icon: Plus,      cls: "bg-primary/15 text-primary",       label: "Added" },
  updated:        { icon: RefreshCw, cls: "bg-muted text-foreground",         label: "Updated" },
  status_changed: { icon: ArrowRight,cls: "bg-warning/15 text-warning",       label: "Status" },
  deleted:        { icon: Trash2,    cls: "bg-destructive/15 text-destructive",label: "Deleted" },
};

export function ActivityFeed({ limit = 15 }: { limit?: number }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["activity-log", limit],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("id,actor_id,entity_type,entity_id,action,summary,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as Row[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["activity-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,email,avatar_url")).data ?? [],
  });
  const profileMap: Record<string, any> = {};
  for (const p of profiles as any[]) profileMap[p.id] = p;

  return (
    <Card className="p-5 bg-card border-border relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Activity className="size-4 text-primary" /> Live activity feed
          <span className="text-xs text-muted-foreground font-normal">· team-wide, real-time</span>
        </h3>
        <span className="flex items-center gap-1.5 text-[10px] text-success">
          <span className="size-1.5 rounded-full bg-success animate-pulse" /> LIVE
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet. As you add or update leads it will appear here.</p>
      ) : (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {rows.map((r) => {
            const meta = ACTION_META[r.action] ?? ACTION_META.updated;
            const Icon = meta.icon;
            const actor = r.actor_id ? profileMap[r.actor_id] : null;
            const actorName = actor?.full_name ?? actor?.email ?? "System";
            return (
              <li key={r.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/40 transition-colors">
                <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${meta.cls}`}>
                  <Icon className="size-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium">{actorName}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{meta.label}</Badge>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{r.entity_type}</Badge>
                  </div>
                  <p className="text-sm mt-0.5 truncate">{r.summary}</p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(r.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
