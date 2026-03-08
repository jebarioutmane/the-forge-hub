import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/logAction";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, ExternalLink, Trash2, BookOpen, Pencil, Eye } from "lucide-react";
import ViewDetailDialog from "@/components/ViewDetailDialog";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

interface LibraryProps {
  moduleName: string;
}

export default function Library({ moduleName }: LibraryProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; resource_name: string; description: string | null; url: string } | null>(null);
  const [viewing, setViewing] = useState<{ resource_name: string; description: string | null; url: string; created_at: string } | null>(null);

  const ensureProtocol = (u: string) => {
    if (!/^https?:\/\//i.test(u)) return `https://${u}`;
    return u;
  };

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resource_library", moduleName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_library")
        .select("*")
        .eq("module_name", moduleName)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("resource_library").insert({
        module_name: moduleName,
        resource_name: name,
        description: description.trim() || null,
        url: ensureProtocol(url),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource_library", moduleName] });
      setDialogOpen(false);
      setName("");
      setDescription("");
      setUrl("");
      toast({ title: "Resource added" });
    },
    onError: () => toast({ title: "Error adding resource", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("resource_library").update({
        resource_name: name,
        description: description.trim() || null,
        url: ensureProtocol(url),
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource_library", moduleName] });
      setEditing(null);
      setName("");
      setDescription("");
      setUrl("");
      toast({ title: "Resource updated" });
    },
    onError: () => toast({ title: "Error updating resource", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resource_library").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource_library", moduleName] });
      toast({ title: "Resource deleted" });
    },
    onError: () => toast({ title: "Error deleting resource", variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{moduleName} Library</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Resource</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Resource</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Resource name" />
              </div>
              <div className="space-y-2">
                <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief context for this resource" />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://... or example.com" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => addMutation.mutate()} disabled={!name.trim() || !url.trim() || addMutation.isPending}>
                {addMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resources</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No resources yet. Add one to get started.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {resources.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0 flex-1">
                    <a
                      href={ensureProtocol(r.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-medium text-primary hover:underline truncate"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      {r.resource_name}
                    </a>
                    {r.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-6 truncate">{r.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewing(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setName(r.resource_name); setDescription(r.description || ""); setUrl(r.url); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(deleteId);
            setDeleteId(null);
          }
        }}
        title="Delete resource?"
        description="This will permanently remove this resource link."
      />

      {/* Edit Resource Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Resource</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={!name.trim() || !url.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ViewDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Resource Details"
        fields={viewing ? [
          { label: "Name", value: viewing.resource_name },
          { label: "Description", value: viewing.description },
          { label: "URL", value: <a href={ensureProtocol(viewing.url)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{viewing.url}</a> },
          { label: "Created", value: new Date(viewing.created_at).toLocaleDateString() },
        ] : []}
      />
    </div>
  );
}
