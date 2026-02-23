import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, GraduationCap, Eye, Pencil, Trash2, MoreHorizontal, Search, Phone, Mail } from "lucide-react";
import ViewDetailDialog from "@/components/ViewDetailDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { TagPicker } from "@/components/TagPicker";
import { TagBadges } from "@/components/TagBadges";
import { Progress } from "@/components/ui/progress";
import { COUNTRIES, getFlag } from "@/lib/countries";
import type { Tables } from "@/integrations/supabase/types";

type Founder = Tables<"founders">;

const COHORT_YEARS = ["2024", "2025", "2026"];

interface FounderForm {
  founder_name: string;
  startup_name: string;
  cohort: string;
  venture_associate: string;
  nationality: string;
  phone: string;
  email: string;
  status: string;
  description: string;
  tag_ids: string[];
}

const emptyForm: FounderForm = {
  founder_name: "", startup_name: "", cohort: "", venture_associate: "",
  nationality: "", phone: "", email: "", status: "", description: "", tag_ids: [],
};

export default function FoundersSource() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Founder | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Founder | null>(null);
  const [form, setForm] = useState<FounderForm>(emptyForm);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCohort, setFilterCohort] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: founders = [], isLoading } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("*").order("founder_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tracking = [] } = useQuery({
    queryKey: ["founders_tracking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders_tracking").select("*").order("tracking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Derive unique values for filter dropdowns
  const uniqueCohorts = useMemo(() => [...new Set(founders.map(f => f.cohort).filter(Boolean))].sort(), [founders]);
  const uniqueCountries = useMemo(() => [...new Set(founders.map(f => f.nationality).filter(Boolean))].sort(), [founders]);
  const uniqueStatuses = useMemo(() => [...new Set(founders.map(f => f.status).filter(Boolean))].sort(), [founders]);

  // Filtered founders
  const filtered = useMemo(() => {
    return founders.filter((f) => {
      const q = search.toLowerCase();
      if (q && !f.founder_name.toLowerCase().includes(q) && !f.startup_name.toLowerCase().includes(q)) return false;
      if (filterCohort !== "all" && f.cohort !== filterCohort) return false;
      if (filterCountry !== "all" && f.nationality !== filterCountry) return false;
      if (filterStatus !== "all" && f.status !== filterStatus) return false;
      return true;
    });
  }, [founders, search, filterCohort, filterCountry, filterStatus]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        founder_name: form.founder_name,
        startup_name: form.startup_name,
        cohort: form.cohort || null,
        venture_associate: form.venture_associate || null,
        nationality: form.nationality || null,
        phone: form.phone || null,
        email: form.email || null,
        status: form.status || null,
        description: form.description || null,
        tag_ids: form.tag_ids,
      };
      if (editing) {
        const { error } = await supabase.from("founders").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("founders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founders"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Founder updated" : "Founder added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("founders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founders"] });
      setDeleteId(null);
      toast.success("Founder deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function openEdit(f: Founder) {
    setForm({
      founder_name: f.founder_name,
      startup_name: f.startup_name,
      cohort: f.cohort || "",
      venture_associate: f.venture_associate || "",
      nationality: f.nationality || "",
      phone: f.phone || "",
      email: f.email || "",
      status: f.status || "",
      description: f.description || "",
      tag_ids: (f.tag_ids as string[]) || [],
    });
    setEditing(f);
    setDialogOpen(true);
  }

  function getLatestScore(founderId: string) {
    const latest = tracking.find((t) => t.founder_id === founderId);
    if (!latest) return 0;
    const scores = [
      latest.product_dev_rating, latest.clients_traction_rating,
      latest.team_structure_rating, latest.market_presence_rating, latest.funding_update_rating,
    ].filter((s): s is number => s !== null);
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 20);
  }

  const set = (key: keyof FounderForm, val: string | string[]) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Founders Directory</h1>
          <p className="text-sm text-muted-foreground">Manage founders and track their progress</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Founder
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or startup..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterCohort} onValueChange={setFilterCohort}>
              <SelectTrigger><SelectValue placeholder="All Cohorts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cohorts</SelectItem>
                {uniqueCohorts.map((c) => <SelectItem key={c} value={c!}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCountry} onValueChange={setFilterCountry}>
              <SelectTrigger><SelectValue placeholder="All Countries" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {uniqueCountries.map((c) => <SelectItem key={c} value={c!}>{getFlag(c)} {c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map((s) => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">{filtered.length} founder{filtered.length !== 1 ? "s" : ""} found</p>

      {/* Grid */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading founders...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No founders match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((f) => {
            const score = getLatestScore(f.id);
            const flag = getFlag(f.nationality);
            return (
              <Card key={f.id} className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border relative overflow-hidden">
                <CardContent className="p-5">
                  {/* Flag in corner */}
                  {flag && (
                    <span className="absolute top-3 right-3 text-2xl leading-none" title={f.nationality || ""}>{flag}</span>
                  )}

                  {/* Avatar + Actions */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-11 w-11 rounded-full bg-module-founders/10 flex items-center justify-center text-module-founders font-bold text-base">
                      {f.founder_name.charAt(0).toUpperCase()}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewing(f)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(f)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(f.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Name & Startup */}
                  <h3 className="font-bold text-sm mb-0.5 truncate pr-8">{f.founder_name}</h3>
                  <p className="text-xs text-muted-foreground mb-2 truncate">{f.startup_name}</p>

                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {f.cohort && <Badge variant="outline" className="text-[10px] font-medium">{f.cohort}</Badge>}
                    {f.status && (
                      <Badge className="text-[10px] bg-module-founders/10 text-module-founders border-module-founders/20 hover:bg-module-founders/20">{f.status}</Badge>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Progress Score</span>
                      <span className="font-semibold">{score}%</span>
                    </div>
                    <Progress value={score} className="h-1.5" />
                  </div>

                  {/* Tags */}
                  <TagBadges tagIds={f.tag_ids as string[] | null} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Founder" : "New Founder"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={form.founder_name} onChange={(e) => set("founder_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Startup Name *</Label>
                <Input value={form.startup_name} onChange={(e) => set("startup_name", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cohort Year</Label>
                <Select value={form.cohort} onValueChange={(v) => set("cohort", v)}>
                  <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                  <SelectContent>
                    {COHORT_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Venture Associate</Label>
                <Input value={form.venture_associate} onChange={(e) => set("venture_associate", e.target.value)} placeholder="Assigned VA" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nationality</Label>
                <Select value={form.nationality} onValueChange={(v) => set("nationality", v)}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{getFlag(c)} {c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Input value={form.status} onChange={(e) => set("status", e.target.value)} placeholder="e.g. Active, Dismissed" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+212..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description / Business Idea</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Brief description of the startup..." />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagPicker value={form.tag_ids} onChange={(ids) => set("tag_ids", ids)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editing && (
              <Button variant="destructive" size="sm" onClick={() => { setDialogOpen(false); setDeleteId(editing.id); }}>Delete</Button>
            )}
            <Button onClick={() => saveMutation.mutate()} disabled={!form.founder_name || !form.startup_name}>
              {editing ? "Save Changes" : "Add Founder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />

      <ViewDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Founder Details"
        fields={viewing ? [
          { label: "Name", value: viewing.founder_name },
          { label: "Startup", value: viewing.startup_name },
          { label: "Cohort", value: viewing.cohort },
          { label: "Nationality", value: viewing.nationality ? `${getFlag(viewing.nationality)} ${viewing.nationality}` : null },
          { label: "Status", value: viewing.status },
          { label: "Venture Associate", value: viewing.venture_associate },
          { label: "Email", value: viewing.email },
          { label: "Phone", value: viewing.phone },
          { label: "Description", value: viewing.description },
          { label: "Tags", value: <TagBadges tagIds={viewing.tag_ids as string[] | null} /> },
          { label: "Score", value: `${getLatestScore(viewing.id)}%` },
        ] : []}
      />
    </div>
  );
}
