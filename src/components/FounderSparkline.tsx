import { LineChart, Line, ResponsiveContainer } from "recharts";

interface FounderSparklineProps {
  scores: number[];
}

export function FounderSparkline({ scores }: FounderSparklineProps) {
  if (!scores || scores.length < 2) return null;

  const first = scores[0];
  const last = scores[scores.length - 1];
  const color = last > first ? "#34C759" : last < first ? "#FF3B30" : "#8E8E93";

  const data = scores.map((score, i) => ({ score, i }));

  return (
    <div className="w-[80px] h-[30px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
