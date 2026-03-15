import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAcceptanceRate(rate: number | null): string {
  if (rate === null || rate === undefined) return "N/A";
  return `${rate.toFixed(1)}%`;
}
