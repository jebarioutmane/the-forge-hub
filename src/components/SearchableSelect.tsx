import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: { id: string; label: string; sublabel?: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** When provided, shows a "+ Add new" option at the bottom of the list */
  onCreateNew?: (name: string) => Promise<string | null>;
  createLabel?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
  onCreateNew,
  createLabel = "Add new",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, search]);

  const selectedLabel = options.find((o) => o.id === value)?.label;

  async function handleCreate() {
    if (!newName.trim() || !onCreateNew) return;
    setSaving(true);
    const newId = await onCreateNew(newName.trim());
    setSaving(false);
    if (newId) {
      onValueChange(newId);
      setIsCreating(false);
      setNewName("");
      setOpen(false);
      setSearch("");
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setIsCreating(false); setNewName(""); } }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-[200px]">
          {filtered.length === 0 && !isCreating ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No results found
            </p>
          ) : (
            <div className="p-1">
              {filtered.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    onValueChange(option.id === value ? null : option.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-left",
                    option.id === value && "bg-accent"
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      option.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="text-xs text-muted-foreground truncate">
                        {option.sublabel}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Inline creation */}
        {onCreateNew && (
          <div className="border-t p-1">
            {isCreating ? (
              <div className="flex items-center gap-1.5 p-1">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name..."
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setIsCreating(false); }}
                />
                <Button size="sm" className="h-8 px-2.5 shrink-0" onClick={handleCreate} disabled={!newName.trim() || saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-primary font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                {createLabel}
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
