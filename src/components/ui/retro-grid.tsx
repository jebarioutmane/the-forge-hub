import { cn } from "@/lib/utils";

export function RetroGrid({
  className,
  angle = 65,
}: {
  className?: string;
  angle?: number;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 overflow-hidden opacity-50 z-0",
        className
      )}
      style={{ perspective: "200px" }}
    >
      <div
        className="absolute inset-0"
        style={{ transform: `rotateX(${angle}deg)` }}
      >
        <div
          className={cn(
            "animate-grid",
            "[background-repeat:repeat] [background-size:60px_60px] [height:300vh] [inset:0%_0px] [margin-left:-50%] [transform-origin:100%_0_0] [width:600vw]",
            "[background-image:linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_0),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_0)]"
          )}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent to-90%" />
    </div>
  );
}
