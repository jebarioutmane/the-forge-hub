import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

export function TagPicker({ value, onChange, className }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedTags = tags.filter((t) => value.includes(t.id));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between h-auto min-h-10 px-3 py-2"
        onClick={() => setOpen(!open)}
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {selectedTags.length === 0 && <span className="text-muted-foreground text-sm">Select tags...</span>}
          {selectedTags.map((t) => (
            <Badge
              key={t.id}
              className="gap-1 pr-1 text-xs"
              style={{ backgroundColor: t.color, color: "#fff" }}
            >
              {t.name}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
                className="ml-0.5 rounded-full hover:bg-black/20 p-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-48 overflow-auto">
          {tags.length === 0 && (
            <p className="text-sm text-muted-foreground p-3">No tags created yet. Go to Settings → Tags.</p>
          )}
          {tags.map((t) => {
            const isSelected = value.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left",
                  isSelected && "bg-accent"
                )}
                onClick={() => toggle(t.id)}
              >
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <span className="flex-1">{t.name}</span>
                {isSelected && <span className="text-xs text-muted-foreground">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
