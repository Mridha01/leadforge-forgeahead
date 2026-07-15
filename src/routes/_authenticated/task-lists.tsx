import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, ListChecks, Pencil, Trash2, Flame, GripVertical } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/task-lists")({
  head: () => ({ meta: [{ title: "Task Lists — LeadForge" }] }),
  component: TaskListsPage,
});

type Template = { id: string; name: string; description: string | null; color: string | null; created_by: string };
type Item = {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  default_duration_minutes: number | null;
  sort_order: number;
};

const PRIO_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/15 text-primary",
  high: "bg-destructive/15 text-destructive",
};

function TaskListsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingList, setEditingList] = useState<Template | null>(null);
  const [listDialog, setListDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemDialog, setItemDialog] = useState(false);

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["task_templates"],
    queryFn: async () => (await supabase.from("task_templates").select("*").order("created_at", { ascending: true })).data as Template[] ?? [],
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["task_template_items", selectedId],
    enabled: !!selectedId,
    queryFn: async () =>
      (await supabase.from("task_template_items").select("*").eq("template_id", selectedId!).order("sort_order")).data as Item[] ?? [],
  });

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) ?? templates[0] ?? null, [templates, selectedId]);
  const activeId = selected?.id ?? null;

  const saveList = useMutation({
    mutationFn: async (form: { id?: string; name: string; description: string; color: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (form.id) {
        const { error } = await supabase.from("task_templates").update({ name: form.name, description: form.description || null, color: form.color || null }).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("task_templates").insert({ name: form.name, description: form.description || null, color: form.color || null, created_by: u.user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task_templates"] }); setListDialog(false); setEditingList(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delList = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("task_templates").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task_templates"] }); setSelectedId(null); toast.success("List deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveItem = useMutation({
    mutationFn: async (form: { id?: string; title: string; description: string; priority: string; default_duration_minutes: string }) => {
      const payload: any = {
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        default_duration_minutes: form.default_duration_minutes ? Number(form.default_duration_minutes) : null,
      };
      if (form.id) {
        const { error } = await supabase.from("task_template_items").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const maxSort = Math.max(0, ...items.map((i) => i.sort_order));
        const { error } = await supabase.from("task_template_items").insert({ ...payload, template_id: activeId, sort_order: maxSort + 1 });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task_template_items", activeId] }); setItemDialog(false); setEditingItem(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("task_template_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task_template_items", activeId] }); toast.success("Item deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Task Lists"
        subtitle="Reusable task templates — build once, load into the Planner for any day."
        action={
          <Button size="sm" className="gap-1.5" onClick={() => { setEditingList(null); setListDialog(true); }}>
            <Plus className="size-4" /> New List
          </Button>
        }
      />

      <div className="p-6 pt-4 grid lg:grid-cols-[300px_1fr] gap-4">
        {/* Sidebar of lists */}
        <Card className="p-2 bg-card border-border h-fit">
          {templates.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <ListChecks className="size-6 mx-auto mb-2 opacity-40" />
              No lists yet. Create one to get started.
            </div>
          ) : (
            <ul className="space-y-1">
              {templates.map((t) => {
                const active = t.id === activeId;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => setSelectedId(t.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: t.color || "hsl(var(--primary))" }} />
                        <span className="font-medium truncate">{t.name}</span>
                      </div>
                      {t.description && <div className="text-xs text-muted-foreground truncate mt-0.5">{t.description}</div>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Items panel */}
        <div className="space-y-3">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: selected.color || "hsl(var(--primary))" }} />
                    {selected.name}
                  </h2>
                  {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setEditingList(selected); setListDialog(true); }}>
                    <Pencil className="size-3.5 mr-1.5" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="size-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{selected.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>All items in this list will be permanently removed.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => delList.mutate(selected.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button size="sm" className="gap-1.5" onClick={() => { setEditingItem(null); setItemDialog(true); }}>
                    <Plus className="size-4" /> Add task
                  </Button>
                </div>
              </div>

              <Card className="bg-card border-border">
                {items.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No tasks in this list yet. Click "Add task" to create one.
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {items.map((it) => (
                      <li key={it.id} className="flex items-start gap-3 p-3">
                        <GripVertical className="size-4 text-muted-foreground/40 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{it.title}</span>
                            <Badge variant="outline" className={`text-[10px] ${PRIO_TONE[it.priority]}`}><Flame className="size-3 mr-1" />{it.priority}</Badge>
                            {it.default_duration_minutes && <Badge variant="outline" className="text-[10px]">{it.default_duration_minutes}m</Badge>}
                          </div>
                          {it.description && <p className="text-xs text-muted-foreground mt-1">{it.description}</p>}
                        </div>
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => { setEditingItem(it); setItemDialog(true); }}><Pencil className="size-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="size-7 text-destructive"><Trash2 className="size-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete task?</AlertDialogTitle>
                              <AlertDialogDescription>"{it.title}" will be removed from this list.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => delItem.mutate(it.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          ) : (
            <Card className="p-12 text-center bg-card border-border">
              <ListChecks className="size-10 mx-auto mb-3 opacity-40" />
              <h3 className="text-lg font-medium">No list selected</h3>
              <p className="text-sm text-muted-foreground mt-1">Create a list of reusable tasks. Later, load them into the Planner for any day.</p>
              <Button className="mt-4" onClick={() => { setEditingList(null); setListDialog(true); }}><Plus className="size-4 mr-1.5" /> New List</Button>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={listDialog} onOpenChange={(o) => { setListDialog(o); if (!o) setEditingList(null); }}>
        <ListDialog initial={editingList} onSubmit={(v) => saveList.mutate(v)} submitting={saveList.isPending} />
      </Dialog>
      <Dialog open={itemDialog} onOpenChange={(o) => { setItemDialog(o); if (!o) setEditingItem(null); }}>
        <ItemDialog initial={editingItem} onSubmit={(v) => saveItem.mutate(v)} submitting={saveItem.isPending} />
      </Dialog>
    </div>
  );
}

function ListDialog({ initial, onSubmit, submitting }: { initial: Template | null; onSubmit: (v: any) => void; submitting: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "#8b5cf6");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Edit list" : "New task list"}</DialogTitle>
        <DialogDescription>Group related tasks. You'll load selected items into the Planner on any day.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily FB outreach routine" /></div>
        <div><Label className="text-xs">Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><Label className="text-xs">Color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-20 h-9 p-1" /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ id: initial?.id, name, description, color })} disabled={!name || submitting}>{initial ? "Save" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ItemDialog({ initial, onSubmit, submitting }: { initial: Item | null; onSubmit: (v: any) => void; submitting: boolean }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [duration, setDuration] = useState(initial?.default_duration_minutes ? String(initial.default_duration_minutes) : "");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Edit task" : "Add task to list"}</DialogTitle>
        <DialogDescription>These become templates. When loaded into the Planner, you set the date and time.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label className="text-xs">Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
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
          <div><Label className="text-xs">Default duration (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" /></div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ id: initial?.id, title, description, priority, default_duration_minutes: duration })} disabled={!title || submitting}>{initial ? "Save" : "Add"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
