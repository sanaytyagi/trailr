import { cn } from "@/lib/utils";
import {
  getDeadlineStatus,
  formatDeadlineShort,
  getDaysUntilDeadline,
} from "@/lib/utils";
import type { DeadlineStatus } from "@/types";

interface DeadlineBadgeProps {
  label: string;
  dateStr: string | null;
  className?: string;
}

const statusClasses: Record<DeadlineStatus, string> = {
  safe: "deadline-safe",
  warning: "deadline-warning",
  urgent: "deadline-urgent",
  passed: "deadline-passed",
  na: "",
};

export function DeadlineBadge({ label, dateStr, className }: DeadlineBadgeProps) {
  const status = getDeadlineStatus(dateStr);
  const days = getDaysUntilDeadline(dateStr);
  const formatted = formatDeadlineShort(dateStr);

  if (status === "na") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
          "border-border bg-muted text-muted-foreground",
          className
        )}
      >
        <span className="font-semibold">{label}:</span>
        <span>N/A</span>
      </span>
    );
  }

  const urgencyClass = statusClasses["safe"];

  const displayText = () => {
    if (status === "passed") {
      return (
        <>
          <span className="font-semibold">{label}:</span>
          <span>{formatted}</span>
        </>
      );
    }
    if (status === "warning" && days !== null) {
      return (
        <>
          <span className="font-semibold">{label}:</span>
          <span>{formatted}</span>
          <span className="opacity-75">— {days}d</span>
        </>
      );
    }
    if (status === "urgent" && days !== null) {
      return (
        <>
          <span className="font-semibold">{label}:</span>
          <span>{formatted}</span>
          <span className="opacity-75">— {days}d!</span>
        </>
      );
    }
    return (
      <>
        <span className="font-semibold">{label}:</span>
        <span>{formatted}</span>
      </>
    );
  };

  return (
    <span
      aria-label={`${label} deadline: ${formatted}${status === "passed" ? " (passed)" : days !== null ? `, ${days} days remaining` : ""}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        urgencyClass,
        className
      )}
    >
      {displayText()}
    </span>
  );
}
