import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAcceptanceRate(rate: number | null): string {
  if (rate === null || rate === undefined) return "N/A";
  return `${rate.toFixed(1)}%`;
}

export type DeadlineStatus = "safe" | "warning" | "urgent" | "passed" | "na";

export function getDaysUntilDeadline(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

export function getDeadlineStatus(dateStr: string | null): DeadlineStatus {
  if (!dateStr) return "na";
  const days = getDaysUntilDeadline(dateStr);
  if (days === null) return "na";
  if (days < 0) return "passed";
  if (days <= 3) return "urgent";
  if (days <= 14) return "warning";
  return "safe";
}

export function formatDeadlineShort(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
