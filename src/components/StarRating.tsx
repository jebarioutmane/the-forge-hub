import { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: number;
}

export function StarRating({ value, onChange, readOnly = false, size = 20 }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;

  return (
    <div
      className="inline-flex gap-0.5"
      onMouseLeave={() => !readOnly && setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={`transition-colors duration-150 ${
            star <= displayValue
              ? "text-yellow-400"
              : "text-muted-foreground"
          } ${readOnly ? "cursor-default" : "cursor-pointer"}`}
          fill={star <= displayValue ? "currentColor" : "none"}
          onMouseEnter={() => !readOnly && setHoverValue(star)}
          onClick={() => !readOnly && onChange?.(star)}
        />
      ))}
    </div>
  );
}
