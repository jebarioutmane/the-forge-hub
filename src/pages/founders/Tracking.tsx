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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StarRating } from "@/components/StarRating";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, ExternalLink, Link as LinkIcon, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatUrl } from "@/lib/formatUrl";
import { getCurrentCohortYear } from "@/lib/cohortYears";
import { CohortSelect } from "@/components/CohortSelect";
import type { Tables } from "@/integrations/supabase/types";

type Founder = Tables<"founders">;
type Checkin = Tables<"founder_checkins">;
type Evaluation = Tables<"founder_evaluations">;

const AREAS = [
  { key: "product", label: "Product" },
  { key: "team", label: "Team" },
  { key: "traction", label: "Traction" },
  { key: "market", label: "Market" },
  { key: "funding", label: "Funding" },
] as const;

const EFFORT_OPTIONS = [
  { value: "strong", label: "Strong", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "steady", label: "Steady", color: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "coasting", label: "Coasting", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "at_risk", label: "At Risk", color: "bg-rose-100 text-rose-700 border-rose-200" },
] as const;

const DECISION_OPTIONS = [
  { value: "stay", label: "Stay", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "at_risk", label: "At Risk", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "exit", label: "Exit", color: "bg-rose-100 text-rose-700 border-rose-200" },
] as const;

type LinkItem = { title: string; url: string };

type CheckinForm = {
  id?: string;
  checkin_type: "weekly" | "one_on_one";
  checkin_date: string;
  effort_signal: string;
  product_rating: number; product_note: string;
  team_rating: number; team_note: string;
  traction_rating: number; traction_note: string;
  market_rating: number; market_note: string;
  funding_rating: number; funding_note: string;
  notes: string;
  links: LinkItem[];
};

const emptyCheckin = (): CheckinForm => ({
  checkin_type: "weekly",
  checkin_date: new Date().toISOString().split("T")[0],
  effort_signal: "steady",
  product_rating: 0, product_note: "",
  team_rating: 0, team_note: "",
  traction_rating: 0, traction_note: "",
  market_rating: 0, market_note: "",
  funding_rating: 0, funding_note: "",
  notes: "",
  links: [],
});

type EvalForm = {
  id?: string;
  block_name: string;
  evaluation_date: string;
  execution_score: number;
  traction_score: number;
  momentum_score: number;
  overall_confidence: number;
  decision: string;
};

const emptyEval = (): EvalForm => ({
  block_name: "",
  evaluation_date: new Date().toISOString().split("T")[0],
  execution_score: 0,
  traction_score: 0,
  momentum_score: 0,
  overall_confidence: 0,
  decision: "stay",
});

function effortBadge(value: string | null | undefined) {
  const opt = EFFORT_OPTIONS.find((o) => o.value === value);
  if (!opt) return null;
  return <Badge className={`text-[10px] font-medium border ${opt.color}`}>{opt.label}</Badge>;
}

function decisionBadge(value: string | null | undefined) {
  const opt = DECISION_OPTIONS.find((o) => o.value === value);
  if (!opt) return null;
  return <Badge className={`text-[10px] font-medium border ${opt.color}`}>{opt.label}</Badge>;
}

function LinksEditor({ links, onChange }: { links: LinkItem[]; onChange: (v: LinkItem[]) => void }) {
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input placeholder="Title" value={l.title} onChange={(e) => onChange(links.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} className="h-8 text-xs flex-1" />
          <Input placeholder="https://..." value={l.url} onChange={(e) => onChange(links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} className="h-8 text-xs flex-1" />
          <button type="button" onClick={() => onChange(links.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...links, { title: "", url: "" }])} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
        <LinkIcon className="h-3 w-3" /> Add link
      </button>
    </div>
  );
}

function LinksDisplay({ links }: { links: LinkItem[] }) {
  if (!links || links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {links.map((l, i) => (
        <a key={i} href={formatUrl(l.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md hover:bg-primary/20">
          <ExternalLink className="h-3 w-3" />
          {l.title || l.url}
        </a>
      ))}
    </div>
  );
}

export default function FounderTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cohortYear, setCohortYear] = useState(getCurrentCohortYear());
  const [selectedFounder, setSelectedFounder] = useState("");

  // Check-in state
  const [checkinDialog, setCheckinDialog] = useState(false);
  const [checkinForm, setCheckinForm] = useState<CheckinForm>(emptyCheckin());
  const [deleteCheckinId, setDeleteCheckinId] = useState<string | null>(null);

  // Evaluation state
  const [evalDialog, setEvalDialog] = useState(false);
  const [evalForm, setEvalForm] = useState<EvalForm>(emptyEval());
  const [deleteEvalId, setDeleteEvalId] = useState<string | null>(null);

  const { data: allFounders = [] } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("*").order("founder_name");
      if (error) throw error;
      return data;
    },
  });

  const founders = useMemo(
    () => allFounders.filter((f) => f.cohort_year === cohortYear),
    [allFounders, cohortYear],
  );

  const { data: checkins = [] } = useQuery({
    queryKey: ["founder_checkins", selectedFounder],
    enabled: !!selectedFounder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_checkins")
        .select("*")
        .eq("founder_id", selectedFounder)
        .order("checkin_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ["founder_evaluations", selectedFounder],
    enabled: !!selectedFounder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_evaluations")
        .select("*")
        .eq("founder_id", selectedFounder)
        .order("evaluation_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: engagement } = useQuery({
    queryKey: ["founder_engagement", selectedFounder],
    enabled: !!selectedFounder,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("founder_engagement")
        .select("*")
        .eq("founder_id", selectedFounder)
        .maybeSingle();
      if (error) throw error;
      return data as { risk_status: string | null; attendance_rate: number | null; last_checkin_date: string | null } | null;
    },
  });

  const selectedFounderObj = founders.find((f) => f.id === selectedFounder);

  /* ─── Check-in mutations ─── */
  const saveCheckin = useMutation({
    mutationFn: async () => {
      const payload: any = {
        founder_id: selectedFounder,
        associate_id: user?.id ?? null,
        checkin_type: checkinForm.checkin_type,
        checkin_date: checkinForm.checkin_date,
        effort_signal: checkinForm.effort_signal,
        product_rating: checkinForm.product_rating || null,
        product_note: checkinForm.product_note || null,
        team_rating: checkinForm.team_rating || null,
        team_note: checkinForm.team_note || null,
        traction_rating: checkinForm.traction_rating || null,
        traction_note: checkinForm.traction_note || null,
        market_rating: checkinForm.market_rating || null,
        market_note: checkinForm.market_note || null,
        funding_rating: checkinForm.funding_rating || null,
        funding_note: checkinForm.funding_note || null,
        notes: checkinForm.notes || null,
        links: checkinForm.links.filter((l) => l.url),
      };
      if (checkinForm.id) {
        const { error } = await supabase.from("founder_checkins").update(payload).eq("id", checkinForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("founder_checkins").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founder_checkins"] });
      queryClient.invalidateQueries({ queryKey: ["founder_engagement"] });
      setCheckinDialog(false);
      toast.success(checkinForm.id ? "Check-in updated" : "Check-in saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCheckin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("founder_checkins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founder_checkins"] });
      queryClient.invalidateQueries({ queryKey: ["founder_engagement"] });
      setDeleteCheckinId(null);
      toast.success("Check-in deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNewCheckin() {
    setCheckinForm(emptyCheckin());
    setCheckinDialog(true);
  }

  function openEditCheckin(c: Checkin) {
    const links = Array.isArray(c.links) ? (c.links as unknown as LinkItem[]) : [];
    setCheckinForm({
      id: c.id,
      checkin_type: (c.checkin_type as "weekly" | "one_on_one") || "weekly",
      checkin_date: c.checkin_date || new Date().toISOString().split("T")[0],
      effort_signal: c.effort_signal || "steady",
      product_rating: c.product_rating || 0, product_note: c.product_note || "",
      team_rating: c.team_rating || 0, team_note: c.team_note || "",
      traction_rating: c.traction_rating || 0, traction_note: c.traction_note || "",
      market_rating: c.market_rating || 0, market_note: c.market_note || "",
      funding_rating: c.funding_rating || 0, funding_note: c.funding_note || "",
      notes: c.notes || "",
      links,
    });
    setCheckinDialog(true);
  }

  /* ─── Evaluation mutations ─── */
  const saveEval = useMutation({
    mutationFn: async () => {
      const payload: any = {
        founder_id: selectedFounder,
        block_name: evalForm.block_name,
        evaluation_date: evalForm.evaluation_date,
        execution_score: evalForm.execution_score,
        traction_score: evalForm.traction_score,
        momentum_score: evalForm.momentum_score,
        overall_confidence: evalForm.overall_confidence,
        decision: evalForm.decision,
        total_score: Math.round(((evalForm.execution_score || 0) + (evalForm.traction_score || 0) + (evalForm.momentum_score || 0)) / 3),
      };
      if (evalForm.id) {
        const { error } = await supabase.from("founder_evaluations").update(payload).eq("id", evalForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("founder_evaluations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founder_evaluations"] });
      setEvalDialog(false);
      toast.success(evalForm.id ? "Evaluation updated" : "Evaluation saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEval = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("founder_evaluations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founder_evaluations"] });
      setDeleteEvalId(null);
      toast.success("Evaluation deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNewEval() {
    setEvalForm(emptyEval());
    setEvalDialog(true);
  }

  function openEditEval(ev: Evaluation) {
    setEvalForm({
      id: ev.id,
      block_name: ev.block_name || "",
      evaluation_date: ev.evaluation_date || new Date().toISOString().split("T")[0],
      execution_score: Number(ev.execution_score) || 0,
      traction_score: Number(ev.traction_score) || 0,
      momentum_score: Number(ev.momentum_score) || 0,
      overall_confidence: ev.overall_confidence || 0,
      decision: (ev as any).decision || "stay",
    });
    setEvalDialog(true);
  }

  const riskStyles: Record<string, string> = {
    on_track: "bg-emerald-100 text-emerald-700 border-emerald-200",
    watch: "bg-amber-100 text-amber-700 border-amber-200",
    at_risk: "bg-rose-100 text-rose-700 border-rose-200",
  };
  const riskLabels: Record<string, string> = {
    on_track: "On Track",
    watch: "Watch",
    at_risk: "At Risk",
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Founder Tracking</h1>
        <p className="text-sm text-muted-foreground">Check-ins and block-end evaluations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cohort Year</Label>
          <CohortSelect value={cohortYear} onChange={(v) => { setCohortYear(v); setSelectedFounder(""); }} placeholder="Select year" />
        </div>
        <div className="space-y-2">
          <Label>Founder</Label>
          <Select value={selectedFounder} onValueChange={setSelectedFounder}>
            <SelectTrigger><SelectValue placeholder="Choose a founder..." /></SelectTrigger>
            <SelectContent>
              {founders.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.founder_name} — {f.startup_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedFounder && (
        <>
          {/* Engagement summary */}
          <Card>
            <CardContent className="p-4 flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">Founder</p>
                <p className="font-medium">{selectedFounderObj?.founder_name} · {selectedFounderObj?.startup_name}</p>
              </div>
              {engagement?.risk_status && (
                <Badge className={`border ${riskStyles[engagement.risk_status] || ""}`}>
                  {riskLabels[engagement.risk_status] || engagement.risk_status}
                </Badge>
              )}
              {engagement?.attendance_rate != null && (
                <Badge variant="outline">Attendance {Math.round(Number(engagement.attendance_rate) * 100)}%</Badge>
              )}
              {engagement?.last_checkin_date && (
                <span className="text-xs text-muted-foreground">Last check-in {format(parseISO(engagement.last_checkin_date), "MMM d, yyyy")}</span>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="checkins">
            <TabsList>
              <TabsTrigger value="checkins">Check-Ins ({checkins.length})</TabsTrigger>
              <TabsTrigger value="evaluations">Block Evaluations ({evaluations.length})</TabsTrigger>
            </TabsList>

            {/* ─── Check-ins tab ─── */}
            <TabsContent value="checkins" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={openNewCheckin}><Plus className="mr-2 h-4 w-4" /> New Check-In</Button>
              </div>

              {checkins.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No check-ins yet.</CardContent></Card>
              ) : (
                <div className="relative border-l border-border ml-3 space-y-4 pl-6">
                  {checkins.map((c) => (
                    <div key={c.id} className="relative">
                      <span className="absolute -left-[30px] top-3 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-sm font-medium">
                              {c.checkin_date ? format(parseISO(c.checkin_date), "EEE, MMM d, yyyy") : "—"}
                            </CardTitle>
                            <Badge variant="outline" className="text-[10px]">{c.checkin_type === "one_on_one" ? "1:1" : "Weekly"}</Badge>
                            {effortBadge(c.effort_signal)}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditCheckin(c)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteCheckinId(c.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {AREAS.map((a) => {
                            const rating = (c as any)[`${a.key}_rating`];
                            const note = (c as any)[`${a.key}_note`];
                            if (!rating && !note) return null;
                            return (
                              <div key={a.key} className="flex items-start gap-3">
                                <div className="w-24 shrink-0">
                                  <p className="text-xs font-medium text-muted-foreground">{a.label}</p>
                                  <StarRating value={rating || 0} readOnly size={12} />
                                </div>
                                <p className="text-sm text-foreground/80 flex-1">{note || "—"}</p>
                              </div>
                            );
                          })}
                          {c.notes && (
                            <div className="pt-2 border-t">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Overall notes</p>
                              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{c.notes}</p>
                            </div>
                          )}
                          <LinksDisplay links={(Array.isArray(c.links) ? c.links : []) as unknown as LinkItem[]} />
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── Evaluations tab ─── */}
            <TabsContent value="evaluations" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={openNewEval}><Plus className="mr-2 h-4 w-4" /> New Block Evaluation</Button>
              </div>

              {evaluations.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No block evaluations yet.</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {evaluations.map((ev) => (
                    <Card key={ev.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{ev.block_name || "Block"}</span>
                            <span className="text-xs text-muted-foreground">
                              {ev.evaluation_date ? format(parseISO(ev.evaluation_date), "MMM d, yyyy") : ""}
                            </span>
                            {decisionBadge((ev as any).decision)}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditEval(ev)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteEvalId(ev.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div><span className="text-muted-foreground">Execution:</span> <span className="font-semibold">{ev.execution_score ?? "—"}</span></div>
                          <div><span className="text-muted-foreground">Traction:</span> <span className="font-semibold">{ev.traction_score ?? "—"}</span></div>
                          <div><span className="text-muted-foreground">Momentum:</span> <span className="font-semibold">{ev.momentum_score ?? "—"}</span></div>
                          <div><span className="text-muted-foreground">Confidence:</span> <span className="font-semibold">{ev.overall_confidence ?? "—"}/5</span></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ─── Check-in Dialog ─── */}
      <Dialog open={checkinDialog} onOpenChange={setCheckinDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{checkinForm.id ? "Edit Check-In" : "New Check-In"}</DialogTitle>
            <DialogDescription className="sr-only">Record a weekly snapshot or 1:1 for this founder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={checkinForm.checkin_type} onValueChange={(v: any) => setCheckinForm({ ...checkinForm, checkin_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly Snapshot</SelectItem>
                    <SelectItem value="one_on_one">One-on-One</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={checkinForm.checkin_date} onChange={(e) => setCheckinForm({ ...checkinForm, checkin_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Effort Signal</Label>
                <Select value={checkinForm.effort_signal} onValueChange={(v) => setCheckinForm({ ...checkinForm, effort_signal: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EFFORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              {AREAS.map((a) => (
                <Card key={a.key}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold">{a.label}</Label>
                      <StarRating
                        value={(checkinForm as any)[`${a.key}_rating`]}
                        onChange={(v) => setCheckinForm({ ...checkinForm, [`${a.key}_rating`]: v } as any)}
                      />
                    </div>
                    <Textarea
                      rows={2}
                      placeholder={`Notes on ${a.label.toLowerCase()}...`}
                      value={(checkinForm as any)[`${a.key}_note`]}
                      onChange={(e) => setCheckinForm({ ...checkinForm, [`${a.key}_note`]: e.target.value } as any)}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Overall Notes</Label>
              <Textarea rows={3} value={checkinForm.notes} onChange={(e) => setCheckinForm({ ...checkinForm, notes: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Links</Label>
              <LinksEditor links={checkinForm.links} onChange={(v) => setCheckinForm({ ...checkinForm, links: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinDialog(false)}>Cancel</Button>
            <Button onClick={() => saveCheckin.mutate()}>{checkinForm.id ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Evaluation Dialog ─── */}
      <Dialog open={evalDialog} onOpenChange={setEvalDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{evalForm.id ? "Edit Block Evaluation" : "New Block Evaluation"}</DialogTitle>
            <DialogDescription className="sr-only">Formal block-end evaluation with scores and decision.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Block Name</Label>
                <Input placeholder="e.g. Block 1 – Validation" value={evalForm.block_name} onChange={(e) => setEvalForm({ ...evalForm, block_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={evalForm.evaluation_date} onChange={(e) => setEvalForm({ ...evalForm, evaluation_date: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Execution (0-100)</Label>
                <Input type="number" min={0} max={100} value={evalForm.execution_score} onChange={(e) => setEvalForm({ ...evalForm, execution_score: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Traction (0-100)</Label>
                <Input type="number" min={0} max={100} value={evalForm.traction_score} onChange={(e) => setEvalForm({ ...evalForm, traction_score: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Momentum (0-100)</Label>
                <Input type="number" min={0} max={100} value={evalForm.momentum_score} onChange={(e) => setEvalForm({ ...evalForm, momentum_score: Number(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Confidence (1-5)</Label>
                <StarRating value={evalForm.overall_confidence} onChange={(v) => setEvalForm({ ...evalForm, overall_confidence: v })} />
              </div>
              <div className="space-y-2">
                <Label>Decision</Label>
                <Select value={evalForm.decision} onValueChange={(v) => setEvalForm({ ...evalForm, decision: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DECISION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvalDialog(false)}>Cancel</Button>
            <Button onClick={() => saveEval.mutate()} disabled={!evalForm.block_name}>{evalForm.id ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteCheckinId} onConfirm={() => deleteCheckinId && deleteCheckin.mutate(deleteCheckinId)} onCancel={() => setDeleteCheckinId(null)} />
      <ConfirmDeleteDialog open={!!deleteEvalId} onConfirm={() => deleteEvalId && deleteEval.mutate(deleteEvalId)} onCancel={() => setDeleteEvalId(null)} />
    </div>
  );
}
