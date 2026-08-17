import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Target,
  Check,
  ArrowUp,
  ArrowDown,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Link as LinkIcon,
  ExternalLink,
  Archive,
  ArchiveRestore,
  Trash2,
  CalendarDays,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatUrl } from "@/lib/formatUrl";

interface FocusLink {
  label?: string;
  url: string;
}

interface Focus {
  id: string;
  title: string;
  details: string | null;
  owner_ids: string[] | null;
  deadline: string | null;
  priority_order: number | null;
  links: FocusLink[] | null;
  is_done: boolean;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

const formatDeadline = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

export default function WeeklyFocusesPanel() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Focus | null>(null);

  const { data: focuses = [] } = useQuery({
    queryKey: ["weekly-focuses", showArchived],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("weekly_focuses")
        .select("*")
        .eq("is_archived", showArchived)
        .order("priority_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Focus[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("status", "Active");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach((p) => { m[p.id] = p; });
    return m;
  }, [profiles]);

  const updateMutation = useMutation({
    mutationFn: async (patch: { id: string; changes: Partial<Focus> }) => {
      const { error } = await (supabase as any)
        .from("weekly_focuses")
        .update(patch.changes)
        .eq("id", patch.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-focuses"] }),
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = focuses.findIndex((f) => f.id === id);
      const target = focuses[idx + dir];
      if (!target) return;
      // Assign explicit priority_order values 1..N based on current order, then swap
      const withOrders = focuses.map((f, i) => ({ ...f, priority_order: i + 1 }));
      const a = withOrders[idx];
      const b = withOrders[idx + dir];
      await (supabase as any).from("weekly_focuses").update({ priority_order: b.priority_order }).eq("id", a.id);
      await (supabase as any).from("weekly_focuses").update({ priority_order: a.priority_order }).eq("id", b.id);
      // Ensure the rest also carry their orders so future sorts stay stable
      const others = withOrders.filter((_, i) => i !== idx && i !== idx + dir);
      for (const o of others) {
        if (o.priority_order !== focuses.find((x) => x.id === o.id)?.priority_order) {
          await (supabase as any).from("weekly_focuses").update({ priority_order: o.priority_order }).eq("id", o.id);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-focuses"] }),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="rounded-lg border border-border/40 bg-card shadow-elev-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Target className="h-4 w-4 text-indigo-600" />
        </div>
        <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
          {showArchived ? "Archived Focuses" : "Weekly Focuses"}
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="show-archived" className="cursor-pointer text-xs">Archived</Label>
          </div>
          {!showArchived && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => { setEditing(null); setDialogOpen(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          )}
        </div>
      </div>

      <div className="p-3">
        {focuses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            {showArchived ? "No archived focuses." : "No focuses set this week."}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {focuses.map((f, i) => {
              const isOverdue = f.deadline && !f.is_done && new Date(f.deadline) < today;
              const isExpanded = !!expanded[f.id];
              const owners = (f.owner_ids ?? []).map((id) => profileMap[id]).filter(Boolean) as Profile[];
              const links = (f.links ?? []) as FocusLink[];

              return (
                <div
                  key={f.id}
                  className={`rounded-xl border transition-colors ${
                    f.is_done ? "bg-emerald-50/40 border-emerald-100" : "bg-background border-border/50 hover:bg-accent/30"
                  }`}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    {!showArchived && (
                      <button
                        onClick={() => updateMutation.mutate({ id: f.id, changes: { is_done: !f.is_done } })}
                        className={`h-6 w-6 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                          f.is_done
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-border hover:border-foreground/40"
                        }`}
                        aria-label={f.is_done ? "Mark not done" : "Mark done"}
                      >
                        {f.is_done && <Check className="h-3.5 w-3.5" />}
                      </button>
                    )}

                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [f.id]: !p[f.id] }))}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <p className={`text-[14px] font-medium truncate leading-tight ${
                          f.is_done ? "line-through text-muted-foreground" : "text-foreground"
                        }`}>
                          {f.title}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {owners.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {owners.slice(0, 3).map((o) => (
                            <Avatar key={o.id} className="h-6 w-6 border-2 border-card" title={o.full_name || o.email}>
                              {o.avatar_url && <AvatarImage src={o.avatar_url} />}
                              <AvatarFallback className="text-[9px] bg-muted">
                                {initials(o.full_name || o.email)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {owners.length > 3 && (
                            <span className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[9px] font-semibold">
                              +{owners.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      {f.deadline && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 ${
                            isOverdue ? "border-rose-200 bg-rose-50 text-rose-700" : ""
                          }`}
                        >
                          <CalendarDays className="h-3 w-3" />
                          {formatDeadline(f.deadline)}
                        </Badge>
                      )}
                      {links.length > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <LinkIcon className="h-3 w-3" />
                          {links.length}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 ml-1">
                      {!showArchived && (
                        <>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            disabled={i === 0}
                            onClick={() => moveMutation.mutate({ id: f.id, dir: -1 })}
                            aria-label="Move up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            disabled={i === focuses.length - 1}
                            onClick={() => moveMutation.mutate({ id: f.id, dir: 1 })}
                            aria-label="Move down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => { setEditing(f); setDialogOpen(true); }}
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                            onClick={() => updateMutation.mutate({ id: f.id, changes: { is_archived: true, archived_at: new Date().toISOString() } as any })}
                            aria-label="Archive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {showArchived && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => updateMutation.mutate({ id: f.id, changes: { is_archived: false, archived_at: null } as any })}
                          aria-label="Restore"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 border-t border-border/40 space-y-2">
                      {f.details ? (
                        <p className="text-[13px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {f.details}
                        </p>
                      ) : (
                        <p className="text-[12px] text-muted-foreground italic">No details.</p>
                      )}
                      {links.length > 0 && (
                        <div className="flex flex-col gap-1">
                          {links.map((lnk, idx) => (
                            <a
                              key={idx}
                              href={formatUrl(lnk.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12px] text-primary hover:underline flex items-center gap-1.5"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {lnk.label || lnk.url}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FocusDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        profiles={profiles}
        onSaved={() => qc.invalidateQueries({ queryKey: ["weekly-focuses"] })}
      />
    </div>
  );
}

function FocusDialog({
  open,
  onOpenChange,
  editing,
  profiles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Focus | null;
  profiles: Profile[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [deadline, setDeadline] = useState("");
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [links, setLinks] = useState<FocusLink[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form state whenever the dialog opens or the editing target changes
  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setDetails(editing?.details ?? "");
      setDeadline(editing?.deadline ?? "");
      setOwnerIds(editing?.owner_ids ?? []);
      setLinks(editing?.links ?? []);
      setNewLinkLabel("");
      setNewLinkUrl("");
    }
  }, [open, editing]);

  const toggleOwner = (id: string) => {
    setOwnerIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    setLinks((prev) => [...prev, { label: newLinkLabel.trim() || undefined, url: newLinkUrl.trim() }]);
    setNewLinkLabel("");
    setNewLinkUrl("");
  };

  const save = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: title.trim(),
        details: details.trim() || null,
        deadline: deadline || null,
        owner_ids: ownerIds.length ? ownerIds : null,
        links: links.length ? links : null,
      };
      if (editing) {
        const { error } = await (supabase as any)
          .from("weekly_focuses")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        payload.created_by = user?.id ?? null;
        const { error } = await (supabase as any)
          .from("weekly_focuses")
          .insert(payload);
        if (error) throw error;
      }
      toast({ title: editing ? "Focus updated" : "Focus added" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Focus" : "New Weekly Focus"}</DialogTitle>
          <DialogDescription>
            Set a title, owners, deadline, and optional details or links.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="focus-title">Title</Label>
            <Input id="focus-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="focus-deadline">Deadline</Label>
              <Input
                id="focus-deadline"
                name="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Owners</Label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border rounded-lg">
              {profiles.map((p) => {
                const on = ownerIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleOwner(p.id)}
                    className={`text-[12px] px-2 py-1 rounded-md border transition-colors ${
                      on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                    }`}
                  >
                    {p.full_name || p.email}
                  </button>
                );
              })}
              {profiles.length === 0 && (
                <p className="text-xs text-muted-foreground">No active team members.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="focus-details">Details</Label>
            <Textarea
              id="focus-details"
              name="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Links</Label>
            {links.length > 0 && (
              <div className="flex flex-col gap-1">
                {links.map((lnk, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] bg-muted/40 rounded px-2 py-1">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate flex-1">{lnk.label || lnk.url}</span>
                    <button
                      onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-rose-600"
                      aria-label="Remove link"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <Input
                placeholder="Label (optional)"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="https://…"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                className="h-8 text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={addLink} className="h-8 shrink-0">
                Add
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
