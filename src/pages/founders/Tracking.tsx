import { useState, useMemo } from "react";
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
import { Plus, MoreHorizontal, Pencil, Trash2, ExternalLink, Link as LinkIcon, X } from "lucide-react";
import { logAction } from "@/lib/logAction";
import { format, parseISO } from "date-fns";
import { formatUrl } from "@/lib/formatUrl";
import { FounderSparkline } from "@/components/FounderSparkline";
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

type EvidenceLink = { title: string; url: string };
type SectionLinks = Record<string, EvidenceLink[]>;

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
  section_links: SectionLinks;
  overall_score: number;
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
  section_links: {},
  overall_score: 0,
});

function SectionLinkEditor({ sectionKey, links, onChange }: { sectionKey: string; links: EvidenceLink[]; onChange: (links: EvidenceLink[]) => void }) {
  const [adding, setAdding] = useState(false);

  const addLink = () => {
    onChange([...links, { title: "", url: "" }]);
    setAdding(true);
  };

  const updateLink = (idx: number, field: "title" | "url", value: string) => {
    const updated = links.map((l, i) => i === idx ? { ...l, [field]: value } : l);
    onChange(updated);
  };

  const removeLink = (idx: number) => {
    onChange(links.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {links.map((link, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            placeholder="Link title"
            value={link.title}
            onChange={(e) => updateLink(idx, "title", e.target.value)}
            className="h-7 text-xs flex-1"
          />
          <Input
            placeholder="https://..."
            value={link.url}
            onChange={(e) => updateLink(idx, "url", e.target.value)}
            className="h-7 text-xs flex-1"
          />
          <button type="button" onClick={() => removeLink(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addLink}
        className="inline-flex items-center gap-1 text-xs text-[#0071E3] hover:underline"
      >
        <LinkIcon className="h-3 w-3" /> + Add Evidence Link
      </button>
    </div>
  );
}

function EvidenceLinkDisplay({ links }: { links: EvidenceLink[] }) {
  if (!links || links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {links.map((link, idx) => (
        <a
          key={idx}
          href={formatUrl(link.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[13px] text-[#0071E3] bg-[#0071E3]/10 px-2 py-1 rounded-md hover:bg-[#0071E3]/20 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {link.title || link.url}
        </a>
      ))}
    </div>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  const colorClass = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-500" : "text-red-500";
  return (
    <div className="border-t pt-3 mt-3 flex items-center justify-end gap-2">
      <span className="text-xs font-medium text-[#6E6E73]">Overall Score</span>
      <span className={`text-2xl font-bold ${colorClass}`}>{score}</span>
      <span className="text-sm font-medium text-[#6E6E73]">/100</span>
    </div>
  );
}

const COHORT_YEARS = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

export default function FoundersTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFounder, setSelectedFounder] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(""));
  const [cohortYear, setCohortYear] = useState(new Date().getFullYear().toString());

  const isEditing = !!form.id;

  const { data: allFounders = [] } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("*").order("founder_name");
      if (error) throw error;
      return data;
    },
  });

  const founders = useMemo(() => allFounders.filter(f => f.cohort_year === cohortYear), [allFounders, cohortYear]);

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
      // Auto-calculate score from star ratings (5 areas × 5 stars = 25 max → scale to 100)
      const totalStars = (form.product_dev_rating || 0) + (form.clients_traction_rating || 0) + (form.team_structure_rating || 0) + (form.market_presence_rating || 0) + (form.funding_update_rating || 0);
      const calculatedScore = Math.round((totalStars / 25) * 100);
      // Always use star-based calculation; manual field is display-only
      const finalScore = calculatedScore;

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
        section_links: form.section_links as any,
        overall_score: finalScore,
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
    const sectionLinks = (entry.section_links || {}) as SectionLinks;
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
      section_links: sectionLinks,
      overall_score: entry.overall_score || 0,
    });
    setDialogOpen(true);
  }

  function getSectionLinks(entry: Tracking, areaKey: string): EvidenceLink[] {
    if (!entry.section_links || typeof entry.section_links !== "object") return [];
    const links = entry.section_links as SectionLinks;
    return links[areaKey] || [];
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cohort Year</Label>
          <Select value={cohortYear} onValueChange={(v) => { setCohortYear(v); setSelectedFounder(""); }}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {COHORT_YEARS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>

      {selectedFounder && (() => {
        const chronoTracking = [...founderTracking].sort((a, b) =>
          (a.tracking_date || "").localeCompare(b.tracking_date || "")
        );
        const sparkScores = chronoTracking.map((t) => t.overall_score || 0);
        const sparkDates = chronoTracking.map((t) => t.tracking_date || "");

        return (
        <div className="space-y-4">
          {/* Consistency Pattern */}
          {sparkScores.length >= 2 && (
            <Card className="overflow-hidden">
              <CardContent className="py-4 px-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Consistency Pattern</p>
                  <p className="text-sm font-semibold text-foreground truncate">{selectedFounderObj?.founder_name}</p>
                </div>
                <FounderSparkline
                  scores={sparkScores}
                  dates={sparkDates}
                  width={200}
                  height={48}
                />
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-foreground">{sparkScores[sparkScores.length - 1]}</p>
                  <p className="text-[10px] text-muted-foreground">Latest Score</p>
                </div>
              </CardContent>
            </Card>
          )}
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
                              const links = getSectionLinks(entry, area.key);
                              return (
                                <div key={area.key}>
                                  <div className="flex items-start gap-3">
                                    <div className="w-40 shrink-0">
                                      <p className="text-xs font-medium text-muted-foreground">{area.label}</p>
                                      <StarRating value={rating || 0} readOnly size={14} />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm text-foreground/80">{update || "—"}</p>
                                      <EvidenceLinkDisplay links={links} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {entry.other_updates && (
                              <div className="pt-2 border-t">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Other Notes</p>
                                <p className="text-sm">{entry.other_updates}</p>
                              </div>
                            )}
                            <ScoreBadge score={entry.overall_score} />
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
        );
      })()}

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
                <SectionLinkEditor
                  sectionKey={area.key}
                  links={(form.section_links || {})[area.key] || []}
                  onChange={(links) => setForm((f) => ({ ...f, section_links: { ...(f.section_links || {}), [area.key]: links } }))}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Other Notes</Label>
              <Textarea rows={2} value={form.other_updates} onChange={(e) => setForm((f) => ({ ...f, other_updates: e.target.value }))} />
            </div>
            <div className="border-t pt-4 flex items-center justify-between">
              <Label className="text-muted-foreground">Overall Score (auto-calculated)</Label>
              <span className="text-2xl font-bold tabular-nums">
                {Math.round((((form.product_dev_rating || 0) + (form.clients_traction_rating || 0) + (form.team_structure_rating || 0) + (form.market_presence_rating || 0) + (form.funding_update_rating || 0)) / 25) * 100)}
                <span className="text-sm font-medium text-muted-foreground">/100</span>
              </span>
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
