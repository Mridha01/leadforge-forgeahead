import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Plus, Pencil, Trash2, CheckCircle2, Circle, Loader2, Flame, Clock, User, ListTodo, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({ meta: [{ title: "Daily Planner — LeadForge" }] }),
  component: PlannerPage,
});

type Task = {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_minutes: number | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "done" | "skipped";
  assigned_to: string | null;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = { id: string; full_name: string | null; email: string | null };

const PRIORITY_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/15 text-primary border-primary/25",
  high: "bg-destructive/15 text-destructive border-destructive/25",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success",
  skipped: "bg-destructive/10 text-destructive",
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10);
}
function dayLabel(iso: string) {
  const t = todayISO(), tm = tomorrowISO();
  if (iso === t) return "Today";
  if (iso === tm) return "Tomorrow";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
function formatTime(t: string | null) {
  if (!t) return "Anytime";
  const [h, m] = t.split(":");
  const d = new Date(); d.setHours(+h, +m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function PlannerPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [scope, setScope] = useState<"mine" | "team">("team");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>(tomorrowISO());

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const { data: tasks = [] } = useQuery({
    queryKey: ["planner-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("scheduled_date").order("scheduled_time", { nullsFirst: false });
      return (data ?? []) as Task[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["planner-profiles"],
    queryFn: async () => ((await supabase.from("profiles").select("id,full_name,email")).data ?? []) as Profile[],
  });

  // realtime
  useEffect(() => {
    const ch = supabase.channel("tasks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        qc.invalidateQueries({ queryKey: ["planner-tasks"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    for (const p of profiles) m[p.id] = p;
    return m;
  }, [profiles]);

  const scoped = useMemo(() => {
    if (scope === "mine" && userId) return tasks.filter((t) => t.assigned_to === userId || t.created_by === userId);
    return tasks;
  }, [tasks, scope, userId]);

  const grouped = useMemo(() => {
    const g: Record<string, Task[]> = {};
    for (const t of scoped) (g[t.scheduled_date] ??= []).push(t);
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [scoped]);

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Task> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("tasks").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({ ...payload, created_by: userId! } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planner-tasks"] });
      toast.success(editing ? "Task updated" : "Task added");
      setDialogOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save task"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["planner-tasks"] }); toast.success("Task deleted"); },
    onError: (e: any) => toast.error(e.message ?? "Could not delete"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Task["status"] }) => {
      const { error } = await supabase.from("tasks").update({
        status, completed_at: status === "done" ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planner-tasks"] }),
  });

  const stats = useMemo(() => {
    const t = todayISO(), tm = tomorrowISO();
    return {
      today: scoped.filter((x) => x.scheduled_date === t).length,
      tomorrow: scoped.filter((x) => x.scheduled_date === tm).length,
      pending: scoped.filter((x) => x.status === "pending" || x.status === "in_progress").length,
      done: scoped.filter((x) => x.status === "done").length,
    };
  }, [scoped]);

  function openNew(date?: string) {
    setEditing(null);
    setDefaultDate(date ?? tomorrowISO());
    setDialogOpen(true);
  }
  function openEdit(t: Task) {
    setEditing(t); setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Daily Planner"
        subtitle="Plan tomorrow tonight. Assign, schedule, and track together."
        action={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
              <Button size="sm" variant={scope === "team" ? "default" : "ghost"} className="h-8" onClick={() => setScope("team")}>Team</Button>
              <Button size="sm" variant={scope === "mine" ? "default" : "ghost"} className="h-8" onClick={() => setScope("mine")}>Mine</Button>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5" onClick={() => openNew()}>
                  <Plus className="size-4" /> New Task
                </Button>
              </DialogTrigger>
              <TaskDialog
                key={editing?.id ?? defaultDate}
                editing={editing}
                defaultDate={defaultDate}
                profiles={profiles}
                userId={userId}
                onSubmit={(payload) => upsert.mutate(payload)}
                submitting={upsert.isPending}
              />
            </Dialog>
          </div>
        }
      />

      <div className="p-6 pt-4 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Today" value={stats.today} icon={CalendarDays} tone="text-primary" />
          <StatCard label="Tomorrow" value={stats.tomorrow} icon={CalendarClock} tone="text-primary" />
          <StatCard label="Open" value={stats.pending} icon={ListTodo} tone="text-warning" />
          <StatCard label="Completed" value={stats.done} icon={CheckCircle2} tone="text-success" />
        </div>

        {/* Quick "Plan tomorrow" */}
        <Card className="p-5 bg-gradient-to-br from-primary/[0.08] to-transparent border-primary/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Plan for tomorrow</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Draft your task list tonight so you both hit the ground running in the morning.</p>
            </div>
            <Button size="sm" onClick={() => openNew(tomorrowISO())} className="gap-1.5">
              <Plus className="size-4" /> Add tomorrow's task
            </Button>
          </div>
        </Card>

        {grouped.length === 0 ? (
          <Card className="p-10 text-center bg-card border-border">
            <ListTodo className="size-8 mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-sm text-muted-foreground">No tasks yet. Start planning tomorrow.</p>
          </Card>
        ) : (
          <div className="space-y-5">
            {grouped.map(([date, list]) => (
              <DaySection
                key={date}
                date={date}
                tasks={list}
                profileMap={profileMap}
                userId={userId}
                onEdit={openEdit}
                onDelete={(id) => del.mutate(id)}
                onStatus={(id, s) => setStatus.mutate({ id, status: s })}
                onAdd={() => openNew(date)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <Icon className={cn("size-4", tone)} />
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function DaySection({
  date, tasks, profileMap, userId, onEdit, onDelete, onStatus, onAdd,
}: {
  date: string; tasks: Task[]; profileMap: Record<string, Profile>; userId: string | null;
  onEdit: (t: Task) => void; onDelete: (id: string) => void;
  onStatus: (id: string, s: Task["status"]) => void; onAdd: () => void;
}) {
  const isPast = date < todayISO();
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "size-9 rounded-lg flex flex-col items-center justify-center border",
            isPast ? "bg-muted/40 border-border text-muted-foreground" : "bg-primary/10 border-primary/25 text-primary"
          )}>
            <span className="text-[9px] uppercase leading-none">{new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short" })}</span>
            <span className="text-sm font-semibold leading-tight">{new Date(date + "T00:00:00").getDate()}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold">{dayLabel(date)}</h3>
            <p className="text-[11px] text-muted-foreground">{tasks.length} task{tasks.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={onAdd}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskRow
            key={t.id} task={t} profileMap={profileMap} userId={userId}
            onEdit={onEdit} onDelete={onDelete} onStatus={onStatus}
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  task, profileMap, userId, onEdit, onDelete, onStatus,
}: {
  task: Task; profileMap: Record<string, Profile>; userId: string | null;
  onEdit: (t: Task) => void; onDelete: (id: string) => void; onStatus: (id: string, s: Task["status"]) => void;
}) {
  const canEdit = userId && (task.created_by === userId || task.assigned_to === userId);
  const done = task.status === "done";
  const assignee = task.assigned_to ? profileMap[task.assigned_to] : null;
  const creator = profileMap[task.created_by];

  return (
    <Card className={cn(
      "p-3.5 border-border bg-card transition-colors hover:border-primary/30",
      done && "opacity-70"
    )}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onStatus(task.id, done ? "pending" : "done")}
          disabled={!canEdit}
          className={cn(
            "mt-0.5 shrink-0 transition-colors",
            done ? "text-success" : "text-muted-foreground hover:text-primary",
            !canEdit && "cursor-not-allowed opacity-60"
          )}
          aria-label={done ? "Mark as pending" : "Mark as done"}
        >
          {done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h4 className={cn("text-sm font-medium truncate", done && "line-through text-muted-foreground")}>{task.title}</h4>
              <Badge variant="outline" className={cn("text-[10px] gap-1", PRIORITY_TONE[task.priority])}>
                <Flame className="size-2.5" /> {task.priority}
              </Badge>
              {task.status !== "pending" && task.status !== "done" && (
                <Badge variant="secondary" className={cn("text-[10px]", STATUS_TONE[task.status])}>
                  {task.status === "in_progress" ? "In progress" : "Skipped"}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {canEdit && task.status !== "done" && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                  onClick={() => onStatus(task.id, task.status === "in_progress" ? "pending" : "in_progress")}>
                  {task.status === "in_progress" ? "Pause" : "Start"}
                </Button>
              )}
              {canEdit && (
                <Button size="icon" variant="ghost" className="size-7" onClick={() => onEdit(task)}>
                  <Pencil className="size-3.5" />
                </Button>
              )}
              {canEdit && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{task.title}" will be removed for the whole team. This can't be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(task.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {task.description && (
            <p className={cn("text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap", done && "line-through")}>
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {formatTime(task.scheduled_time)}</span>
            {task.duration_minutes ? <span>· {task.duration_minutes}m</span> : null}
            <span className="inline-flex items-center gap-1">
              <User className="size-3" />
              {assignee ? (assignee.full_name ?? assignee.email) : "Unassigned"}
            </span>
            <span className="opacity-70">· by {creator?.full_name ?? creator?.email ?? "—"}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function TaskDialog({
  editing, defaultDate, profiles, userId, onSubmit, submitting,
}: {
  editing: Task | null; defaultDate: string; profiles: Profile[]; userId: string | null;
  onSubmit: (payload: Partial<Task> & { id?: string }) => void; submitting: boolean;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [date, setDate] = useState(editing?.scheduled_date ?? defaultDate);
  const [time, setTime] = useState(editing?.scheduled_time?.slice(0, 5) ?? "");
  const [duration, setDuration] = useState<string>(editing?.duration_minutes?.toString() ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(editing?.priority ?? "medium");
  const [assignedTo, setAssignedTo] = useState<string>(editing?.assigned_to ?? userId ?? "");

  function submit() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    onSubmit({
      id: editing?.id,
      title: title.trim(),
      description: description.trim() || null,
      scheduled_date: date,
      scheduled_time: time || null,
      duration_minutes: duration ? Number(duration) : null,
      priority,
      assigned_to: assignedTo || null,
    });
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit task" : "Add task"}</DialogTitle>
        <DialogDescription>
          Write what you'll do, when, and who owns it. Details help teammates avoid overlap.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FB outreach — Dhaka salons batch" autoFocus />
        </div>

        <div>
          <Label className="text-xs">Details</Label>
          <Textarea
            value={description ?? ""} onChange={(e) => setDescription(e.target.value)}
            rows={4} placeholder="What exactly needs to happen? Steps, links, target count, etc."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="flex gap-1 mt-1">
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setDate(todayISO())}>Today</Button>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setDate(tomorrowISO())}>Tomorrow</Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Time</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Duration (min)</Label>
            <Input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" />
          </div>
          <div>
            <Label className="text-xs">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Assign to</Label>
            <Select value={assignedTo || "unassigned"} onValueChange={(v) => setAssignedTo(v === "unassigned" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={submitting} className="gap-1.5">
          {submitting && <Loader2 className="size-3.5 animate-spin" />}
          {editing ? "Save changes" : "Add task"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
