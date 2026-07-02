import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import type { CalendarEvent } from "@/pages/events/Calendar";

const EVENT_TYPES = ["Masterclass", "Mentorship", "Pitch Session", "Networking", "Social", "General"];
const STATUSES = ["Planning", "Active", "Completed"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: CalendarEvent | null;
}

function parseNeedsExtra(needs: any) {
  try {
    if (typeof needs === "string") return JSON.parse(needs);
    if (needs && typeof needs === "object" && !Array.isArray(needs)) return needs;
  } catch {}
  return {};
}

export function EventFormDialog({ open, onOpenChange, initial }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [eventType, setEventType] = useState("General");
  const [status, setStatus] = useState("Planning");
  const [location, setLocation] = useState("");
  const [links, setLinks] = useState<{ title: string; url: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const extra = parseNeedsExtra(initial.needs);
      setName(initial.name);
      setDescription(extra.description || "");
      setStartDate(initial.start_date || "");
      setEndDate(initial.end_date || "");
      setStartTime(initial.start_time || extra.start_time || "09:00");
      setEndTime(initial.end_time || extra.end_time || "17:00");
      setEventType(initial.event_type || "General");
      setStatus(initial.status || "Planning");
      setLocation((initial as any).location || extra.location || "");
      setLinks(Array.isArray(initial.links) ? (initial.links as any) : []);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setName(""); setDescription("");
      setStartDate(today); setEndDate(today);
      setStartTime("09:00"); setEndTime("17:00");
      setEventType("General"); setStatus("Planning");
      setLocation(""); setLinks([]);
    }
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Title required");
      if (!startDate) throw new Error("Start date required");
      const payload: any = {
        name: name.trim(),
        event_type: eventType,
        start_date: startDate,
        end_date: endDate || startDate,
        start_time: startTime || null,
        end_time: endTime || null,
        location: location || null,
        status,
        needs: { description: description || "" } as unknown as Json,
        links: links.filter((l) => l.url) as unknown as Json,
      };
      if (initial) {
        const { error } = await supabase.from("events").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial ? "Event updated" : "Event created");
      qc.invalidateQueries({ queryKey: ["events"] });
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
            <Input id="ev-title" name="title" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ev-sd" className="text-xs">Start date</Label>
              <Input id="ev-sd" name="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ev-ed" className="text-xs">End date</Label>
              <Input id="ev-ed" name="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ev-st" className="text-xs">Start time</Label>
              <Input id="ev-st" name="start_time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ev-et" className="text-xs">End time</Label>
              <Input id="ev-et" name="end_time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
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
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="ev-loc" className="text-xs">Location</Label>
            <Input id="ev-loc" name="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
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
