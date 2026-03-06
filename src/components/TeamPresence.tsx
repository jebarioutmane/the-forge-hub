import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePresence } from "@/hooks/usePresence";
import { AnimatedTooltip, TooltipItem } from "@/components/ui/animated-tooltip";

export default function TeamPresence() {
  const { onlineUserIds } = usePresence();

  const { data: profiles = [] } = useQuery({
    queryKey: ["team-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
  });

  if (profiles.length === 0) return null;

  const items: TooltipItem[] = profiles.map((p) => ({
    id: p.id,
    name: p.full_name || "Team Member",
    designation: p.title || "Team",
    image: p.avatar_url ? `${p.avatar_url}?t=${Date.now()}` : "",
    isOnline: onlineUserIds.has(p.id),
  }));

  // Sort online users first
  items.sort((a, b) => (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1));

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:block">Team</span>
      <AnimatedTooltip items={items} />
    </div>
  );
}
