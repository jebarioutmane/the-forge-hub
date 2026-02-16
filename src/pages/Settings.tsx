import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

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
  const [labels, setLabels] = useState(getLabels);
  const [newLabel, setNewLabel] = useState("");

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

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Global Labels</CardTitle>
          <CardDescription>Labels shared across Tasks, Contracts, and other modules.</CardDescription>
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
    </div>
  );
}
