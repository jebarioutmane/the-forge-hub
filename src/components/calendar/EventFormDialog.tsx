import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { COHORT_YEARS } from "@/lib/cohortYears";
import type { ProgramEvent } from "@/pages/events/Calendar";

const EVENT_TYPES = ["Selection", "Workshop", "Pitch", "1-on-1", "Travel", "General"];

type Founder = { id: string; founder_name: string; startup_name: string };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ProgramEvent | null;
  defaultCohort: string;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventFormDialog({ open, onOpenChange, initial, defaultCohort }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventType, setEventType] = useState("General");
  const [cohortYear, setCohortYear] = useState(defaultCohort);
  const [location, setLocation] = useState("");
  const [linkedFounderId, setLinkedFounderId] = useState<string>("");
  const [links, setLinks] = useState<{ title: string; url: string }[]>([]);

  const { data: founders = [] } = useQuery({
    queryKey: ["founders-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("id, founder_name, startup_name").order("founder_name");
      if (error) throw error;
      return data as Founder[];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description || "");
      setStartTime(toLocalInput(initial.start_time));
      setEndTime(toLocalInput(initial.end_time));
      setEventType(initial.event_type);
      setCohortYear(initial.cohort_year);
      setLocation(initial.location || "");
      setLinkedFounderId(initial.linked_founder_id || "");
      setLinks(Array.isArray(initial.links) ? initial.links : []);
    } else {
      const now = new Date();
      const later = new Date(now.getTime() + 60 * 60 * 1000);
      setTitle(""); setDescription("");
      setStartTime(toLocalInput(now.toISOString()));
      setEndTime(toLocalInput(later.toISOString()));
      setEventType("General"); setCohortYear(defaultCohort);
      setLocation(""); setLinkedFounderId(""); setLinks([]);
    }
  }, [open, initial, defaultCohort]);

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title required");
      if (!startTime || !endTime) throw new Error("Start and end times required");
      const payload = {
        title: title.trim(),
        description: description || null,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        event_type: eventType,
        cohort_year: cohortYear,
        location: location || null,
        linked_founder_id: eventType === "1-on-1" && linkedFounderId ? linkedFounderId : null,
        links,
      };
      if (initial) {
        const { error } = await (supabase as any).from("program_events").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("program_events").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial ? "Event updated" : "Event created");
      qc.invalidateQueries({ queryKey: ["program_events"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Event" : "New Event"}</DialogTitle>
          <DialogDescription className="sr-only">Event details form</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ev-title" className="text-xs">Title</Label>
            <Input id="ev-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ev-start" className="text-xs">Start</Label>
              <Input id="ev-start" name="start_time" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ev-end" className="text-xs">End</Label>
              <Input id="ev-end" name="end_time" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cohort</Label>
              <Select value={cohortYear} onValueChange={setCohortYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COHORT_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="ev-loc" className="text-xs">Location</Label>
            <Input id="ev-loc" name="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          {eventType === "1-on-1" && (
            <div>
              <Label className="text-xs">Linked Founder</Label>
              <Select value={linkedFounderId} onValueChange={setLinkedFounderId}>
                <SelectTrigger><SelectValue placeholder="Select founder" /></SelectTrigger>
                <SelectContent>
                  {founders.map((f) => <SelectItem key={f.id} value={f.id}>{f.founder_name} — {f.startup_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="ev-desc" className="text-xs">Description</Label>
            <Textarea id="ev-desc" name="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Links</Label>
            <div className="space-y-1.5">
              {links.map((l, i) => (
                <div key={i} className="flex gap-1.5">
                  <Input placeholder="Title" value={l.title} onChange={(e) => setLinks(links.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} className="h-8 text-xs" />
                  <Input placeholder="URL" value={l.url} onChange={(e) => setLinks(links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} className="h-8 text-xs" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLinks(links.filter((_, j) => j !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setLinks([...links, { title: "", url: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add link
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{initial ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
