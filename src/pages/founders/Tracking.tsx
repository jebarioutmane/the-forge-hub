import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { StarRating } from "@/components/StarRating";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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

export default function FoundersTracking() {
  const queryClient = useQueryClient();
  const [selectedFounder, setSelectedFounder] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    founder_id: "",
    tracking_date: new Date().toISOString().split("T")[0],
    product_dev_rating: 0, product_dev_update: "",
    clients_traction_rating: 0, clients_traction_update: "",
    team_structure_rating: 0, team_structure_update: "",
    market_presence_rating: 0, market_presence_update: "",
    funding_update_rating: 0, funding_update: "",
    other_updates: "",
  });

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
      const { error } = await supabase.from("founders_tracking").insert({
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founders_tracking"] });
      setDialogOpen(false);
      toast.success("Progress logged");
    },
    onError: (e) => toast.error(e.message),
  });

  const founderTracking = selectedFounder
    ? allTracking.filter((t) => t.founder_id === selectedFounder)
    : [];

  const selectedFounderObj = founders.find((f) => f.id === selectedFounder);

  // Group tracking by month
  const grouped = founderTracking.reduce((acc, t) => {
    const month = t.tracking_date ? format(parseISO(t.tracking_date), "MMMM yyyy") : "Unknown";
    if (!acc[month]) acc[month] = [];
    acc[month].push(t);
    return acc;
  }, {} as Record<string, Tracking[]>);

  function openNewTracking() {
    setForm({
      founder_id: selectedFounder,
      tracking_date: new Date().toISOString().split("T")[0],
      product_dev_rating: 0, product_dev_update: "",
      clients_traction_rating: 0, clients_traction_update: "",
      team_structure_rating: 0, team_structure_update: "",
      market_presence_rating: 0, market_presence_update: "",
      funding_update_rating: 0, funding_update: "",
      other_updates: "",
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
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              {entry.tracking_date ? format(parseISO(entry.tracking_date), "EEEE, MMM d, yyyy") : "Unknown date"}
                            </CardTitle>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log Progress Update</DialogTitle></DialogHeader>
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
            <Button onClick={() => saveMutation.mutate()} disabled={!form.founder_id}>Log Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
