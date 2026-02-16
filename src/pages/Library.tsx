import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, ExternalLink, Trash2, BookOpen } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

interface LibraryProps {
  moduleName: string;
}

export default function Library({ moduleName }: LibraryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
        url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource_library", moduleName] });
      setDialogOpen(false);
      setName("");
      setUrl("");
      toast({ title: "Resource added" });
    },
    onError: () => toast({ title: "Error adding resource", variant: "destructive" }),
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
                <Label>URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
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
                <li key={r.id} className="flex items-center justify-between py-3">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-medium text-primary hover:underline truncate"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    {r.resource_name}
                  </a>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
    </div>
  );
}
