import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface TagBadgesProps {
  tagIds: string[] | null;
}

export function TagBadges({ tagIds }: TagBadgesProps) {
  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  if (!tagIds || tagIds.length === 0) return null;

  const matched = tags.filter((t) => tagIds.includes(t.id));
  if (matched.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {matched.map((t) => (
        <Badge
          key={t.id}
          className="text-[10px] px-1.5 py-0"
          style={{ backgroundColor: t.color, color: "#fff", border: "none" }}
        >
          {t.name}
        </Badge>
      ))}
    </div>
  );
}
