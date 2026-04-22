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
  TrendingUp, ClipboardCheck, History, Home, Settings, LayoutDashboard,
  Tag, UserCog, Briefcase, Link as LinkIcon,
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
        .select("id, founder_name, startup_name, nationalities, status, email, description, cohort_year, cohort, phone, cin_number, passport_number, rib_number, venture_associate")
        .or(`founder_name.ilike.%${trimmed}%,startup_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%,description.ilike.%${trimmed}%,cohort_year.ilike.%${trimmed}%,cohort.ilike.%${trimmed}%,status.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,cin_number.ilike.%${trimmed}%,passport_number.ilike.%${trimmed}%,rib_number.ilike.%${trimmed}%,venture_associate.ilike.%${trimmed}%`)
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
        .select("id, full_name, role, email, status, title, description, phone, status_note, cin_number, passport_number")
        .or(`full_name.ilike.%${trimmed}%,role.ilike.%${trimmed}%,email.ilike.%${trimmed}%,title.ilike.%${trimmed}%,description.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,status_note.ilike.%${trimmed}%,status.ilike.%${trimmed}%,cin_number.ilike.%${trimmed}%,passport_number.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: historyLogs } = useQuery({
    queryKey: ["global-search-history", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("history_logs")
        .select("id, section_name, action, changed_by_name, created_at, record_id")
        .or(`section_name.ilike.%${trimmed}%,action.ilike.%${trimmed}%,changed_by_name.ilike.%${trimmed}%,record_id.ilike.%${trimmed}%`)
        .order("created_at", { ascending: false })
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
        .select("id, title, stakeholder_name, status, type, description, payment_structure, currency, value")
        .or(`title.ilike.%${trimmed}%,stakeholder_name.ilike.%${trimmed}%,description.ilike.%${trimmed}%,type.ilike.%${trimmed}%,status.ilike.%${trimmed}%,payment_structure.ilike.%${trimmed}%`)
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
        .select("id, description, beneficiary_name, status, amount, currency, type, cohort_id")
        .or(`description.ilike.%${trimmed}%,beneficiary_name.ilike.%${trimmed}%,status.ilike.%${trimmed}%,type.ilike.%${trimmed}%,currency.ilike.%${trimmed}%`)
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
        .from("stipend_records")
        .select("id, payment_month, cohort_year, status, total_net, base_amount, notes, founders(founder_name, startup_name)")
        .or(`payment_month.ilike.%${trimmed}%,cohort_year.ilike.%${trimmed}%,status.ilike.%${trimmed}%,notes.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: budgetCategories } = useQuery({
    queryKey: ["global-search-budget-categories", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_categories")
        .select("id, name, total_amount")
        .ilike("name", `%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: budgetLines } = useQuery({
    queryKey: ["global-search-budget-lines", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_lines")
        .select("id, name, code, allocated_amount")
        .or(`name.ilike.%${trimmed}%,code.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: budgetTx } = useQuery({
    queryKey: ["global-search-budget-tx", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_transactions")
        .select("id, description, category, amount, transaction_type, cohort_year, date")
        .or(`description.ilike.%${trimmed}%,category.ilike.%${trimmed}%,transaction_type.ilike.%${trimmed}%,cohort_year.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: vendors } = useQuery({
    queryKey: ["global-search-vendors", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendors")
        .select("id, name, type, email")
        .or(`name.ilike.%${trimmed}%,type.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: cohorts } = useQuery({
    queryKey: ["global-search-cohorts", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("cohorts")
        .select("id, name, year, total_budget")
        .ilike("name", `%${trimmed}%`)
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

            {(() => {
              const pages = [
                { title: "Home", path: "/", icon: Home, keywords: "home command center dashboard" },
                { title: "Operations Dashboard", path: "/operations", icon: LayoutDashboard, keywords: "operations dashboard budget overview" },
                { title: "Budget Source", path: "/operations/source", icon: DollarSign, keywords: "budget source categories lines cohorts vendors" },
                { title: "Expenses", path: "/operations/expenses", icon: DollarSign, keywords: "expenses spending payments" },
                { title: "Stipends", path: "/operations/stipends", icon: Wallet, keywords: "stipends payouts founders monthly" },
                { title: "Contracts", path: "/operations/contracts", icon: FileText, keywords: "contracts agreements vendors" },
                { title: "Events Calendar", path: "/events", icon: CalendarDays, keywords: "events calendar program schedule" },
                { title: "Planning", path: "/events/planning", icon: CalendarDays, keywords: "planning events masterclass" },
                { title: "Logistics", path: "/events/logistics", icon: CalendarDays, keywords: "logistics travel accommodation catering" },
                { title: "Stakeholders", path: "/events/stakeholders", icon: Handshake, keywords: "stakeholders mentors investors partners" },
                { title: "Founders Directory", path: "/founders", icon: GraduationCap, keywords: "founders directory source startups" },
                { title: "Founder Tracking", path: "/founders/tracking", icon: TrendingUp, keywords: "tracking weekly progress founders" },
                { title: "Founder Evaluation", path: "/founders/evaluation", icon: ClipboardCheck, keywords: "evaluation blocks scores assessment" },
                { title: "Portfolio Dashboard", path: "/founders/portfolio", icon: LayoutDashboard, keywords: "portfolio dashboard founders overview charts" },
                { title: "Library", path: "/library", icon: BookOpen, keywords: "library resources documents links" },
                { title: "Team Profiles", path: "/system/profiles", icon: Users2, keywords: "team profiles staff members system" },
                { title: "History Log", path: "/system/history", icon: History, keywords: "history log audit time machine changes" },
                { title: "Settings", path: "/settings", icon: Settings, keywords: "settings preferences tags configuration" },
              ];
              const q = trimmed.toLowerCase();
              const matched = pages.filter((p) => p.title.toLowerCase().includes(q) || p.keywords.includes(q));
              if (matched.length === 0) return null;
              return (
                <CommandGroup heading="Pages">
                  {matched.slice(0, 8).map((p) => (
                    <CommandItem key={p.path} value={`page-${p.path}-${p.title}`} onSelect={() => go(p.path)} className="flex items-center gap-3 cursor-pointer">
                      <p.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{highlightMatch(p.title, trimmed)}</span>
                        <span className="text-xs text-muted-foreground truncate">{p.path}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })()}

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
                {stipends.map((s: any) => {
                  const name = s.founders?.founder_name ?? "Stipend";
                  return (
                    <CommandItem key={s.id} value={`stipend-${s.id}-${name}`} onSelect={() => go(`/operations/stipends?highlight=${s.id}`)} className="flex items-center gap-3 cursor-pointer">
                      <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{name} · {s.payment_month ?? ""}</span>
                        <span className="text-xs text-muted-foreground truncate">{s.status ?? ""} · {s.cohort_year ?? ""} · {s.total_net ?? s.base_amount ?? 0} MAD</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {budgetCategories && budgetCategories.length > 0 && (
              <CommandGroup heading="Budget Categories">
                {budgetCategories.map((b: any) => (
                  <CommandItem key={b.id} value={`bcat-${b.id}-${b.name}`} onSelect={() => go(`/operations/source?highlight=${b.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(b.name, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">Total: {b.total_amount ?? 0} MAD</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {budgetLines && budgetLines.length > 0 && (
              <CommandGroup heading="Budget Lines">
                {budgetLines.map((b: any) => (
                  <CommandItem key={b.id} value={`bline-${b.id}-${b.name}`} onSelect={() => go(`/operations/source?highlight=${b.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(b.name, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{b.code ?? ""} · {b.allocated_amount ?? 0} MAD</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {budgetTx && budgetTx.length > 0 && (
              <CommandGroup heading="Budget Transactions">
                {budgetTx.map((t: any) => (
                  <CommandItem key={t.id} value={`btx-${t.id}-${t.description}`} onSelect={() => go(`/operations?highlight=${t.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(t.description ?? t.category, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{t.transaction_type ?? ""} · {t.amount ?? 0} · {t.cohort_year ?? ""} · {t.date ?? ""}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {vendors && vendors.length > 0 && (
              <CommandGroup heading="Vendors">
                {vendors.map((v: any) => (
                  <CommandItem key={v.id} value={`vendor-${v.id}-${v.name}`} onSelect={() => go(`/operations/source?highlight=${v.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <Handshake className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(v.name, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{v.type ?? ""} · {v.email ?? ""}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {cohorts && cohorts.length > 0 && (
              <CommandGroup heading="Cohorts">
                {cohorts.map((c: any) => (
                  <CommandItem key={c.id} value={`cohort-${c.id}-${c.name}`} onSelect={() => go(`/operations/source?highlight=${c.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(c.name, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{c.year ?? ""} · Budget: {c.total_budget ?? 0} MAD</span>
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

            {historyLogs && historyLogs.length > 0 && (
              <CommandGroup heading="History Log">
                {historyLogs.map((h: any) => (
                  <CommandItem key={h.id} value={`history-${h.id}-${h.section_name}`} onSelect={() => go(`/system/history?highlight=${h.id}`)} className="flex items-center gap-3 cursor-pointer">
                    <History className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{highlightMatch(h.section_name, trimmed)} · {highlightMatch(h.action, trimmed)}</span>
                      <span className="text-xs text-muted-foreground truncate">{h.changed_by_name ?? "—"} · {h.created_at ? new Date(h.created_at).toLocaleString() : ""}</span>
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
