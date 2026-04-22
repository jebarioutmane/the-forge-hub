import { useState, useCallback, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  GraduationCap, Users2, CalendarDays, FileText,
  DollarSign, ListTodo, BookOpen, Handshake, Wallet,
  TrendingUp, ClipboardCheck,
} from "lucide-react";
import { getFlag } from "@/lib/countries";

function highlightMatch(text: string, query: string) {
  if (!query || query.length < 2) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="bg-[#FFD60A]/40 text-foreground rounded-[2px] px-0.5">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const trimmed = query.trim();
  const enabled = open && trimmed.length >= 2;

  const { data: founders } = useQuery({
    queryKey: ["global-search-founders", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("founders")
        .select("id, founder_name, startup_name, nationalities, status, email, description, cohort_year")
        .or(`founder_name.ilike.%${trimmed}%,startup_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%,description.ilike.%${trimmed}%,cohort_year.ilike.%${trimmed}%,status.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: tracking } = useQuery({
    queryKey: ["global-search-tracking", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("founders_tracking")
        .select("id, founder_id, tracking_date, overall_score, product_dev_update, team_structure_update, clients_traction_update, market_presence_update, funding_update, other_updates, founders(founder_name, startup_name)")
        .or(`product_dev_update.ilike.%${trimmed}%,team_structure_update.ilike.%${trimmed}%,clients_traction_update.ilike.%${trimmed}%,market_presence_update.ilike.%${trimmed}%,funding_update.ilike.%${trimmed}%,other_updates.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: evaluations } = useQuery({
    queryKey: ["global-search-evaluations", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("founder_evaluations")
        .select("id, founder_id, block_name, evaluation_date, total_score, founders(founder_name, startup_name)")
        .ilike("block_name", `%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["global-search-profiles", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, email, status")
        .or(`full_name.ilike.%${trimmed}%,role.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["global-search-events", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, location, event_type, status, start_date")
        .or(`name.ilike.%${trimmed}%,location.ilike.%${trimmed}%,event_type.ilike.%${trimmed}%,status.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: programEvents } = useQuery({
    queryKey: ["global-search-program-events", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("program_events")
        .select("id, title, description, location, event_type, start_time, cohort_year")
        .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%,location.ilike.%${trimmed}%,event_type.ilike.%${trimmed}%,cohort_year.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: logistics } = useQuery({
    queryKey: ["global-search-logistics", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_logistics")
        .select("id, event_id, comments, people_involved, events(name)")
        .ilike("comments", `%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: stakeholders } = useQuery({
    queryKey: ["global-search-stakeholders", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("stakeholders")
        .select("id, full_name, institution_name, type, sector, email, title, based_in_country, point_of_contact, description")
        .or(`full_name.ilike.%${trimmed}%,institution_name.ilike.%${trimmed}%,sector.ilike.%${trimmed}%,email.ilike.%${trimmed}%,title.ilike.%${trimmed}%,based_in_country.ilike.%${trimmed}%,point_of_contact.ilike.%${trimmed}%,description.ilike.%${trimmed}%,type.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["global-search-contracts", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, title, stakeholder_name, status, type")
        .or(`title.ilike.%${trimmed}%,stakeholder_name.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["global-search-expenses", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("id, description, beneficiary_name, status, amount")
        .or(`description.ilike.%${trimmed}%,beneficiary_name.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["global-search-tasks", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, description, status, priority")
        .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: stipends } = useQuery({
    queryKey: ["global-search-stipends", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("stipends")
        .select("id, founder_name, status, base_amount")
        .or(`founder_name.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: mentoring } = useQuery({
    queryKey: ["global-search-mentoring", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("mentoring_sessions")
        .select("id, mentor_name, founder_name, title, status")
        .or(`mentor_name.ilike.%${trimmed}%,founder_name.ilike.%${trimmed}%,title.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: resources } = useQuery({
    queryKey: ["global-search-resources", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("resource_library")
        .select("id, resource_name, module_name, description")
        .or(`resource_name.ilike.%${trimmed}%,module_name.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const go = useCallback(
    (path: string) => {
      onOpenChange(false);
      setQuery("");
      navigate(path);
    },
    [navigate, onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQuery(""); }}>
      <CommandInput
        placeholder="Search anything..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        {trimmed.length < 2 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search…
          </div>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>

            {founders && founders.length > 0 && (
              <CommandGroup heading="Founders">
                {founders.map((f) => {
                  const flags = (f.nationalities ?? []).map((n) => getFlag(n)).join(" ");
                  return (
                    <CommandItem key={f.id} value={`founder-${f.founder_name}-${f.startup_name}`} onSelect={() => go(`/founders?highlight=${f.id}`)} className="flex items-center gap-3 cursor-pointer">
                      <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{highlightMatch(f.founder_name, trimmed)}</span>
                        <span className="text-xs text-muted-foreground truncate">{highlightMatch(f.startup_name, trimmed)}{flags && ` · ${flags}`}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {profiles && profiles.length > 0 && (
              <CommandGroup heading="Team">
                {profiles.map((p) => (
                  <CommandItem key={p.id} value={`profile-${p.full_name}-${p.email}`} onSelect={() => go(`/system/profiles?highlight=${p.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <Users2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(p.full_name ?? "Unknown", trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{p.role ?? "User"} · {p.email ?? ""}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {tracking && tracking.length > 0 && (
              <CommandGroup heading="Founder Tracking">
                {tracking.map((t: any) => {
                  const snippet = [t.product_dev_update, t.team_structure_update, t.clients_traction_update, t.market_presence_update, t.funding_update, t.other_updates].find((x) => x?.toLowerCase().includes(trimmed.toLowerCase())) ?? "";
                  return (
                    <CommandItem key={t.id} value={`tracking-${t.id}-${snippet}`} onSelect={() => go(`/founders/tracking?highlight=${t.id}`)} className="flex items-center gap-3 cursor-pointer">
                      <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{t.founders?.founder_name ?? "Tracking entry"} · Score {t.overall_score ?? "—"}</span>
                        <span className="text-xs text-muted-foreground truncate">{highlightMatch(snippet.slice(0, 80), trimmed)}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {evaluations && evaluations.length > 0 && (
              <CommandGroup heading="Evaluations">
                {evaluations.map((e: any) => (
                  <CommandItem key={e.id} value={`evaluation-${e.id}-${e.block_name}`} onSelect={() => go(`/founders/evaluation?highlight=${e.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <ClipboardCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(e.block_name, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{e.founders?.founder_name ?? ""} · Total {e.total_score ?? "—"} · {e.evaluation_date ?? ""}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {events && events.length > 0 && (
              <CommandGroup heading="Planning">
                {events.map((e) => (
                  <CommandItem key={e.id} value={`event-${e.name}-${e.location}`} onSelect={() => go(`/events/planning?highlight=${e.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(e.name, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{e.event_type ?? "Event"} · {e.location ?? ""} · {e.status ?? ""}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {programEvents && programEvents.length > 0 && (
              <CommandGroup heading="Calendar">
                {programEvents.map((p: any) => (
                  <CommandItem key={p.id} value={`program-${p.id}-${p.title}`} onSelect={() => go(`/events?highlight=${p.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(p.title, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{p.event_type ?? "Calendar"} · {p.location ?? ""} · {p.cohort_year ?? ""}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {logistics && logistics.length > 0 && (
              <CommandGroup heading="Logistics">
                {logistics.map((l: any) => (
                  <CommandItem key={l.id} value={`logistics-${l.id}`} onSelect={() => go(`/events/logistics?highlight=${l.event_id ?? l.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{l.events?.name ?? "Logistics entry"}</span>
                      <span className="text-xs text-muted-foreground truncate">{highlightMatch((l.comments ?? "").slice(0, 80), trimmed)}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {stakeholders && stakeholders.length > 0 && (
              <CommandGroup heading="Stakeholders">
                {stakeholders.map((s) => (
                  <CommandItem key={s.id} value={`stakeholder-${s.full_name}-${s.institution_name}`} onSelect={() => go(`/events/stakeholders?highlight=${s.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <Handshake className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(s.full_name, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{highlightMatch(s.institution_name ?? "", trimmed)} · {s.type ?? ""}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {contracts && contracts.length > 0 && (
              <CommandGroup heading="Contracts">
                {contracts.map((c) => (
                  <CommandItem key={c.id} value={`contract-${c.title}-${c.stakeholder_name}`} onSelect={() => go(`/operations/contracts?highlight=${c.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(c.title, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{highlightMatch(c.stakeholder_name, trimmed)} · {c.status ?? ""}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {expenses && expenses.length > 0 && (
              <CommandGroup heading="Expenses">
                {expenses.map((e) => (
                  <CommandItem key={e.id} value={`expense-${e.description}-${e.beneficiary_name}`} onSelect={() => go(`/operations/source?highlight=${e.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(e.description, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{e.beneficiary_name ?? ""} · {e.status ?? ""}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {tasks && tasks.length > 0 && (
              <CommandGroup heading="Tasks">
                {tasks.map((t) => (
                  <CommandItem key={t.id} value={`task-${t.title}-${t.status}`} onSelect={() => go(`/operations/tasks?highlight=${t.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(t.title, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{t.priority ?? ""} · {t.status ?? ""}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {stipends && stipends.length > 0 && (
              <CommandGroup heading="Stipends">
                {stipends.map((s) => (
                  <CommandItem key={s.id} value={`stipend-${s.founder_name}-${s.status}`} onSelect={() => go(`/operations/stipends?highlight=${s.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(s.founder_name, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{s.status} · {s.base_amount} MAD</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {mentoring && mentoring.length > 0 && (
              <CommandGroup heading="Mentoring">
                {mentoring.map((m) => (
                  <CommandItem key={m.id} value={`mentoring-${m.mentor_name}-${m.founder_name}`} onSelect={() => go(`/events?highlight=${m.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <Users2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(m.title ?? m.mentor_name, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{m.mentor_name} → {m.founder_name} · {m.status ?? ""}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {resources && resources.length > 0 && (
              <CommandGroup heading="Library">
                {resources.map((r) => (
                  <CommandItem key={r.id} value={`resource-${r.resource_name}-${r.module_name}`} onSelect={() => go(`/library?highlight=${r.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(r.resource_name, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{highlightMatch(r.module_name, trimmed)}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
