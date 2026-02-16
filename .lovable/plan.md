

# StarRating Component with Hover Preview

## Component: `src/components/StarRating.tsx`

A reusable star rating component using Lucide-react's `Star` icon with hover-to-preview functionality.

### Behavior

- **Display mode** (`readOnly`): Shows filled/empty stars based on the `value` prop. No interaction.
- **Input mode** (default): 
  - Hovering over a star highlights it and all stars to its left in the accent color (Forge Orange).
  - Moving the mouse away reverts to the current saved rating.
  - Clicking a star sets the rating value.

### Implementation Details

**State:**
- `hoverValue: number | null` -- tracks which star is being hovered (1-5), `null` when mouse leaves.

**Rendering logic:**
- For each star (1 through 5):
  - `displayValue = hoverValue ?? value`
  - If star index <= displayValue: render `Star` with `fill="currentColor"` and accent text color
  - Otherwise: render `Star` with no fill and muted text color
- On `onMouseEnter` of star N: set `hoverValue = N`
- On `onMouseLeave` of the container: set `hoverValue = null`
- On `onClick` of star N: call `onChange(N)`

**Props interface:**
```text
value: number (1-5)
onChange?: (rating: number) => void
readOnly?: boolean
size?: number (default 20)
```

**Styling:**
- Active/hovered stars: `text-forge-orange` (or `text-yellow-400` fallback) with `fill="currentColor"`
- Inactive stars: `text-muted-foreground` with no fill
- Cursor: `pointer` in input mode, `default` in readOnly mode
- Smooth transition on hover using `transition-colors duration-150`

No new dependencies -- uses only `lucide-react` Star icon and React state.

