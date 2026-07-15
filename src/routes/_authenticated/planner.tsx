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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import {
  CalendarClock, Plus, Pencil, Trash2, CheckCircle2, Circle, Loader2, Flame, Clock, User,
  ListTodo, ChevronDown, ChevronUp, GripVertical, AlertTriangle, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({ meta: [{ title: "Daily Planner — LeadForge" }] }),
  component: PlannerPage,
});

type ChecklistItem = { id: string; text: string; done: boolean };
type Task = {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  deadline: string | null;
  checklist: ChecklistItem[];
  related_lead_id: string | null;
  niche: string | null;
  country: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "done" | "skipped";
  assigned_to: string | null;
  created_by: string;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type Profile = { id: string; full_name: string | null; email: string | null };
type Lead = { id: string; business_name: string };

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
function tomorrowISO() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function dayLabel(iso: string) {
  const t = todayISO(), tm = tomorrowISO();
  if (iso === t) return "Today";
  if (iso === tm) return "Tomorrow";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
function formatTime(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":");
  const d = new Date(); d.setHours(+h, +m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function diffMinutes(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? mins : 0;
}
function formatDuration(m: number | null) {
  if (!m) return "";
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h}h${r ? ` ${r}m` : ""}` : `${r}m`;
}
function nowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function timeToMinutes(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
type TimeStatus =
  | { kind: "upcoming"; startsInMin: number }
  | { kind: "now"; endsInMin: number | null; startedAgoMin: number }
  | { kind: "overdue"; overByMin: number }
  | { kind: "past" }
  | null;
function computeTimeStatus(task: Task, isToday: boolean): TimeStatus {
  if (!isToday || !task.scheduled_time || task.status === "done" || task.status === "skipped") return null;
  const start = timeToMinutes(task.scheduled_time)!;
  const end = timeToMinutes(task.end_time);
  const now = nowMinutes();
  if (now < start) return { kind: "upcoming", startsInMin: start - now };
  if (end !== null && now > end) return { kind: "overdue", overByMin: now - end };
  if (end === null && now - start > 24 * 60) return { kind: "past" };
  return { kind: "now", startedAgoMin: now - start, endsInMin: end !== null ? end - now : null };
}
function humanMin(m: number) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function PlannerPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [scope, setScope] = useState<"mine" | "team">("team");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>(tomorrowISO());
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [showCompleted, setShowCompleted] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 30_000); return () => clearInterval(id); }, []);

  const { data: tasks = [] } = useQuery({
    queryKey: ["planner-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*")
        .order("scheduled_date").order("sort_order").order("scheduled_time", { nullsFirst: false });
      return (data ?? []).map((t: any) => ({ ...t, checklist: Array.isArray(t.checklist) ? t.checklist : [] })) as Task[];
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["planner-profiles"],
    queryFn: async () => ((await supabase.from("profiles").select("id,full_name,email")).data ?? []) as Profile[],
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["planner-leads"],
    queryFn: async () => ((await supabase.from("leads").select("id,business_name").order("business_name")).data ?? []) as Lead[],
  });

  useEffect(() => {
    const ch = supabase.channel("tasks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        qc.invalidateQueries({ queryKey: ["planner-tasks"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {}; for (const p of profiles) m[p.id] = p; return m;
  }, [profiles]);
  const leadMap = useMemo(() => {
    const m: Record<string, Lead> = {}; for (const l of leads) m[l.id] = l; return m;
  }, [leads]);

  const scoped = useMemo(() => {
    if (scope === "mine" && userId) return tasks.filter((t) => t.assigned_to === userId || t.created_by === userId);
    return tasks;
  }, [tasks, scope, userId]);

  const today = todayISO();
  const dayTasks = useMemo(() => scoped.filter((t) => t.scheduled_date === selectedDate), [scoped, selectedDate]);
  const openDayTasks = useMemo(() => {
    return dayTasks
      .filter((t) => t.status !== "done")
      .slice()
      .sort((a, b) => {
        const at = timeToMinutes(a.scheduled_time);
        const bt = timeToMinutes(b.scheduled_time);
        if (at === null && bt === null) return a.sort_order - b.sort_order;
        if (at === null) return 1;
        if (bt === null) return -1;
        if (at !== bt) return at - bt;
        return a.sort_order - b.sort_order;
      });
  }, [dayTasks]);
  const doneDayTasks = useMemo(() => dayTasks.filter((t) => t.status === "done"), [dayTasks]);
  const overdue = useMemo(
    () => scoped.filter((t) => t.scheduled_date < today && t.status !== "done" && t.status !== "skipped"),
    [scoped, today]
  );

  // stats for month strip: task count per date
  const tasksByDate = useMemo(() => {
    const m: Record<string, { total: number; done: number }> = {};
    for (const t of scoped) {
      const k = t.scheduled_date;
      (m[k] ??= { total: 0, done: 0 }).total++;
      if (t.status === "done") m[k].done++;
    }
    return m;
  }, [scoped]);

  const stats = useMemo(() => {
    const t = todayISO(), tm = tomorrowISO();
    return {
      today: scoped.filter((x) => x.scheduled_date === t).length,
      tomorrow: scoped.filter((x) => x.scheduled_date === tm).length,
      pending: scoped.filter((x) => x.status === "pending" || x.status === "in_progress").length,
      done: scoped.filter((x) => x.status === "done").length,
    };
  }, [scoped]);

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Task> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("tasks").update(rest as any).eq("id", id);
        if (error) throw error;
      } else {
        const maxSort = Math.max(0, ...tasks.filter((t) => t.scheduled_date === payload.scheduled_date).map((t) => t.sort_order));
        const { error } = await supabase.from("tasks").insert({ ...payload, sort_order: maxSort + 1, created_by: userId! } as any);
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
    mutationFn: async (id: string) => { const { error } = await supabase.from("tasks").delete().eq("id", id); if (error) throw error; },
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
  const reorder = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      await Promise.all(updates.map((u) => supabase.from("tasks").update({ sort_order: u.sort_order }).eq("id", u.id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planner-tasks"] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = openDayTasks.map((t) => t.id);
    const oldI = ids.indexOf(String(active.id));
    const newI = ids.indexOf(String(over.id));
    if (oldI < 0 || newI < 0) return;
    const next = arrayMove(openDayTasks, oldI, newI);
    reorder.mutate(next.map((t, i) => ({ id: t.id, sort_order: i + 1 })));
  }

  function openNew(date?: string) { setEditing(null); setDefaultDate(date ?? selectedDate); setDialogOpen(true); }
  function openEdit(t: Task) { setEditing(t); setDialogOpen(true); }

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
            <LoadFromListButton
              targetDate={selectedDate}
              userId={userId}
              onLoaded={() => qc.invalidateQueries({ queryKey: ["planner-tasks"] })}
              existingSortMax={Math.max(0, ...tasks.filter((t) => t.scheduled_date === selectedDate).map((t) => t.sort_order))}
            />
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
                leads={leads}
                userId={userId}
                onSubmit={(payload) => upsert.mutate(payload)}
                submitting={upsert.isPending}
              />
            </Dialog>
          </div>
        }
      />

      <div className="p-6 pt-4 space-y-5">
        {/* stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Today" value={stats.today} icon={CalendarClock} tone="text-primary" onClick={() => setSelectedDate(todayISO())} />
          <StatCard label="Tomorrow" value={stats.tomorrow} icon={CalendarClock} tone="text-primary" onClick={() => setSelectedDate(tomorrowISO())} />
          <StatCard label="Open" value={stats.pending} icon={ListTodo} tone="text-warning" />
          <StatCard label="Completed" value={stats.done} icon={CheckCircle2} tone="text-success" />
        </div>

        {/* Month strip */}
        <MonthStrip
          cursor={monthCursor}
          setCursor={setMonthCursor}
          selected={selectedDate}
          setSelected={setSelectedDate}
          tasksByDate={tasksByDate}
        />

        {/* Overdue reminders */}
        {overdue.length > 0 && (
          <OverdueReminder
            tasks={overdue}
            profileMap={profileMap}
            onOpen={(t) => setSelectedDate(t.scheduled_date)}
            onReschedule={(t, date) => upsert.mutate({ id: t.id, scheduled_date: date })}
          />
        )}

        {/* Selected day header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{dayLabel(selectedDate)}</h2>
            <p className="text-xs text-muted-foreground">
              {openDayTasks.length} open · {doneDayTasks.length} done
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openNew(selectedDate)}>
            <Plus className="size-4" /> Add to {dayLabel(selectedDate).toLowerCase()}
          </Button>
        </div>

        {/* Open tasks: sortable */}
        {openDayTasks.length === 0 ? (
          <Card className="p-8 text-center bg-card border-dashed border-border">
            <ListTodo className="size-7 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm text-muted-foreground">
              {doneDayTasks.length > 0 ? "All tasks completed for this day 🎉" : "No tasks planned for this day yet."}
            </p>
          </Card>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={openDayTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {openDayTasks.map((t) => (
                  <SortableTaskRow
                    key={t.id} task={t} profileMap={profileMap} leadMap={leadMap} userId={userId}
                    isToday={selectedDate === today}
                    onEdit={openEdit} onDelete={(id) => del.mutate(id)}
                    onStatus={(id, s) => setStatus.mutate({ id, status: s })}
                    onChecklistToggle={(taskId, itemId) => {
                      const task = tasks.find((x) => x.id === taskId); if (!task) return;
                      const next = task.checklist.map((c) => c.id === itemId ? { ...c, done: !c.done } : c);
                      upsert.mutate({ id: taskId, checklist: next as any });
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Collapsed completed */}
        {doneDayTasks.length > 0 && (
          <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                {showCompleted ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                Completed ({doneDayTasks.length})
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {doneDayTasks.map((t) => (
                <TaskRow
                  key={t.id} task={t} profileMap={profileMap} leadMap={leadMap} userId={userId}
                  onEdit={openEdit} onDelete={(id) => del.mutate(id)}
                  onStatus={(id, s) => setStatus.mutate({ id, status: s })}
                  onChecklistToggle={() => {}}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone, onClick }: { label: string; value: number; icon: any; tone: string; onClick?: () => void }) {
  return (
    <Card onClick={onClick} className={cn("p-4 bg-card border-border", onClick && "cursor-pointer hover:border-primary/40 transition-colors")}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <Icon className={cn("size-4", tone)} />
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function MonthStrip({
  cursor, setCursor, selected, setSelected, tasksByDate,
}: {
  cursor: Date; setCursor: (d: Date) => void; selected: string; setSelected: (s: string) => void;
  tasksByDate: Record<string, { total: number; done: number }>;
}) {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return d.toISOString().slice(0, 10);
  });
  const label = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = todayISO();

  return (
    <Card className="p-3 bg-card border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-7"
            onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">{label}</span>
          <Button size="icon" variant="ghost" className="size-7"
            onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs"
          onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelected(today); }}>
          Jump to today
        </Button>
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-1.5 pb-2">
          {days.map((iso) => {
            const d = new Date(iso + "T00:00:00");
            const isSel = iso === selected;
            const isToday = iso === today;
            const isPast = iso < today;
            const info = tasksByDate[iso];
            return (
              <button
                key={iso}
                onClick={() => setSelected(iso)}
                className={cn(
                  "shrink-0 w-12 rounded-lg border p-1.5 flex flex-col items-center gap-0.5 transition-all",
                  isSel ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card border-border hover:border-primary/40",
                  !isSel && isToday && "border-primary/60 bg-primary/5",
                  !isSel && isPast && "opacity-60"
                )}
              >
                <span className={cn("text-[9px] uppercase leading-none", isSel ? "opacity-80" : "text-muted-foreground")}>
                  {d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}
                </span>
                <span className="text-sm font-semibold leading-tight">{d.getDate()}</span>
                {info ? (
                  <span className={cn(
                    "text-[9px] leading-none font-medium",
                    isSel ? "opacity-90" : info.done === info.total ? "text-success" : "text-warning"
                  )}>
                    {info.done}/{info.total}
                  </span>
                ) : <span className="text-[9px] leading-none opacity-40">·</span>}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Card>
  );
}

function OverdueReminder({
  tasks, profileMap, onOpen, onReschedule,
}: {
  tasks: Task[]; profileMap: Record<string, Profile>;
  onOpen: (t: Task) => void; onReschedule: (t: Task, date: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="p-3 border-warning/30 bg-warning/[0.05]">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              <span className="text-sm font-semibold">{tasks.length} overdue task{tasks.length === 1 ? "" : "s"} from earlier days</span>
            </div>
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-1.5">
          {tasks.slice(0, 8).map((t) => {
            const owner = t.assigned_to ? profileMap[t.assigned_to] : null;
            return (
              <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-background/50 border border-border/60">
                <button onClick={() => onOpen(t)} className="min-w-0 text-left flex-1">
                  <div className="text-xs font-medium truncate">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {dayLabel(t.scheduled_date)} · {owner?.full_name ?? owner?.email ?? "Unassigned"}
                  </div>
                </button>
                <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2"
                  onClick={() => onReschedule(t, todayISO())}>Move to today</Button>
                <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2"
                  onClick={() => onReschedule(t, tomorrowISO())}>Tomorrow</Button>
              </div>
            );
          })}
          {tasks.length > 8 && <p className="text-[10px] text-muted-foreground pl-2">+ {tasks.length - 8} more</p>}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function SortableTaskRow(props: React.ComponentProps<typeof TaskRow>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow {...props} dragHandle={<button {...attributes} {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none"
        aria-label="Drag to reorder"><GripVertical className="size-4" /></button>} />
    </div>
  );
}

function TaskRow({
  task, profileMap, leadMap, userId, isToday = false, onEdit, onDelete, onStatus, onChecklistToggle, dragHandle,
}: {
  task: Task; profileMap: Record<string, Profile>; leadMap: Record<string, Lead>; userId: string | null;
  isToday?: boolean;
  onEdit: (t: Task) => void; onDelete: (id: string) => void;
  onStatus: (id: string, s: Task["status"]) => void;
  onChecklistToggle: (taskId: string, itemId: string) => void;
  dragHandle?: React.ReactNode;
}) {
  const canEdit = userId && (task.created_by === userId || task.assigned_to === userId);
  const done = task.status === "done";
  const assignee = task.assigned_to ? profileMap[task.assigned_to] : null;
  const creator = profileMap[task.created_by];
  const lead = task.related_lead_id ? leadMap[task.related_lead_id] : null;
  const [expanded, setExpanded] = useState(false);
  const hasExtras = !!task.description || task.checklist.length > 0 || lead || task.niche || task.country || task.deadline;
  const timeLabel = task.scheduled_time
    ? task.end_time ? `${formatTime(task.scheduled_time)} – ${formatTime(task.end_time)}` : formatTime(task.scheduled_time)
    : "Anytime";
  const checkDone = task.checklist.filter((c) => c.done).length;
  const ts = computeTimeStatus(task, isToday);
  const isNow = ts?.kind === "now";
  const isOverdueTime = ts?.kind === "overdue";
  const isSoon = ts?.kind === "upcoming" && ts.startsInMin <= 30;

  return (
    <Card className={cn(
      "p-3 border-border bg-card transition-colors hover:border-primary/30 relative overflow-hidden",
      done && "opacity-70",
      isNow && "border-primary/60 bg-primary/[0.04] shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]",
      isOverdueTime && "border-destructive/50 bg-destructive/[0.04]",
      isSoon && "border-warning/50",
    )}>
      {isNow && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
      {isOverdueTime && <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />}
      <div className="flex items-start gap-2">
        {dragHandle && <div className="mt-1">{dragHandle}</div>}
        <button
          onClick={() => onStatus(task.id, done ? "pending" : "done")}
          disabled={!canEdit}
          className={cn("mt-0.5 shrink-0 transition-colors",
            done ? "text-success" : "text-muted-foreground hover:text-primary",
            !canEdit && "cursor-not-allowed opacity-60")}
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
              {ts?.kind === "now" && (
                <Badge className="text-[10px] gap-1 bg-primary text-primary-foreground border-transparent animate-pulse">
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                  NOW
                  {ts.endsInMin !== null
                    ? ` · ${humanMin(Math.max(0, ts.endsInMin))} left`
                    : ` · started ${humanMin(ts.startedAgoMin)} ago`}
                </Badge>
              )}
              {ts?.kind === "upcoming" && (
                <Badge variant="outline" className={cn("text-[10px] gap-1", ts.startsInMin <= 30 ? "border-warning/50 text-warning" : "border-border text-muted-foreground")}>
                  <Clock className="size-2.5" /> starts in {humanMin(ts.startsInMin)}
                </Badge>
              )}
              {ts?.kind === "overdue" && (
                <Badge variant="outline" className="text-[10px] gap-1 border-destructive/50 text-destructive">
                  <AlertTriangle className="size-2.5" /> overdue by {humanMin(ts.overByMin)}
                </Badge>
              )}
              {task.status === "in_progress" && !ts && (
                <Badge variant="secondary" className={cn("text-[10px]", STATUS_TONE.in_progress)}>In progress</Badge>
              )}
              {task.checklist.length > 0 && (
                <Badge variant="outline" className="text-[10px]">☑ {checkDone}/{task.checklist.length}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canEdit && task.status !== "done" && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                  onClick={() => onStatus(task.id, task.status === "in_progress" ? "pending" : "in_progress")}>
                  {task.status === "in_progress" ? "Pause" : "Start"}
                </Button>
              )}
              {hasExtras && (
                <Button size="icon" variant="ghost" className="size-7" onClick={() => setExpanded((v) => !v)} aria-label="Toggle details">
                  {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </Button>
              )}
              {canEdit && <Button size="icon" variant="ghost" className="size-7" onClick={() => onEdit(task)}><Pencil className="size-3.5" /></Button>}
              {canEdit && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                      <AlertDialogDescription>"{task.title}" will be removed for the whole team. This can't be undone.</AlertDialogDescription>
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

          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {timeLabel}</span>
            {task.duration_minutes ? <span>· {formatDuration(task.duration_minutes)}</span> : null}
            <span className="inline-flex items-center gap-1"><User className="size-3" />{assignee ? (assignee.full_name ?? assignee.email) : "Unassigned"}</span>
            {task.deadline && <span className="text-warning">· Deadline {new Date(task.deadline + "T00:00:00").toLocaleDateString()}</span>}
            {lead && <span>· 🎯 {lead.business_name}</span>}
            {task.niche && <span>· {task.niche}</span>}
            {task.country && <span>· {task.country}</span>}
            <span className="opacity-70">· by {creator?.full_name ?? creator?.email ?? "—"}</span>
          </div>

          {expanded && (
            <div className="mt-2.5 pt-2.5 border-t border-border/60 space-y-2">
              {task.description && (
                <p className={cn("text-xs text-muted-foreground whitespace-pre-wrap", done && "line-through")}>{task.description}</p>
              )}
              {task.checklist.length > 0 && (
                <div className="space-y-1">
                  {task.checklist.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={c.done}
                        disabled={!canEdit}
                        onCheckedChange={() => onChecklistToggle(task.id, c.id)}
                      />
                      <span className={cn(c.done && "line-through text-muted-foreground")}>{c.text}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function TaskDialog({
  editing, defaultDate, profiles, leads, userId, onSubmit, submitting,
}: {
  editing: Task | null; defaultDate: string; profiles: Profile[]; leads: Lead[]; userId: string | null;
  onSubmit: (payload: Partial<Task> & { id?: string }) => void; submitting: boolean;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [date, setDate] = useState(editing?.scheduled_date ?? defaultDate);
  const [startTime, setStartTime] = useState(editing?.scheduled_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(editing?.end_time?.slice(0, 5) ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(editing?.priority ?? "medium");
  const [assignedTo, setAssignedTo] = useState<string>(editing?.assigned_to ?? userId ?? "");
  const [deadline, setDeadline] = useState(editing?.deadline ?? "");
  const [relatedLead, setRelatedLead] = useState(editing?.related_lead_id ?? "");
  const [niche, setNiche] = useState(editing?.niche ?? "");
  const [country, setCountry] = useState(editing?.country ?? "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(editing?.checklist ?? []);
  const [newCheckItem, setNewCheckItem] = useState("");

  const duration = startTime && endTime ? diffMinutes(startTime, endTime) : 0;

  function addCheckItem() {
    const t = newCheckItem.trim(); if (!t) return;
    setChecklist((prev) => [...prev, { id: crypto.randomUUID(), text: t, done: false }]);
    setNewCheckItem("");
  }
  function submit() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (startTime && endTime && diffMinutes(startTime, endTime) === 0) {
      toast.error("End time must be after start time"); return;
    }
    onSubmit({
      id: editing?.id,
      title: title.trim(),
      description: description.trim() || null,
      scheduled_date: date,
      scheduled_time: startTime || null,
      end_time: endTime || null,
      duration_minutes: duration || null,
      priority,
      assigned_to: assignedTo || null,
      deadline: deadline || null,
      related_lead_id: relatedLead || null,
      niche: niche.trim() || null,
      country: country.trim() || null,
      checklist: checklist as any,
    });
  }

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit task" : "Add task"}</DialogTitle>
        <DialogDescription>Give enough detail so your teammate can pick it up cold.</DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FB outreach — Dhaka salons batch" autoFocus />
        </div>

        <div>
          <Label className="text-xs">Details / description</Label>
          <Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={3}
            placeholder="Steps, links, target count, etc." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="flex gap-1 mt-1">
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setDate(todayISO())}>Today</Button>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setDate(tomorrowISO())}>Tomorrow</Button>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setDate(addDaysISO(todayISO(), 7))}>+1 week</Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Deadline (optional)</Label>
            <Input type="date" value={deadline ?? ""} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Start time</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">End time</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Duration: <span className="font-medium text-foreground">{duration ? formatDuration(duration) : "—"}</span>
          {" "}(auto from start/end)
        </p>

        <div className="grid grid-cols-2 gap-3">
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
                {profiles.map((p) => (<SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Related lead</Label>
            <Select value={relatedLead || "none"} onValueChange={(v) => setRelatedLead(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {leads.slice(0, 200).map((l) => (<SelectItem key={l.id} value={l.id}>{l.business_name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Niche</Label>
            <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Salon, Dentist…" />
          </div>
          <div>
            <Label className="text-xs">Country</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US, BD…" />
          </div>
        </div>

        <div>
          <Label className="text-xs">Checklist</Label>
          <div className="space-y-1.5 mt-1">
            {checklist.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <Checkbox checked={c.done}
                  onCheckedChange={(v) => setChecklist((prev) => prev.map((x) => x.id === c.id ? { ...x, done: !!v } : x))} />
                <Input value={c.text}
                  onChange={(e) => setChecklist((prev) => prev.map((x) => x.id === c.id ? { ...x, text: e.target.value } : x))}
                  className="h-8 text-xs" />
                <Button type="button" size="icon" variant="ghost" className="size-7"
                  onClick={() => setChecklist((prev) => prev.filter((x) => x.id !== c.id))}>
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheckItem(); } }}
                placeholder="Add checklist item and press Enter" className="h-8 text-xs" />
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={addCheckItem}>Add</Button>
            </div>
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

function LoadFromListButton({
  targetDate, userId, onLoaded, existingSortMax,
}: { targetDate: string; userId: string | null; onLoaded: () => void; existingSortMax: number }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["task_templates_picker"],
    queryFn: async () => (await supabase.from("task_templates").select("id,name,description,color").order("created_at")).data ?? [],
    enabled: open,
  });
  const { data: items = [] } = useQuery<any[]>({
    queryKey: ["task_template_items_picker", templateId],
    enabled: !!templateId,
    queryFn: async () => (await supabase.from("task_template_items").select("*").eq("template_id", templateId).order("sort_order")).data ?? [],
  });

  useEffect(() => {
    if (items.length) {
      const all: Record<string, boolean> = {};
      items.forEach((i: any) => { all[i.id] = true; });
      setSelected(all);
    }
  }, [items]);

  async function loadSelected() {
    if (!userId) return;
    const picks = items.filter((i: any) => selected[i.id]);
    if (picks.length === 0) { toast.error("Select at least one task"); return; }
    setBusy(true);
    const rows = picks.map((it: any, idx: number) => ({
      title: it.title,
      description: it.description,
      priority: it.priority ?? "medium",
      duration_minutes: it.default_duration_minutes,
      scheduled_date: targetDate,
      status: "pending",
      created_by: userId,
      sort_order: existingSortMax + idx + 1,
      checklist: [],
    }));
    const { error } = await supabase.from("tasks").insert(rows as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Loaded ${picks.length} task${picks.length > 1 ? "s" : ""} into ${dayLabel(targetDate)}`);
    onLoaded();
    setOpen(false); setTemplateId(""); setSelected({});
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <ListTodo className="size-4" /> Load from list
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Load tasks from a list</DialogTitle>
          <DialogDescription>
            Pick a list, choose which tasks to add to <strong>{dayLabel(targetDate)}</strong>. Times can be set after loading.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">List</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder={templates.length === 0 ? "No lists yet — create one first" : "Choose a list…"} /></SelectTrigger>
              <SelectContent>
                {templates.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {templateId && (
            <div className="border border-border rounded-md max-h-72 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">This list has no tasks yet.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((it: any) => (
                    <li key={it.id} className="p-2.5 flex items-start gap-2.5 hover:bg-accent/30">
                      <Checkbox
                        checked={!!selected[it.id]}
                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [it.id]: !!v }))}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{it.title}</span>
                          <Badge variant="outline" className="text-[10px]">{it.priority}</Badge>
                          {it.default_duration_minutes && <Badge variant="outline" className="text-[10px]">{it.default_duration_minutes}m</Badge>}
                        </div>
                        {it.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={loadSelected} disabled={!templateId || busy}>{busy ? "Loading…" : "Load tasks"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
