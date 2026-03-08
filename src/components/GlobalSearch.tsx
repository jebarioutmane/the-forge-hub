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
import { GraduationCap, Users2 } from "lucide-react";
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

  const { data: founders } = useQuery({
    queryKey: ["global-search-founders", trimmed],
    enabled: open && trimmed.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("founders")
        .select("id, founder_name, startup_name, nationalities, status")
        .or(
          `founder_name.ilike.%${trimmed}%,startup_name.ilike.%${trimmed}%`
        )
        .limit(8);
      return data ?? [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["global-search-profiles", trimmed],
    enabled: open && trimmed.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, email, status")
        .or(
          `full_name.ilike.%${trimmed}%,role.ilike.%${trimmed}%,email.ilike.%${trimmed}%`
        )
        .limit(8);
      return data ?? [];
    },
  });

  const handleSelect = useCallback(
    (type: "founder" | "profile", id: string) => {
      onOpenChange(false);
      setQuery("");
      if (type === "founder") {
        navigate(`/founders?highlight=${id}`);
      } else {
        navigate(`/system/profiles?highlight=${id}`);
      }
    },
    [navigate, onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQuery(""); }}>
      <CommandInput
        placeholder="Search founders, team, events..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
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
                    <CommandItem
                      key={f.id}
                      value={`founder-${f.founder_name}-${f.startup_name}`}
                      onSelect={() => handleSelect("founder", f.id)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                          {highlightMatch(f.founder_name, trimmed)}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {highlightMatch(f.startup_name, trimmed)}
                          {flags && ` · ${flags}`}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {profiles && profiles.length > 0 && (
              <CommandGroup heading="Team">
                {profiles.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`profile-${p.full_name}-${p.email}`}
                    onSelect={() => handleSelect("profile", p.id)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <Users2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">
                        {highlightMatch(p.full_name ?? "Unknown", trimmed)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {p.role ?? "User"} · {p.email ?? ""}
                      </span>
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
