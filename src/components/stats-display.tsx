import { cn } from "@/lib/utils";
import { formatAcceptanceRate } from "@/lib/utils";

interface StatsDisplayProps {
  acceptanceRate: number | null;
  className?: string;
  size?: "sm" | "lg";
}

export function StatsDisplay({
  acceptanceRate,
  className,
  size = "sm",
}: StatsDisplayProps) {
  const formatted = formatAcceptanceRate(acceptanceRate);
  const isNA = acceptanceRate === null || acceptanceRate === undefined;

  return (
    <span
      className={cn(
        "font-mono font-medium tabular-nums",
        size === "sm" && "text-sm",
        size === "lg" && "text-3xl font-semibold",
        isNA ? "text-muted-foreground" : "text-foreground",
        className
      )}
      aria-label={`Acceptance rate: ${formatted}`}
    >
      {formatted}
    </span>
  );
}
