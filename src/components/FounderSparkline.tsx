import { LineChart, Line, ResponsiveContainer, Tooltip, ReferenceDot } from "recharts";
import { format, parseISO } from "date-fns";

interface SparklineDataPoint {
  score: number;
  date?: string;
  i: number;
}

interface FounderSparklineProps {
  scores: number[];
  dates?: string[];
  width?: number;
  height?: number;
  label?: string;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { score, date } = payload[0].payload as SparklineDataPoint;
  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
      {date && (
        <p className="text-[11px] text-muted-foreground font-medium">
          {format(parseISO(date), "MMM d, yyyy")}
        </p>
      )}
      <p className="text-sm font-bold text-foreground">{score}<span className="text-muted-foreground font-normal text-xs">/100</span></p>
    </div>
  );
}

export function FounderSparkline({ scores, dates, width = 80, height = 30, label }: FounderSparklineProps) {
  if (!scores || scores.length < 2) return null;

  const first = scores[0];
  const last = scores[scores.length - 1];
  const color = last > first ? "#34C759" : last < first ? "#FF3B30" : "#8E8E93";

  const data: SparklineDataPoint[] = scores.map((score, i) => ({
    score,
    date: dates?.[i],
    i,
  }));

  return (
    <div className="flex flex-col items-start gap-0.5">
      {label && (
        <span className="text-[10px] font-medium text-muted-foreground tracking-wide uppercase">{label}</span>
      )}
      <div style={{ width, height }} className="cursor-crosshair">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "3 3" }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: color, stroke: "var(--background)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
