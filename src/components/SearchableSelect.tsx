import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: { id: string; label: string; sublabel?: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          {filtered.length === 0 ? (
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
      </PopoverContent>
    </Popover>
  );
}
