import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X, Pencil, Check } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

const DEFAULT_LABELS = ["Urgent", "Operations", "Event", "Mentoring"];
const STORAGE_KEY = "forge_global_labels";

function getLabels(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_LABELS;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [labels, setLabels] = useState(getLabels);
  const [newLabel, setNewLabel] = useState("");

  // Tags from Supabase
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#f97316");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tags").insert({ name: newTagName.trim(), color: newTagColor });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setNewTagName("");
      setNewTagColor("#f97316");
      toast.success("Tag created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTagMutation = useMutation({
    mutationFn: async () => {
      if (!editingTagId) return;
      const { error } = await supabase.from("tags").update({ name: editTagName.trim(), color: editTagColor }).eq("id", editingTagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setEditingTagId(null);
      toast.success("Tag updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setDeleteTagId(null);
      toast.success("Tag deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
  }, [labels]);

  function addLabel() {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    if (labels.includes(trimmed)) {
      toast.error("Label already exists");
      return;
    }
    setLabels((l) => [...l, trimmed]);
    setNewLabel("");
    toast.success("Label added");
  }

  function removeLabel(label: string) {
    setLabels((l) => l.filter((x) => x !== label));
    toast.success("Label removed");
  }

  function resetDefaults() {
    setLabels(DEFAULT_LABELS);
    toast.success("Labels reset to defaults");
  }

  function startEditTag(tag: { id: string; name: string; color: string }) {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  }

  const PRESET_COLORS = ["#f97316", "#ef4444", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#64748b"];

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* Tags (Supabase) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tags</CardTitle>
          <CardDescription>Color-coded tags you can assign to Events, Contracts, and Expenses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-2 group">
                {editingTagId === tag.id ? (
                  <>
                    <input
                      type="color"
                      value={editTagColor}
                      onChange={(e) => setEditTagColor(e.target.value)}
                      className="h-7 w-7 rounded cursor-pointer border-0 p-0"
                    />
                    <Input
                      value={editTagName}
                      onChange={(e) => setEditTagName(e.target.value)}
                      className="h-8 max-w-[160px]"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateTagMutation.mutate()} disabled={!editTagName.trim()}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTagId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge style={{ backgroundColor: tag.color, color: "#fff", border: "none" }} className="text-sm">
                      {tag.name}
                    </Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => startEditTag(tag)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => setDeleteTagId(tag.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags created yet.</p>}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="h-8 w-8 rounded cursor-pointer border-0 p-0"
            />
            <div className="flex gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-5 w-5 rounded-full border-2 transition-all ${newTagColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewTagColor(c)}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag name..."
              className="max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && newTagName.trim() && addTagMutation.mutate()}
            />
            <Button size="sm" onClick={() => addTagMutation.mutate()} disabled={!newTagName.trim()}>
              <Plus className="mr-1 h-3 w-3" /> Add Tag
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Legacy Labels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Labels</CardTitle>
          <CardDescription>Simple text labels for internal categorization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <Badge key={label} variant="secondary" className="gap-1 pr-1 text-sm">
                {label}
                <button onClick={() => removeLabel(label)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {labels.length === 0 && <p className="text-sm text-muted-foreground">No labels configured.</p>}
          </div>
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="New label..."
              className="max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && addLabel()}
            />
            <Button size="sm" onClick={addLabel} disabled={!newLabel.trim()}>
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={resetDefaults}>Reset to Defaults</Button>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog open={!!deleteTagId} onConfirm={() => deleteTagId && deleteTagMutation.mutate(deleteTagId)} onCancel={() => setDeleteTagId(null)} />
    </div>
  );
}
