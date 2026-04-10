import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { TagBadges } from "@/components/TagBadges";
import type { Tables } from "@/integrations/supabase/types";

type Founder = Tables<"founders">;

interface FounderCardProps {
  founder: Founder;
  nationalities: string[];
  getFlag: (name: string | null | undefined) => string;
  onView: (f: Founder) => void;
  onEdit: (f: Founder) => void;
  onDelete: (id: string) => void;
  highlightId?: string | null;
}

export function FounderCard({ founder, nationalities, getFlag, onView, onEdit, onDelete, highlightId }: FounderCardProps) {
  const [imgError, setImgError] = useState(false);
  const initials = founder.founder_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-2xl bg-card border border-border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out ${highlightId === founder.id ? "animate-target-flash" : ""}`}>
      {/* Visual header area */}
      <div className="relative h-28 bg-gradient-to-br from-secondary to-muted flex items-end justify-center">
        {/* Subtle decorative circle */}
        <div className="absolute top-3 right-3 h-16 w-16 rounded-full bg-primary/[0.04]" />
        <div className="absolute bottom-2 left-4 h-8 w-8 rounded-full bg-primary/[0.03]" />

        {/* Actions menu - top right */}
        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 bg-card/60 backdrop-blur-sm hover:bg-card/80">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(founder)}>
                <Eye className="mr-2 h-3 w-3" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(founder)}>
                <Pencil className="mr-2 h-3 w-3" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(founder.id)}>
                <Trash2 className="mr-2 h-3 w-3" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Avatar - overlapping the header/content boundary */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
          <div className="h-16 w-16 rounded-full bg-card border-[3px] border-card shadow-md flex items-center justify-center overflow-hidden">
            {founder.photo_url && !imgError ? (
              <img src={founder.photo_url} alt={founder.founder_name} className="h-full w-full object-cover" onError={() => setImgError(true)} />
            ) : (
              <span className="text-lg font-semibold text-primary select-none">{initials}</span>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-col flex-1 px-5 pt-11 pb-5 text-center">
        {/* Name */}
        <h3 className="text-[15px] font-semibold text-foreground leading-tight truncate">
          {founder.founder_name}
        </h3>

        {/* Nationalities */}
        {nationalities.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {nationalities.map((n) => `${getFlag(n)} ${n}`).join(" · ")}
          </p>
        )}

        {/* Startup name */}
        <p className="text-[13px] text-muted-foreground mt-1.5 truncate font-medium">
          {founder.startup_name}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
          {founder.status && (
            <Badge className="text-[10px] font-medium bg-primary/8 text-primary border-primary/15 hover:bg-primary/12">
              {founder.status}
            </Badge>
          )}
          {founder.cohort_year && (
            <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">
              {founder.cohort_year}
            </Badge>
          )}
          {founder.cohort && (
            <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">
              {founder.cohort}
            </Badge>
          )}
        </div>

        {/* Tags */}
        {founder.tag_ids && (founder.tag_ids as string[]).length > 0 && (
          <div className="mt-3 flex justify-center">
            <TagBadges tagIds={founder.tag_ids as string[] | null} />
          </div>
        )}
      </div>
    </div>
  );
}
