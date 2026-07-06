import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tag as TagIcon, Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#f97316", "#ef4444", "#22c55e", "#3b82f6", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f59e0b", "#64748b", "#0ea5e9",
];

const USAGE_TABLES = ["founders", "expenses", "contracts", "events"] as const;

type TagRow = { id: string; name: string; color: string };

export default function Tags() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TagRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TagRow | null>(null);
  const [form, setForm] = useState<{ name: string; color: string }>({ name: "", color: PRESET_COLORS[0] });

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data as TagRow[];
    },
  });

  // Fetch tag_ids from every table to compute usage counts client-side.
  const { data: usage = {} } = useQuery({
    queryKey: ["tag-usage"],
    queryFn: async () => {
      const results = await Promise.all(
        USAGE_TABLES.map((t) => supabase.from(t).select("tag_ids"))
      );
      const counts: Record<string, number> = {};
      results.forEach(({ data }) => {
        (data ?? []).forEach((row: any) => {
          (row.tag_ids ?? []).forEach((id: string) => {
            counts[id] = (counts[id] ?? 0) + 1;
          });
        });
      });
      return counts;
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return tags.filter((t) => !s || t.name.toLowerCase().includes(s));
  }, [tags, search]);

  const upsertTag = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name.trim(), color: form.color };
      if (!payload.name) throw new Error("Name is required");
      if (editing) {
        const { error } = await supabase.from("tags").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tags").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success(editing ? "Tag updated" : "Tag created");
      setEditing(null);
      setCreating(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTag = useMutation({
    mutationFn: async (tag: TagRow) => {
      // Clean tag id from all arrays across referenced tables
      for (const table of USAGE_TABLES) {
        const { data: rows, error } = await supabase
          .from(table)
          .select("id, tag_ids")
          .contains("tag_ids", [tag.id]);
        if (error) throw error;
        for (const row of rows ?? []) {
          const next = ((row as any).tag_ids ?? []).filter((x: string) => x !== tag.id);
          const { error: upErr } = await supabase
            .from(table)
            .update({ tag_ids: next })
            .eq("id", (row as any).id);
          if (upErr) throw upErr;
        }
      }
      const { error } = await supabase.from("tags").delete().eq("id", tag.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["tag-usage"] });
      toast.success("Tag deleted and references cleaned");
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openCreate() {
    setForm({ name: "", color: PRESET_COLORS[0] });
    setEditing(null);
    setCreating(true);
  }

  function openEdit(t: TagRow) {
    setForm({ name: t.name, color: t.color });
    setEditing(t);
    setCreating(false);
  }

  const dialogOpen = creating || !!editing;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <TagIcon className="h-5 w-5 text-muted-foreground" />
            Tags & Labels
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Central manager for every tag used across the platform. Changes here reflect everywhere.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> New tag
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags by name…"
          className="pl-9 max-w-sm"
        />
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading tags…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <TagIcon className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">No tags {search ? "match your search" : "yet"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? "Try a different term." : "Create your first tag to get started."}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((t) => {
              const count = usage[t.id] ?? 0;
              return (
                <li key={t.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <span
                    className="h-6 w-6 rounded-md border shrink-0"
                    style={{ backgroundColor: t.color }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <Badge style={{ backgroundColor: t.color, color: "#fff" }} className="text-xs">
                      {t.name}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-24 text-right">
                    {count} {count === 1 ? "record" : "records"}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleting(t)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit tag" : "New tag"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Updating a tag changes it everywhere it's used."
                : "Give the tag a short label and pick a color."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="tag-name" className="text-xs font-medium">Name</label>
              <Input
                id="tag-name"
                name="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. High priority"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium block">Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                  aria-label="Custom color"
                />
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-all",
                      form.color.toLowerCase() === c.toLowerCase()
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm({ ...form, color: c })}
                    aria-label={`Pick ${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="pt-1">
              <span className="text-xs text-muted-foreground mr-2">Preview:</span>
              <Badge style={{ backgroundColor: form.color, color: "#fff" }}>
                {form.name.trim() || "Tag preview"}
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>
              Cancel
            </Button>
            <Button onClick={() => upsertTag.mutate()} disabled={!form.name.trim() || upsertTag.isPending}>
              {upsertTag.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editing ? "Save changes" : "Create tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (usage[deleting.id] ?? 0) > 0 ? (
                <>
                  This tag is currently applied to{" "}
                  <strong>{usage[deleting.id]} record{usage[deleting.id] === 1 ? "" : "s"}</strong>{" "}
                  across the platform. Deleting will remove it from all of them. This cannot be undone.
                </>
              ) : (
                "This tag isn't used anywhere. It will be permanently removed."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTag.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleting) deleteTag.mutate(deleting); }}
              disabled={deleteTag.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTag.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Delete tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
