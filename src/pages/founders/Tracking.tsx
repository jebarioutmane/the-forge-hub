import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StarRating } from "@/components/StarRating";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { logAction } from "@/lib/logAction";
import { format, parseISO } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Founder = Tables<"founders">;
type Tracking = Tables<"founders_tracking">;

const AREAS = [
  { key: "product_dev", label: "Product Development" },
  { key: "clients_traction", label: "Clients & Traction" },
  { key: "team_structure", label: "Team Structure" },
  { key: "market_presence", label: "Market Presence" },
  { key: "funding_update", label: "Funding Update" },
] as const;

type FormState = {
  id?: string;
  founder_id: string;
  tracking_date: string;
  product_dev_rating: number;
  product_dev_update: string;
  clients_traction_rating: number;
  clients_traction_update: string;
  team_structure_rating: number;
  team_structure_update: string;
  market_presence_rating: number;
  market_presence_update: string;
  funding_update_rating: number;
  funding_update: string;
  other_updates: string;
};

const emptyForm = (founderId: string): FormState => ({
  founder_id: founderId,
  tracking_date: new Date().toISOString().split("T")[0],
  product_dev_rating: 0, product_dev_update: "",
  clients_traction_rating: 0, clients_traction_update: "",
  team_structure_rating: 0, team_structure_update: "",
  market_presence_rating: 0, market_presence_update: "",
  funding_update_rating: 0, funding_update: "",
  other_updates: "",
});

export default function FoundersTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFounder, setSelectedFounder] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(""));

  const isEditing = !!form.id;

  const { data: founders = [] } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("*").order("founder_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allTracking = [] } = useQuery({
    queryKey: ["founders_tracking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders_tracking").select("*").order("tracking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        founder_id: form.founder_id,
        tracking_date: form.tracking_date,
        product_dev_rating: form.product_dev_rating,
        product_dev_update: form.product_dev_update || null,
        clients_traction_rating: form.clients_traction_rating,
        clients_traction_update: form.clients_traction_update || null,
        team_structure_rating: form.team_structure_rating,
        team_structure_update: form.team_structure_update || null,
        market_presence_rating: form.market_presence_rating,
        market_presence_update: form.market_presence_update || null,
        funding_update_rating: form.funding_update_rating,
        funding_update: form.funding_update || null,
        other_updates: form.other_updates || null,
      };

      if (form.id) {
        const oldEntry = allTracking.find((t) => t.id === form.id);
        const { error } = await supabase.from("founders_tracking").update(payload).eq("id", form.id);
        if (error) throw error;
        const userName = user?.email || "Unknown";
        await logAction("Founders-Tracking", "UPDATE", form.id, oldEntry as any, payload, userName);
      } else {
        const { data, error } = await supabase.from("founders_tracking").insert(payload).select().single();
        if (error) throw error;
        const userName = user?.email || "Unknown";
        await logAction("Founders-Tracking", "INSERT", data.id, null, payload, userName);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founders_tracking"] });
      setDialogOpen(false);
      toast.success(isEditing ? "Update saved" : "Progress logged");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const oldEntry = allTracking.find((t) => t.id === id);
      const { error } = await supabase.from("founders_tracking").delete().eq("id", id);
      if (error) throw error;
      const userName = user?.email || "Unknown";
      await logAction("Founders-Tracking", "DELETE", id, oldEntry as any, null, userName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founders_tracking"] });
      toast.success("Record deleted");
      setDeleteTarget(null);
    },
    onError: (e) => {
      toast.error(e.message);
      setDeleteTarget(null);
    },
  });

  const founderTracking = selectedFounder
    ? allTracking.filter((t) => t.founder_id === selectedFounder)
    : [];

  const selectedFounderObj = founders.find((f) => f.id === selectedFounder);

  const grouped = founderTracking.reduce((acc, t) => {
    const month = t.tracking_date ? format(parseISO(t.tracking_date), "MMMM yyyy") : "Unknown";
    if (!acc[month]) acc[month] = [];
    acc[month].push(t);
    return acc;
  }, {} as Record<string, Tracking[]>);

  function openNewTracking() {
    setForm(emptyForm(selectedFounder));
    setDialogOpen(true);
  }

  function openEditTracking(entry: Tracking) {
    setForm({
      id: entry.id,
      founder_id: entry.founder_id || selectedFounder,
      tracking_date: entry.tracking_date || new Date().toISOString().split("T")[0],
      product_dev_rating: entry.product_dev_rating || 0,
      product_dev_update: entry.product_dev_update || "",
      clients_traction_rating: entry.clients_traction_rating || 0,
      clients_traction_update: entry.clients_traction_update || "",
      team_structure_rating: entry.team_structure_rating || 0,
      team_structure_update: entry.team_structure_update || "",
      market_presence_rating: entry.market_presence_rating || 0,
      market_presence_update: entry.market_presence_update || "",
      funding_update_rating: entry.funding_update_rating || 0,
      funding_update: entry.funding_update || "",
      other_updates: entry.other_updates || "",
    });
    setDialogOpen(true);
  }

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Progress Tracker</h1>
          <p className="text-sm text-muted-foreground">Weekly founder progress updates</p>
        </div>
        {selectedFounder && (
          <Button onClick={openNewTracking}><Plus className="mr-2 h-4 w-4" /> Log Update</Button>
        )}
      </div>

      <div className="space-y-2">
        <Label>Select Founder</Label>
        <Select value={selectedFounder} onValueChange={setSelectedFounder}>
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder="Choose a founder..." />
          </SelectTrigger>
          <SelectContent>
            {founders.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.founder_name} — {f.startup_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedFounder && (
        <div className="space-y-4">
          {Object.keys(grouped).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No progress updates yet for {selectedFounderObj?.founder_name}.
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" defaultValue={Object.keys(grouped).slice(0, 2)}>
              {Object.entries(grouped).map(([month, entries]) => (
                <AccordionItem key={month} value={month}>
                  <AccordionTrigger className="text-lg font-semibold">{month}</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      {entries.map((entry) => (
                        <Card key={entry.id} className="shadow-sm">
                          <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              {entry.tracking_date ? format(parseISO(entry.tracking_date), "EEEE, MMM d, yyyy") : "Unknown date"}
                            </CardTitle>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditTracking(entry)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(entry.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {AREAS.map((area) => {
                              const rating = (entry as any)[`${area.key}_rating`];
                              const update = (entry as any)[area.key === "funding_update" ? "funding_update" : `${area.key}_update`];
                              return (
                                <div key={area.key} className="flex items-start gap-3">
                                  <div className="w-40 shrink-0">
                                    <p className="text-xs font-medium text-muted-foreground">{area.label}</p>
                                    <StarRating value={rating || 0} readOnly size={14} />
                                  </div>
                                  <p className="text-sm text-foreground/80">{update || "—"}</p>
                                </div>
                              );
                            })}
                            {entry.other_updates && (
                              <div className="pt-2 border-t">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Other Notes</p>
                                <p className="text-sm">{entry.other_updates}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Progress Update" : "Log Progress Update"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.tracking_date} onChange={(e) => setForm((f) => ({ ...f, tracking_date: e.target.value }))} />
            </div>
            {AREAS.map((area) => (
              <div key={area.key} className="space-y-2">
                <Label>{area.label}</Label>
                <StarRating
                  value={(form as any)[`${area.key}_rating`]}
                  onChange={(v) => setForm((f) => ({ ...f, [`${area.key}_rating`]: v }))}
                />
                <Textarea
                  placeholder={`Update on ${area.label.toLowerCase()}...`}
                  rows={2}
                  value={(form as any)[area.key === "funding_update" ? "funding_update" : `${area.key}_update`]}
                  onChange={(e) => setForm((f) => ({ ...f, [area.key === "funding_update" ? "funding_update" : `${area.key}_update`]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Other Notes</Label>
              <Textarea rows={2} value={form.other_updates} onChange={(e) => setForm((f) => ({ ...f, other_updates: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.founder_id || saveMutation.isPending}>
              {isEditing ? "Save Changes" : "Log Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete this progress update.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
