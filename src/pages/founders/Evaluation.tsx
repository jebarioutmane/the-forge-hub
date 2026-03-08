import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/logAction";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { StarRating } from "@/components/StarRating";
import { toast } from "sonner";
import { Plus, TrendingUp, Target, Zap, Activity, Eye, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  BLOCKS, SUPPORT_OPTIONS, calculateScores, getRiskTag,
  type CategoryData, type MetricData, type BlockConfig,
} from "@/config/evaluationBlocks";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import ViewDetailDialog from "@/components/ViewDetailDialog";

type Founder = Tables<"founders">;
type Evaluation = Tables<"founder_evaluations">;

function initCategoryData(block: BlockConfig): Record<string, CategoryData> {
  const data: Record<string, CategoryData> = {};
  block.categories.forEach((c) => {
    data[c.key] = { rating: 0, update: "", blockers: "", needs: "" };
  });
  return data;
}

function initMetricData(block: BlockConfig): Record<string, MetricData> {
  const data: Record<string, MetricData> = {};
  block.metrics.forEach((m) => {
    data[m.key] = { value: null, notes: "" };
  });
  return data;
}

export default function FounderEvaluation() {
  const queryClient = useQueryClient();
  const [selectedFounder, setSelectedFounder] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<string>("Block 1");
  const [evalDate, setEvalDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoriesData, setCategoriesData] = useState<Record<string, CategoryData>>({});
  const [metricsData, setMetricsData] = useState<Record<string, MetricData>>({});
  const [confidence, setConfidence] = useState(0);
  const [supportRequired, setSupportRequired] = useState<string[]>([]);
  const [editingEval, setEditingEval] = useState<Evaluation | null>(null);
  const [deleteEvalId, setDeleteEvalId] = useState<string | null>(null);
  const [viewingEval, setViewingEval] = useState<Evaluation | null>(null);

  const block = BLOCKS.find((b) => b.name === selectedBlock) || BLOCKS[0];

  const { data: founders = [] } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("*").order("founder_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ["founder_evaluations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founder_evaluations").select("*").order("evaluation_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const founderEvals = selectedFounder ? evaluations.filter((e) => e.founder_id === selectedFounder) : [];

  const scores = useMemo(() => calculateScores(categoriesData), [categoriesData]);

  const chartData = useMemo(() => {
    return founderEvals
      .slice()
      .reverse()
      .map((e) => ({
        date: e.evaluation_date ? format(parseISO(e.evaluation_date), "MMM d") : "?",
        score: e.total_score || 0,
      }));
  }, [founderEvals]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        founder_id: selectedFounder,
        block_name: selectedBlock,
        evaluation_date: evalDate,
        categories_data: categoriesData as unknown as Json,
        quantitative_metrics: metricsData as unknown as Json,
        execution_score: scores.execution,
        traction_score: scores.traction,
        momentum_score: scores.momentum,
        total_score: scores.total,
        overall_confidence: confidence,
        support_required: supportRequired,
      };
      if (editingEval) {
        const { error } = await supabase.from("founder_evaluations").update(payload).eq("id", editingEval.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("founder_evaluations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founder_evaluations"] });
      setDialogOpen(false);
      setEditingEval(null);
      toast.success(editingEval ? "Evaluation updated" : "Evaluation saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEvalMutation = useMutation({
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
    setEditingEval(null);
    const b = BLOCKS.find((bl) => bl.name === selectedBlock) || BLOCKS[0];
    setCategoriesData(initCategoryData(b));
    setMetricsData(initMetricData(b));
    setConfidence(0);
    setSupportRequired([]);
    setEvalDate(new Date().toISOString().split("T")[0]);
    setDialogOpen(true);
  }

  function openEditEval(ev: Evaluation) {
    setEditingEval(ev);
    setSelectedBlock(ev.block_name);
    setEvalDate(ev.evaluation_date || new Date().toISOString().split("T")[0]);
    setCategoriesData((ev.categories_data as unknown as Record<string, CategoryData>) || {});
    setMetricsData((ev.quantitative_metrics as unknown as Record<string, MetricData>) || {});
    setConfidence(ev.overall_confidence || 0);
    setSupportRequired((ev.support_required as string[]) || []);
    setDialogOpen(true);
  }

  function handleBlockChange(val: string) {
    setSelectedBlock(val);
    const b = BLOCKS.find((bl) => bl.name === val) || BLOCKS[0];
    setCategoriesData(initCategoryData(b));
    setMetricsData(initMetricData(b));
  }

  function toggleSupport(s: string) {
    setSupportRequired((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  const latestEval = founderEvals[0];
  const latestRisk = latestEval ? getRiskTag(latestEval.total_score || 0) : null;

  // Rank among cohort
  const founderLatestScores = useMemo(() => {
    const map = new Map<string, number>();
    evaluations.forEach((e) => {
      if (!map.has(e.founder_id)) map.set(e.founder_id, e.total_score || 0);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [evaluations]);

  const rank = founderLatestScores.findIndex(([id]) => id === selectedFounder) + 1;

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Founder Evaluations</h1>
          <p className="text-sm text-muted-foreground">Structured scoring by program block</p>
        </div>
        {selectedFounder && (
          <Button onClick={openNewEval}><Plus className="mr-2 h-4 w-4" /> New Evaluation</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Select Founder</Label>
          <Select value={selectedFounder} onValueChange={setSelectedFounder}>
            <SelectTrigger><SelectValue placeholder="Choose a founder..." /></SelectTrigger>
            <SelectContent>
              {founders.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.founder_name} — {f.startup_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Program Block</Label>
          <Select value={selectedBlock} onValueChange={setSelectedBlock}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BLOCKS.map((b) => (
                <SelectItem key={b.name} value={b.name}>{b.name} – {b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedFounder && (
        <>
          {/* Score summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground">Total Score</p>
                <p className="text-2xl font-bold text-primary">{latestEval?.total_score ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Target className="h-3 w-3" /> Execution</p>
                <p className="text-xl font-semibold">{latestEval?.execution_score ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3" /> Traction</p>
                <p className="text-xl font-semibold">{latestEval?.traction_score ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Zap className="h-3 w-3" /> Momentum</p>
                <p className="text-xl font-semibold">{latestEval?.momentum_score ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground">Rank</p>
                <p className="text-xl font-semibold">{rank > 0 ? `#${rank}` : "—"}</p>
                {latestRisk && (
                  <Badge className={`mt-1 text-white ${latestRisk.color}`}>{latestRisk.label}</Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Score over time chart */}
          {chartData.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Score Progress Over Time</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={{ score: { label: "Score", color: "hsl(var(--primary))" } }} className="h-[200px]">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* History */}
          <Accordion type="multiple" defaultValue={["recent"]}>
            <AccordionItem value="recent">
              <AccordionTrigger className="text-lg font-semibold">Evaluation History</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {founderEvals.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No evaluations yet.</p>
                  ) : (
                    founderEvals.map((ev) => {
                      const risk = getRiskTag(ev.total_score || 0);
                      return (
                        <Card key={ev.id} className="shadow-sm">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{ev.block_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {ev.evaluation_date ? format(parseISO(ev.evaluation_date), "MMM d, yyyy") : ""}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-primary">{ev.total_score}/100</span>
                                <Badge className={`text-white ${risk.color}`}>{risk.label}</Badge>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setViewingEval(ev)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openEditEval(ev)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteEvalId(ev.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div><span className="text-muted-foreground">Execution:</span> {ev.execution_score}</div>
                              <div><span className="text-muted-foreground">Traction:</span> {ev.traction_score}</div>
                              <div><span className="text-muted-foreground">Momentum:</span> {ev.momentum_score}</div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}

      {/* New Evaluation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEval ? "Edit" : "New"} Evaluation — {block.name}: {block.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Block</Label>
                <Select value={selectedBlock} onValueChange={handleBlockChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BLOCKS.map((b) => (
                      <SelectItem key={b.name} value={b.name}>{b.name} – {b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={evalDate} onChange={(e) => setEvalDate(e.target.value)} />
              </div>
            </div>

            {/* Category evaluations */}
            <div>
              <h3 className="text-sm font-semibold text-module-founders mb-3">Qualitative Evaluation</h3>
              <div className="space-y-4">
                {block.categories.map((cat) => {
                  const cd = categoriesData[cat.key] || { rating: 0, update: "", blockers: "", needs: "" };
                  return (
                    <Card key={cat.key} className="shadow-sm">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">{cat.label}</Label>
                          <StarRating
                            value={cd.rating}
                            onChange={(v) => setCategoriesData((prev) => ({ ...prev, [cat.key]: { ...prev[cat.key], rating: v } }))}
                          />
                        </div>
                        <Textarea
                          placeholder="Progress update..."
                          rows={2}
                          value={cd.update}
                          onChange={(e) => setCategoriesData((prev) => ({ ...prev, [cat.key]: { ...prev[cat.key], update: e.target.value } }))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Key Blockers</Label>
                            <Textarea
                              placeholder="Blockers..."
                              rows={1}
                              value={cd.blockers}
                              onChange={(e) => setCategoriesData((prev) => ({ ...prev, [cat.key]: { ...prev[cat.key], blockers: e.target.value } }))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Key Needs</Label>
                            <Textarea
                              placeholder="Needs..."
                              rows={1}
                              value={cd.needs}
                              onChange={(e) => setCategoriesData((prev) => ({ ...prev, [cat.key]: { ...prev[cat.key], needs: e.target.value } }))}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Quantitative metrics */}
            <div>
              <h3 className="text-sm font-semibold text-module-operations mb-3">Quantitative Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {block.metrics.map((m) => {
                  const md = metricsData[m.key] || { value: null, notes: "" };
                  return (
                    <Card key={m.key} className="shadow-sm">
                      <CardContent className="pt-3 space-y-2">
                        <Label className="text-sm">{m.label}</Label>
                        <Input
                          type="number"
                          placeholder="Value"
                          value={md.value ?? ""}
                          onChange={(e) => setMetricsData((prev) => ({ ...prev, [m.key]: { ...prev[m.key], value: e.target.value ? Number(e.target.value) : null } }))}
                        />
                        <Input
                          placeholder="Notes (optional)"
                          value={md.notes}
                          onChange={(e) => setMetricsData((prev) => ({ ...prev, [m.key]: { ...prev[m.key], notes: e.target.value } }))}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Confidence & Support */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Confidence Level</Label>
                <StarRating value={confidence} onChange={setConfidence} />
              </div>
              <div className="space-y-2">
                <Label>Support Required</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SUPPORT_OPTIONS.map((s) => (
                    <Badge
                      key={s}
                      variant={supportRequired.includes(s) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleSupport(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Live score preview */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2"><Activity className="h-4 w-4" /> Score Preview</h3>
                  <span className="text-2xl font-bold text-primary">{scores.total}/100</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                  <div>Execution: <strong>{scores.execution}</strong></div>
                  <div>Traction: <strong>{scores.traction}</strong></div>
                  <div>Momentum: <strong>{scores.momentum}</strong></div>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!selectedFounder || saveMutation.isPending}>
              {editingEval ? "Save Changes" : "Save Evaluation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteEvalId} onConfirm={() => deleteEvalId && deleteEvalMutation.mutate(deleteEvalId)} onCancel={() => setDeleteEvalId(null)} />

      <ViewDetailDialog
        open={!!viewingEval}
        onClose={() => setViewingEval(null)}
        title="Evaluation Details"
        fields={viewingEval ? [
          { label: "Block", value: viewingEval.block_name },
          { label: "Date", value: viewingEval.evaluation_date },
          { label: "Total Score", value: `${viewingEval.total_score}/100` },
          { label: "Execution", value: String(viewingEval.execution_score) },
          { label: "Traction", value: String(viewingEval.traction_score) },
          { label: "Momentum", value: String(viewingEval.momentum_score) },
          { label: "Confidence", value: `${viewingEval.overall_confidence}/5` },
          { label: "Support", value: (viewingEval.support_required as string[] || []).join(", ") },
        ] : []}
      />
    </div>
  );
}
