import { useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface TooltipItem {
  id: string;
  name: string;
  designation: string;
  image: string;
  isOnline: boolean;
}

export function AnimatedTooltip({ items }: { items: TooltipItem[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<string | null>(null);
  const springConfig = { stiffness: 100, damping: 5 };
  const x = useMotionValue(0);
  const rotate = useSpring(useTransform(x, [-100, 100], [-45, 45]), springConfig);
  const translateX = useSpring(useTransform(x, [-100, 100], [-50, 50]), springConfig);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const halfWidth = (event.target as HTMLElement).offsetWidth / 2;
    x.set(event.nativeEvent.offsetX - halfWidth);
  };

  return (
    <div className="flex items-center -space-x-2 md:-space-x-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative group"
          onMouseEnter={() => setHoveredIndex(item.id)}
          onMouseLeave={() => setHoveredIndex(null)}
          onMouseMove={handleMouseMove}
        >
          <AnimatePresence mode="popLayout">
            {hoveredIndex === item.id && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 10 } }}
                exit={{ opacity: 0, y: -20, scale: 0.6 }}
                style={{ translateX, rotate, whiteSpace: "nowrap" }}
                className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center rounded-xl border bg-popover px-4 py-2 shadow-xl"
              >
                <div className="absolute inset-x-10 -top-px z-30 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
                <div className="absolute -top-px left-10 z-30 h-px w-[40%] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
                <p className="text-sm font-bold text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.designation}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-background cursor-pointer transition-transform duration-200 group-hover:scale-110 group-hover:z-30">
              <AvatarImage src={item.image} alt={item.name} />
              <AvatarFallback className="text-xs font-semibold bg-muted">
                {item.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute bottom-0 right-0 h-2.5 w-2.5 md:h-3 md:w-3 rounded-full border-2 border-background",
                item.isOnline ? "bg-emerald-500" : "bg-gray-400"
              )}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
