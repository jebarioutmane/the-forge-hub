import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { MapPin, Calendar as CalIcon, Link as LinkIcon, Pencil, Trash2, AlertTriangle, User, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatUrl } from "@/lib/formatUrl";
import type { CalendarEvent } from "@/pages/events/Calendar";

type Attendance = {
  id: string;
  event_id: string | null;
  founder_id: string | null;
  status: string | null;
  notes: string | null;
};

type Founder = { id: string; founder_name: string; startup_name: string; photo_url: string | null };

const STATUS_COLORS: Record<string, string> = {
  Present: "bg-emerald-100 text-emerald-700",
  Absent: "bg-rose-100 text-rose-700",
  Excused: "bg-amber-100 text-amber-800",
};

interface Props {
  event: CalendarEvent | null;
  hasConflict: boolean;
  onClose: () => void;
  onEdit: (ev: CalendarEvent) => void;
  onDelete: (id: string) => void;
}

function parseNeedsExtra(needs: any) {
  try {
    if (typeof needs === "string") return JSON.parse(needs);
    if (needs && typeof needs === "object" && !Array.isArray(needs)) return needs;
  } catch {}
  return {};
}

export function EventSlideOver({ event, hasConflict, onClose, onEdit, onDelete }: Props) {
  const qc = useQueryClient();

  const { data: attendance = [] } = useQuery({
    queryKey: ["event_attendance", event?.id],
    enabled: !!event,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_attendance")
        .select("*")
        .eq("event_id", event!.id);
      if (error) throw error;
      return data as Attendance[];
    },
  });

  const { data: founders = [] } = useQuery({
    queryKey: ["founders-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founders")
        .select("id, founder_name, startup_name, photo_url")
        .order("founder_name");
      if (error) throw error;
      return data as Founder[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ founderId, status }: { founderId: string; status: string }) => {
      if (!event) return;
      const existing = attendance.find((a) => a.founder_id === founderId);
      if (existing) {
        const { error } = await supabase
          .from("event_attendance")
          .update({ status })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_attendance")
          .insert({ event_id: event.id, founder_id: founderId, status });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event_attendance", event?.id] });
      toast.success("Attendance updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeAttendee = useMutation({
    mutationFn: async (founderId: string) => {
      if (!event) return;
      const { error } = await supabase
        .from("event_attendance")
        .delete()
        .eq("event_id", event.id)
        .eq("founder_id", founderId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_attendance", event?.id] }),
  });

  if (!event) return null;

  const extra = parseNeedsExtra(event.needs);
  const location = (event as any).location || extra.location;
  const description = extra.description;
  const links: { title?: string; url: string }[] = Array.isArray(event.links) ? (event.links as any) : [];
  const availableFounders = founders.filter((f) => !attendance.some((a) => a.founder_id === f.id));

  return (
    <Sheet open={!!event} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg bg-white/90 backdrop-blur-2xl overflow-y-auto">
        <SheetHeader className="space-y-3 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wider">{event.event_type || "General"}</Badge>
            {hasConflict && (
              <Badge className="rounded-full text-[10px] bg-amber-100 text-amber-800 gap-1">
                <AlertTriangle className="h-3 w-3" /> Conflict
              </Badge>
            )}
          </div>
          <SheetTitle className="text-2xl font-semibold tracking-tight">{event.name}</SheetTitle>
          <SheetDescription className="sr-only">Event details and attendance</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 text-muted-foreground">
              <CalIcon className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="font-mono tabular-nums">
                {format(parseISO(event._start), "EEE, MMM d · HH:mm")}
                <span className="mx-1.5">→</span>
                {format(parseISO(event._end), "MMM d · HH:mm")}
              </div>
            </div>
            {location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" /> {location}
              </div>
            )}
          </div>

          {description && (
            <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{description}</div>
          )}

          {links.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Links</div>
              <div className="space-y-1">
                {links.map((l, i) => (
                  <a
                    key={i}
                    href={formatUrl(l.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    {l.title || l.url}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Attendance</div>
              <span className="text-xs font-mono tabular-nums text-muted-foreground">{attendance.length}</span>
            </div>
            <div className="space-y-1.5">
              {attendance.map((a) => {
                const f = founders.find((x) => x.id === a.founder_id);
                if (!f) return null;
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                    {f.photo_url ? (
                      <img src={f.photo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-sm">
                      <div className="truncate font-medium">{f.founder_name}</div>
                      <div className="truncate text-xs text-muted-foreground">{f.startup_name}</div>
                    </div>
                    <Select value={a.status || "Present"} onValueChange={(v) => updateStatus.mutate({ founderId: a.founder_id!, status: v })}>
                      <SelectTrigger className={`h-7 w-[100px] text-xs rounded-full border-0 ${STATUS_COLORS[a.status || "Present"] || "bg-muted"}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Present">Present</SelectItem>
                        <SelectItem value="Absent">Absent</SelectItem>
                        <SelectItem value="Excused">Excused</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAttendee.mutate(a.founder_id!)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {availableFounders.length > 0 && (
              <Select onValueChange={(v) => updateStatus.mutate({ founderId: v, status: "Present" })}>
                <SelectTrigger className="h-8 mt-2 text-xs rounded-full">
                  <SelectValue placeholder="+ Add founder" />
                </SelectTrigger>
                <SelectContent>
                  {availableFounders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.founder_name} — {f.startup_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" className="flex-1 rounded-full" onClick={() => onEdit(event)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-full text-destructive hover:text-destructive"
              onClick={() => { if (confirm("Delete this event?")) onDelete(event.id); }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
