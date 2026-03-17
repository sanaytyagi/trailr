"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface DeadlineEntry {
  collegeId: string;
  collegeName: string;
  deadline: string; // YYYY-MM-DD
}

interface DeadlineCalendarProps {
  entries: DeadlineEntry[];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDotColor(iso: string, today: Date, isSelected: boolean, isPast: boolean): string {
  if (isSelected) return "bg-primary-foreground";
  if (isPast) return "bg-destructive/60";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7)  return "bg-destructive";
  if (diffDays <= 30) return "bg-[hsl(38,85%,50%)]";
  return "bg-[hsl(142,60%,45%)]";
}

function formatRelative(iso: string, today: Date): { label: string; overdue: boolean } {
  const date = parseLocalDate(iso);
  const diffMs = date.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, overdue: true };
  if (diffDays === 0) return { label: "Today", overdue: false };
  if (diffDays === 1) return { label: "Tomorrow", overdue: false };
  if (diffDays <= 7) return { label: `${diffDays}d away`, overdue: false };
  return {
    label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    overdue: false,
  };
}

export function DeadlineCalendar({ entries }: DeadlineCalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const navigate = (fn: () => void) => {
    setSelectedIso(null);
    setIsNavigating(true);
    fn();
    setTimeout(() => setIsNavigating(false), 120);
  };

  const prevMonth = () => navigate(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  });
  const nextMonth = () => navigate(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  });

  // Map ISO date -> colleges with that deadline
  const deadlineMap = useMemo(() => {
    const map = new Map<string, DeadlineEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.deadline) ?? [];
      arr.push(e);
      map.set(e.deadline, arr);
    }
    return map;
  }, [entries]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Upcoming deadlines sorted by date (show all, past first then future)
  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => a.deadline.localeCompare(b.deadline));
  }, [entries]);

  const overdue = sorted.filter(e => e.deadline < todayIso);

  // Next 7 calendar days (today through today+6) grouped by date
  const next5Days = useMemo(() => {
    const days: { iso: string; label: string; entries: DeadlineEntry[] }[] = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayEntries = deadlineMap.get(iso) ?? [];
      if (dayEntries.length > 0) {
        const label =
          i === 0 ? "Today" :
          i === 1 ? "Tomorrow" :
          d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        days.push({ iso, label, entries: dayEntries });
      }
    }
    return days;
  }, [today, deadlineMap]);

  const selectedEntries = selectedIso ? (deadlineMap.get(selectedIso) ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Calendar card */}
      <div className="rounded-xl border border-border bg-card p-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className={cn("grid grid-cols-7 gap-y-1", isNavigating && "pointer-events-none")}>
          {Array.from({ length: totalCells }, (_, i) => {
            const day = i - firstDay + 1;
            const isCurrentMonth = day >= 1 && day <= daysInMonth;
            const iso = isCurrentMonth
              ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              : null;
            const hasDeadline = iso ? deadlineMap.has(iso) : false;
            const isToday = iso === todayIso;
            const isSelected = iso !== null && iso === selectedIso;
            const isPast = iso ? iso < todayIso : false;

            return (
              <button
                key={i}
                disabled={!isCurrentMonth}
                onClick={() => {
                  if (!isCurrentMonth || !iso) return;
                  setSelectedIso(prev => prev === iso ? null : iso);
                }}
                className={cn(
                  "relative flex flex-col items-center justify-center h-9 w-full rounded-md text-xs transition-colors",
                  !isCurrentMonth && "invisible",
                  isCurrentMonth && !isSelected && !isToday && "text-foreground hover:bg-muted",
                  isToday && !isSelected && "font-bold text-primary",
                  isSelected && "bg-primary text-primary-foreground font-semibold",
                  isPast && !isToday && !isSelected && "text-muted-foreground",
                )}
              >
                {isCurrentMonth ? day : ""}
                {hasDeadline && iso && (
                  <span
                    className={cn(
                      "absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full",
                      getDotColor(iso, today, isSelected, isPast)
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day tooltip */}
        {selectedEntries.length > 0 && selectedIso && (
          <div className="mt-3 border-t border-border pt-3 space-y-1">
            {selectedEntries.map((e) => (
              <div key={e.collegeId} className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", getDotColor(selectedIso, today, false, selectedIso < todayIso))} />
                <span className="text-xs text-foreground truncate">{e.collegeName}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deadline list */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Upcoming Deadlines <span className="text-xs font-normal text-muted-foreground">(next 7 days)</span></span>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No deadlines set. Use the "Set date" button on any college row.
          </p>
        ) : (
          <div className="space-y-1">
            {/* Overdue section */}
            {overdue.length > 0 && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive mb-1">Overdue</p>
                {overdue.map((e) => {
                  const rel = formatRelative(e.deadline, today);
                  return (
                    <div key={e.collegeId} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <span className="text-xs text-foreground truncate flex-1">{e.collegeName}</span>
                      <span className="text-[10px] font-medium text-destructive shrink-0">{rel.label}</span>
                    </div>
                  );
                })}
                {next5Days.length > 0 && <div className="my-2 border-t border-border" />}
              </>
            )}

            {/* Next 5 days grouped */}
            {next5Days.length === 0 && overdue.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No deadlines in the next 7 days.</p>
            )}
            {next5Days.map(({ iso, label, entries: dayEntries }, idx) => (
              <div key={iso}>
                {idx > 0 && <div className="my-2 border-t border-border" />}
                <p className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider mb-1",
                  label === "Today" ? "text-destructive" :
                  label === "Tomorrow" ? "text-[hsl(38,85%,35%)]" :
                  "text-muted-foreground"
                )}>
                  {label}
                </p>
                {dayEntries.map((e) => (
                  <div key={e.collegeId} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                    <span className="text-xs text-foreground truncate">{e.collegeName}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
