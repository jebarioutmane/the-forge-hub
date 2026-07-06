import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, ExternalLink, Trash2, BookOpen, Pencil, Search, Link as LinkIcon,
  FileText, FolderOpen, Archive, ArchiveRestore, Tag as TagIcon, X,
} from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { TagPicker } from "@/components/TagPicker";

interface LibraryProps {
  moduleName?: string;
}

type Resource = {
  id: string;
  module_name: string;
  resource_name: string;
  description: string | null;
  url: string;
  category: string;
  resource_type: string;
  tag_ids: string[] | null;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
};

const DEFAULT_CATEGORIES = ["Legal", "Templates", "Guides", "Financial", "Onboarding"];

const ensureProtocol = (u: string) =>
  /^https?:\/\//i.test(u) ? u : `https://${u}`;

type FormState = {
  resource_name: string;
  url: string;
  category: string;
  resource_type: "link" | "document";
  description: string;
  tag_ids: string[];
};

const emptyForm: FormState = {
  resource_name: "",
  url: "",
  category: "Guides",
  resource_type: "link",
  description: "",
  tag_ids: [],
};

export default function Library({ moduleName = "All" }: LibraryProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resource_library", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_library")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Resource[];
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*");
      if (error) throw error;
      return data as { id: string; name: string; color: string }[];
    },
  });
  const tagMap = useMemo(() => Object.fromEntries(tags.map((t) => [t.id, t])), [tags]);

  const allCategories = useMemo(() => {
    const fromData = resources.map((r) => r.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories, ...fromData])).sort();
  }, [resources, customCategories]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter((r) => {
      if (r.is_archived !== showArchived) return false;
      if (activeCategory !== "All" && r.category !== activeCategory) return false;
      if (!q) return true;
      return (
        r.resource_name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.url || "").toLowerCase().includes(q)
      );
    });
  }, [resources, search, activeCategory, showArchived, showArchived]);

  const grouped = useMemo(() => {
    const g: Record<string, Resource[]> = {};
    for (const r of visible) {
      const key = r.category || "Uncategorized";
      (g[key] ||= []).push(r);
    }
    return g;
  }, [visible]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of resources) {
      if (r.is_archived !== showArchived) continue;
      c[r.category || "Uncategorized"] = (c[r.category || "Uncategorized"] || 0) + 1;
    }
    return c;
  }, [resources, showArchived]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, category: activeCategory !== "All" ? activeCategory : "Guides" });
    setDialogOpen(true);
  };
  const openEdit = (r: Resource) => {
    setEditing(r);
    setForm({
      resource_name: r.resource_name,
      url: r.url,
      category: r.category || "Guides",
      resource_type: (r.resource_type as "link" | "document") || "link",
      description: r.description || "",
      tag_ids: r.tag_ids || [],
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        module_name: moduleName,
        resource_name: form.resource_name.trim(),
        url: ensureProtocol(form.url.trim()),
        category: form.category,
        resource_type: form.resource_type,
        description: form.description.trim() || null,
        tag_ids: form.tag_ids,
      };
      if (editing) {
        const { error } = await supabase
          .from("resource_library")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("resource_library").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resource_library", "all"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Resource updated" : "Resource added" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase
        .from("resource_library")
        .update({
          is_archived: archive,
          archived_at: archive ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["resource_library", "all"] });
      toast({ title: v.archive ? "Resource archived" : "Resource restored" });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resource_library").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resource_library", "all"] });
      toast({ title: "Resource permanently deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const addCategoryInline = () => {
    const n = newCategory.trim();
    if (!n) return;
    if (!allCategories.includes(n)) setCustomCategories((cs) => [...cs, n]);
    setForm((f) => ({ ...f, category: n }));
    setNewCategory("");
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resource Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Central hub for links, templates, guides, and reference documents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Switch id="archived-toggle" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="archived-toggle" className="cursor-pointer">
              {showArchived ? "Viewing archived" : "Show archived"}
            </Label>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />Add Resource
          </Button>
        </div>
      </div>

      {/* Search + category chips */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="library-search"
            name="library-search"
            placeholder="Search resources by title, description, or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryChip
            label="All"
            active={activeCategory === "All"}
            count={Object.values(categoryCounts).reduce((a, b) => a + b, 0)}
            onClick={() => setActiveCategory("All")}
          />
          {allCategories.map((c) => (
            <CategoryChip
              key={c}
              label={c}
              active={activeCategory === c}
              count={categoryCounts[c] || 0}
              onClick={() => setActiveCategory(c)}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState
          category={activeCategory}
          archived={showArchived}
          onAdd={openAdd}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cat, items]) => (
              <section key={cat} className="space-y-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {cat}
                  </h2>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((r) => (
                    <ResourceCard
                      key={r.id}
                      resource={r}
                      tagMap={tagMap}
                      onEdit={() => openEdit(r)}
                      onArchive={() => archiveMutation.mutate({ id: r.id, archive: !r.is_archived })}
                      onDelete={() => setDeleteId(r.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Resource" : "Add Resource"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this resource's details." : "Add a new link or document to the library."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="res-title">Title</Label>
              <Input
                id="res-title" name="res-title"
                value={form.resource_name}
                onChange={(e) => setForm((f) => ({ ...f, resource_name: e.target.value }))}
                placeholder="e.g. Founder Onboarding Checklist"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-url">URL</Label>
              <Input
                id="res-url" name="res-url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://... or example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.resource_type} onValueChange={(v: "link" | "document") => setForm((f) => ({ ...f, resource_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-newcat" className="text-xs text-muted-foreground">Add new category</Label>
              <div className="flex gap-2">
                <Input
                  id="res-newcat" name="res-newcat"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Compliance"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategoryInline(); } }}
                />
                <Button type="button" variant="outline" onClick={addCategoryInline}>Add</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-desc">Description</Label>
              <Textarea
                id="res-desc" name="res-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief context: what this is and when to use it."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagPicker
                value={form.tag_ids}
                onChange={(ids) => setForm((f) => ({ ...f, tag_ids: ids }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.resource_name.trim() || !form.url.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Add Resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(deleteId);
            setDeleteId(null);
          }
        }}
        title="Permanently delete resource?"
        description="This cannot be undone. To keep it recoverable, archive instead."
      />
    </div>
  );
}

function CategoryChip({
  label, active, count, onClick,
}: { label: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-border hover:bg-muted"
      }`}
    >
      {label} <span className={active ? "opacity-80" : "text-muted-foreground"}>· {count}</span>
    </button>
  );
}

function EmptyState({
  category, archived, onAdd,
}: { category: string; archived: boolean; onAdd: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen className="h-10 w-10 mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground mb-4">
          {archived
            ? "No archived resources."
            : category === "All"
              ? "No resources yet. Add your first one to get started."
              : `No resources yet in ${category}.`}
        </p>
        {!archived && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />Add Resource
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ResourceCard({
  resource, tagMap, onEdit, onArchive, onDelete,
}: {
  resource: Resource;
  tagMap: Record<string, { id: string; name: string; color: string }>;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const TypeIcon = resource.resource_type === "document" ? FileText : LinkIcon;
  return (
    <Card className="group hover:border-primary/40 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              <TypeIcon className="h-3 w-3" />
              {resource.resource_type === "document" ? "Document" : "Link"}
            </div>
            <a
              href={ensureProtocol(resource.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-foreground hover:text-primary line-clamp-2 inline-flex items-start gap-1"
            >
              {resource.resource_name}
              <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 opacity-60" />
            </a>
          </div>
        </div>
        {resource.description && (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
            {resource.description}
          </p>
        )}
        {resource.tag_ids && resource.tag_ids.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {resource.tag_ids.map((id) => {
              const t = tagMap[id];
              if (!t) return null;
              return (
                <Badge
                  key={id}
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 h-5 border-transparent"
                  style={{ backgroundColor: `${t.color}20`, color: t.color }}
                >
                  <TagIcon className="h-2.5 w-2.5 mr-1" />
                  {t.name}
                </Badge>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-end gap-1 pt-1 border-t opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEdit}>
            <Pencil className="h-3 w-3 mr-1" />Edit
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onArchive}>
            {resource.is_archived ? (
              <><ArchiveRestore className="h-3 w-3 mr-1" />Restore</>
            ) : (
              <><Archive className="h-3 w-3 mr-1" />Archive</>
            )}
          </Button>
          {resource.is_archived && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
