import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Error state for a failed primary query (forge-design section 9). */
export function QueryErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div className={cn("empty-state", className)} role="alert">
      <AlertCircle aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}

/** Error state rendered inside a table body. */
export function QueryErrorRow({ colSpan, message, onRetry }: { colSpan: number; message: string; onRetry: () => void }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <QueryErrorState message={message} onRetry={onRetry} />
      </TableCell>
    </TableRow>
  );
}

/** Skeleton rows matching a table's column count and row height. */
export function SkeletonTableRows({ columns, rows = 10, rowClassName = "h-10" }: { columns: number; rows?: number; rowClassName?: string }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className={cn("hover:bg-transparent", rowClassName)} aria-hidden="true">
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton className={cn("h-4", c === 0 ? "w-3/4" : "w-1/2")} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Stacked skeleton blocks for lists and card grids. */
export function SkeletonBlocks({ count = 4, className = "h-10", wrapperClassName = "space-y-2" }: { count?: number; className?: string; wrapperClassName?: string }) {
  return (
    <div className={wrapperClassName} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full", className)} />
      ))}
    </div>
  );
}
