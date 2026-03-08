import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TagPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

const PRESET_COLORS = ["#f97316", "#ef4444", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#64748b"];

export function TagPicker({ value, onChange, className }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#f97316");
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .insert({ name: newName.trim(), color: newColor })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      onChange([...value, newTag.id]);
      setNewName("");
      setNewColor("#f97316");
      setCreateOpen(false);
      toast.success("Tag created & selected");
    },
    onError: (e) => toast.error(e.message),
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
            <p className="text-sm text-muted-foreground p-3">No tags yet — create one below.</p>
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

          {/* Inline create sticky footer */}
          <div className="sticky bottom-0 border-t bg-popover p-1.5">
            <Popover open={createOpen} onOpenChange={setCreateOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create new tag
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="w-64 p-3 space-y-3"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New tag name..."
                  className="h-8 text-sm"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.key === "Enter" && newName.trim() && createTagMutation.mutate()}
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-6 w-6 rounded cursor-pointer border-0 p-0"
                  />
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        "h-5 w-5 rounded-full border-2 transition-all",
                        newColor === c ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewColor(c)}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => createTagMutation.mutate()}
                  disabled={!newName.trim() || createTagMutation.isPending}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Tag
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
}