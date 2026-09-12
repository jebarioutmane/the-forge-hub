import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePresence } from "@/hooks/usePresence";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  name: string;
  designation: string;
  image: string;
  isOnline: boolean;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

function AvatarStack({ items, size = "md" }: { items: Member[]; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <div className="flex items-center">
      {items.map((m, i) => (
        <div
          key={m.id}
          title={`${m.name} — ${m.designation}${m.isOnline ? " (online)" : ""}`}
          className={cn(
            "relative flex items-center justify-center rounded-full border border-border bg-secondary font-medium text-muted-foreground overflow-hidden",
            dim,
            i > 0 && "-ml-2"
          )}
        >
          {m.image ? (
            <img src={m.image} alt={m.name} className="h-full w-full object-cover" />
          ) : (
            <span>{initials(m.name)}</span>
          )}
          {m.isOnline && (
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background bg-[hsl(var(--status-ontrack))]" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function TeamPresence({
  onlineUserIds: externalIds,
  compact = false,
}: { onlineUserIds?: Set<string>; compact?: boolean } = {}) {
  const { onlineUserIds: localIds } = usePresence();
  const onlineUserIds = externalIds ?? localIds;

  const { data: profiles = [] } = useQuery({
    queryKey: ["team-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
  });

  if (profiles.length === 0) return null;

  const items: Member[] = profiles.map((p) => ({
    id: p.id,
    name: p.full_name || "Team member",
    designation: p.title || "Team",
    image: p.avatar_url ? `${p.avatar_url}?t=${Date.now()}` : "",
    isOnline: onlineUserIds.has(p.id),
  }));

  // Online users first
  items.sort((a, b) => (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1));

  const onlineCount = items.filter((i) => i.isOnline).length;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <AvatarStack items={items} size="sm" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <AvatarStack items={items} />
      <span className="text-xs font-medium text-muted-foreground tabular">
        {onlineCount} online
      </span>
    </div>
  );
}
