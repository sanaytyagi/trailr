"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDisplay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

interface CalendarDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

function CalendarDropdown({ value, onChange }: CalendarDropdownProps) {
  const today = new Date();
  const initial = value ? (() => { const [y, m] = value.split("-").map(Number); return { y, m: m - 1 }; })() : null;

  const [viewYear, setViewYear] = useState(initial?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial?.m ?? today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(iso);
  };

  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="w-64 rounded-xl border border-border bg-card p-3 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
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
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: totalCells }, (_, i) => {
          const day = i - firstDay + 1;
          const isCurrentMonth = day >= 1 && day <= daysInMonth;
          const iso = isCurrentMonth
            ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            : null;
          const isSelected = iso && iso === value;
          const isToday = iso && iso === todayIso;

          return (
            <button
              key={i}
              disabled={!isCurrentMonth}
              onClick={() => isCurrentMonth && selectDay(day)}
              className={cn(
                "flex h-8 w-full items-center justify-center rounded-md text-sm transition-colors",
                !isCurrentMonth && "invisible",
                isCurrentMonth && !isSelected && "text-foreground hover:bg-muted",
                isSelected && "bg-primary text-primary-foreground font-semibold",
                isToday && !isSelected && "font-semibold text-primary",
              )}
            >
              {isCurrentMonth ? day : ""}
            </button>
          );
        })}
      </div>

      {/* Clear */}
      {value && (
        <div className="mt-2 border-t border-border pt-2">
          <button
            onClick={() => onChange(null)}
            className="w-full rounded-md py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Clear date
          </button>
        </div>
      )}
    </div>
  );
}

interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const openPicker = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(true);
  }, []);

  const closePicker = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        closePicker();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, closePicker]);

  useEffect(() => {
    if (!open) return;
    function update() {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const handleChange = (newValue: string | null) => {
    onChange(newValue);
    closePicker();
  };

  const CALENDAR_HEIGHT = 310;

  const panel =
    open && rect
      ? createPortal(
          <div
            style={{
              position: "fixed",
              ...(window.innerHeight - rect.bottom < CALENDAR_HEIGHT
                ? { bottom: window.innerHeight - rect.top + 6 }
                : { top: rect.bottom + 6 }),
              left: rect.left,
              zIndex: 9999,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <CalendarDropdown value={value} onChange={handleChange} />
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div ref={triggerRef} className="inline-block" onClick={() => (open ? closePicker() : openPicker())}>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors whitespace-nowrap",
            value
              ? "border-border text-foreground hover:border-primary"
              : "border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          {value ? formatDisplay(value) : "Set date"}
        </button>
      </div>
      {panel}
    </>
  );
}
