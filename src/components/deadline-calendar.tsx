"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface DeadlineEntry {
  collegeId: string;
  collegeName: string;       // "StudentName — CollegeName" for counselor, just college for student
  deadline: string;          // YYYY-MM-DD
  studentId?: string;        // counselor navigation
  applicationStatus?: string; // status indicator
  studentName?: string;      // rich card display
  rawCollegeName?: string;   // rich card display
}

interface DeadlineCalendarProps {
  entries: DeadlineEntry[];
  onEntryClick?: (entry: DeadlineEntry) => void;
  twoColumn?: boolean;
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

function getEntryDotColor(iso: string, today: Date): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0)   return "bg-destructive";
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

const LEGEND = [
  { dot: "bg-destructive",          label: "Due soon (≤7d)"  },
  { dot: "bg-[hsl(38,85%,50%)]",   label: "Upcoming (≤30d)" },
  { dot: "bg-[hsl(142,60%,45%)]",  label: "Later"           },
  { dot: "bg-destructive/60",       label: "Overdue"         },
];

export function DeadlineCalendar({ entries, onEntryClick, twoColumn }: DeadlineCalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewYear, setViewYear]     = useState(today.getFullYear());
  const [viewMonth, setViewMonth]   = useState(today.getMonth());
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(7);

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

  // Map ISO date -> entries with that deadline
  const deadlineMap = useMemo(() => {
    const map = new Map<string, DeadlineEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.deadline) ?? [];
      arr.push(e);
      map.set(e.deadline, arr);
    }
    return map;
  }, [entries]);

  const daysInMonth    = getDaysInMonth(viewYear, viewMonth);
  const firstDay       = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells     = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const sorted = useMemo(() => [...entries].sort((a, b) => a.deadline.localeCompare(b.deadline)), [entries]);

  // Overdue: past deadline + not submitted (or no status set)
  const overdue = useMemo(() =>
    sorted.filter(e => e.deadline < todayIso && e.applicationStatus !== "submitted"),
  [sorted, todayIso]);

  // Window end date for label
  const windowEnd = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() + windowDays);
    return d;
  }, [today, windowDays]);

  const windowEndLabel = windowEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // Upcoming deadlines grouped by day within window
  const upcomingDays = useMemo(() => {
    const days: { iso: string; label: string; entries: DeadlineEntry[] }[] = [];
    for (let i = 0; i <= windowDays; i++) {
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
  }, [today, deadlineMap, windowDays]);

  const selectedEntries = selectedIso ? (deadlineMap.get(selectedIso) ?? []) : [];
  const isRichMode = entries.some(e => !!e.studentName);

  return (
    <div className={twoColumn ? "flex flex-col gap-6 lg:flex-row lg:items-start" : "flex flex-col gap-4"}>
      {/* ── Calendar card ────────────────────────────────────────────────────── */}
      <div className={cn("rounded-xl border border-border bg-card p-4", twoColumn && "w-full lg:w-72 lg:shrink-0")}>
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">{MONTHS[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
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
            const isToday    = iso === todayIso;
            const isSelected = iso !== null && iso === selectedIso;
            const isPast     = iso ? iso < todayIso : false;

            return (
              <button
                key={i}
                disabled={!isCurrentMonth}
                onClick={() => { if (!isCurrentMonth || !iso) return; setSelectedIso(prev => prev === iso ? null : iso); }}
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
                  <span className={cn("absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full", getDotColor(iso, today, isSelected, isPast))} />
                )}
              </button>
            );
          })}
        </div>

        {/* Change 4: Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border flex-wrap">
          {LEGEND.map(({ dot, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Change 5: Selected day detail */}
        {selectedEntries.length > 0 && selectedIso && (
          <div className="mt-3 border-t border-border pt-3 space-y-1">
            {selectedEntries.map((e) => {
              if (!isRichMode) {
                return (
                  <div key={e.collegeId} className="flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", getDotColor(selectedIso, today, false, selectedIso < todayIso))} />
                    <span className="text-xs text-foreground truncate">{e.collegeName}</span>
                  </div>
                );
              }
              const rel = formatRelative(e.deadline, today);
              const isSubmitted = e.applicationStatus === "submitted";
              const statusLabel = isSubmitted ? "Submitted" : e.applicationStatus === "in_progress" ? "In Progress" : "Not Started";
              const statusStyle = isSubmitted
                ? { color: "hsl(142,60%,30%)", backgroundColor: "hsl(142,60%,95%)" }
                : e.applicationStatus === "in_progress"
                ? { color: "hsl(38,85%,35%)", backgroundColor: "hsl(38,85%,95%)" }
                : { color: "hsl(215,15%,50%)", backgroundColor: "hsl(215,15%,94%)" };
              return (
                <div
                  key={e.collegeId}
                  onClick={() => onEntryClick?.(e)}
                  className={cn(
                    "rounded-lg border border-border bg-muted/20 px-3 py-2 mt-2 first:mt-0",
                    onEntryClick && "cursor-pointer hover:bg-muted/40 transition-colors"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-foreground truncate">{e.studentName}</p>
                    <span className={cn("text-[10px] font-semibold shrink-0 tabular-nums", rel.overdue ? "text-destructive" : "text-muted-foreground")}>
                      {rel.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mb-1">{e.rawCollegeName}</p>
                  <span className="inline-block text-[10px] font-medium rounded px-1.5 py-0.5" style={statusStyle}>
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Deadline list ─────────────────────────────────────────────────────── */}
      <div className={cn("rounded-xl border border-border bg-card p-4", twoColumn && "flex-1 min-w-0")}>
        {/* Header with Change 6 toggle */}
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground">
            Upcoming Deadlines
          </span>
          <div className="flex items-center gap-0.5 ml-auto">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setWindowDays(d)}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                  windowDays === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No deadlines set. Use the "Set date" button on any college row.
          </p>
        ) : (
          <div className="space-y-1">
            {/* Change 2: Overdue section — only unsubmitted */}
            {overdue.length > 0 && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive mb-1">Overdue</p>
                {overdue.map((e) => {
                  const rel = formatRelative(e.deadline, today);
                  return (
                    <div
                      key={e.collegeId}
                      onClick={() => onEntryClick?.(e)}
                      className={cn(
                        "flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg transition-colors",
                        onEntryClick ? "cursor-pointer hover:bg-red-50" : "hover:bg-muted/50"
                      )}
                    >
                      {/* Change 1: red dot for unsubmitted overdue */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                        <span className="text-xs text-foreground truncate">{e.collegeName}</span>
                      </div>
                      <span className="text-[10px] font-medium text-destructive shrink-0">{rel.label}</span>
                    </div>
                  );
                })}
                {upcomingDays.length > 0 && <div className="my-2 border-t border-border" />}
              </>
            )}

            {/* Upcoming days grouped */}
            {upcomingDays.length === 0 && overdue.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No deadlines in the next {windowDays} days.</p>
            )}

            {upcomingDays.map(({ iso, label, entries: dayEntries }, idx) => (
              <div key={iso}>
                {idx > 0 && <div className="my-2 border-t border-border" />}
                <p className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider mb-1",
                  label === "Today"    ? "text-destructive"          :
                  label === "Tomorrow" ? "text-[hsl(38,85%,35%)]"   :
                  "text-muted-foreground"
                )}>
                  {label}
                </p>
                {dayEntries.map((e) => {
                  const isSubmitted = e.applicationStatus === "submitted";
                  return (
                    <div
                      key={e.collegeId}
                      onClick={() => onEntryClick?.(e)}
                      className={cn(
                        "flex items-center gap-2 py-1 px-2 rounded-lg transition-colors",
                        isSubmitted ? "opacity-50" : "",
                        onEntryClick ? "cursor-pointer hover:bg-muted/50" : "hover:bg-muted/50"
                      )}
                    >
                      {/* Change 1: green check for submitted, urgency dot for unsubmitted */}
                      {isSubmitted
                        ? <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        : <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", getEntryDotColor(iso, today))} />
                      }
                      <span className={cn("text-xs truncate", isSubmitted ? "text-muted-foreground" : "text-foreground")}>
                        {e.collegeName}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
