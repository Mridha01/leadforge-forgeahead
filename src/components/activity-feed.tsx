import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Plus, RefreshCw, Trash2, ArrowRight, CheckCircle2, ListTodo,
  Users, MessageCircle, DollarSign,
} from "lucide-react";

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
  created:        { icon: Plus,        cls: "bg-primary/15 text-primary",         label: "Added" },
  updated:        { icon: RefreshCw,   cls: "bg-muted text-foreground",           label: "Updated" },
  status_changed: { icon: ArrowRight,  cls: "bg-warning/15 text-warning",         label: "Status" },
  deleted:        { icon: Trash2,      cls: "bg-destructive/15 text-destructive", label: "Deleted" },
};

const ENTITY_META: Record<string, { icon: any; label: string; cls: string }> = {
  tasks:          { icon: ListTodo,     label: "Planner",   cls: "text-primary" },
  leads:          { icon: Users,        label: "Lead",      cls: "text-success" },
  fb_outreach:    { icon: MessageCircle,label: "FB DM",     cls: "text-warning" },
  finance_entries:{ icon: DollarSign,   label: "Finance",   cls: "text-foreground" },
};

export function ActivityFeed({ limit = 5 }: { limit?: number }) {
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
    refetchInterval: 30_000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["activity-profiles"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id,full_name,email,avatar_url")).data ?? [],
  });
  const profileMap: Record<string, any> = {};
  for (const p of profiles as any[]) profileMap[p.id] = p;

  return (
    <Card className="p-5 bg-card border-border relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Activity className="size-4 text-primary" /> Live activity feed
          <span className="text-xs text-muted-foreground font-normal">· latest {limit} · team-wide</span>
        </h3>
        <span className="flex items-center gap-1.5 text-[10px] text-success">
          <span className="size-1.5 rounded-full bg-success animate-pulse" /> LIVE
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet. As you add or update leads it will appear here.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const meta = ACTION_META[r.action] ?? ACTION_META.updated;
            const ent = ENTITY_META[r.entity_type] ?? { icon: Activity, label: r.entity_type, cls: "text-muted-foreground" };
            const Icon = meta.icon;
            const EntIcon = ent.icon;
            const actor = r.actor_id ? profileMap[r.actor_id] : null;
            const actorName = actor?.full_name ?? actor?.email ?? "System";
            const initials = (actorName || "?").slice(0, 2).toUpperCase();
            return (
              <li key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-background/40 hover:bg-accent/40 transition-colors">
                <div className="relative shrink-0">
                  <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold">
                    {initials}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 size-5 rounded-full flex items-center justify-center ring-2 ring-card ${meta.cls}`}>
                    <Icon className="size-3" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{actorName}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{meta.label}</Badge>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-1">
                      <EntIcon className={`size-2.5 ${ent.cls}`} /> {ent.label}
                    </Badge>
                  </div>
                  <p className="text-sm mt-1 leading-snug break-words">{r.summary}</p>
                  <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-2">
                    <span title={new Date(r.created_at).toLocaleString()}>{timeAgo(r.created_at)} ago</span>
                    <span>·</span>
                    <span>{new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                </div>
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
