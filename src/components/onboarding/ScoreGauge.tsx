import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ScoreResult, Classification } from "@/services/scoreEngine";

interface ScoreGaugeProps {
  score: ScoreResult;
  size?: "sm" | "md" | "lg";
}

const CLASS_LABELS: Record<Classification, string> = {
  Bronze: "BRONZE",
  Prata: "PRATA",
  Ouro: "OURO",
  Diamante: "DIAMANTE",
};

export default function ScoreGauge({ score, size = "md" }: ScoreGaugeProps) {
  const radius = size === "lg" ? 60 : size === "md" ? 48 : 34;
  const stroke = size === "lg" ? 8 : size === "md" ? 6 : 5;
  const normalized = 2 * Math.PI * radius;
  const offset = normalized - (score.total / 100) * normalized;

  const labelSize = size === "lg" ? "text-3xl" : size === "md" ? "text-2xl" : "text-lg";
  const ringSize = size === "lg" ? "w-36 h-36" : size === "md" ? "w-28 h-28" : "w-20 h-20";

  return (
    <div className={cn("flex flex-col items-center gap-1", ringSize)}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 108 108">
        <circle
          cx="54"
          cy="54"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
        />
        <motion.circle
          cx="54"
          cy="54"
          r={radius}
          fill="none"
          stroke={score.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={normalized}
          initial={{ strokeDashoffset: normalized }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <motion.span
          key={score.total}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn("font-bold text-foreground", labelSize)}
        >
          {score.total}
        </motion.span>
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: score.color }}>
          {CLASS_LABELS[score.classification]}
        </span>
      </div>
    </div>
  );
}

export function ScoreBreakdownBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}
