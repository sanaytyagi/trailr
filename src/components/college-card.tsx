"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";
import { Trash2, ChevronDown, ExternalLink, FileText } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { formatAcceptanceRate } from "@/lib/utils";
import type { TrackedCollege, ApplicationStatus, DecisionResult, AdmissionsCategory } from "@/types";

// ─── Application options ──────────────────────────────────────────────────────

type AppOption = {
  value: ApplicationStatus;
  label: string;
  color: string;
  bg: string;
  border: string;
};

const APP_OPTIONS: AppOption[] = [
  { value: "not_started", label: "Not Started", color: "hsl(215,15%,50%)", bg: "hsl(215,15%,94%)", border: "hsl(215,15%,78%)" },
  { value: "in_progress", label: "In Progress", color: "hsl(38,85%,35%)",  bg: "hsl(38,85%,95%)",  border: "hsl(38,85%,75%)" },
  { value: "submitted",   label: "Submitted",   color: "hsl(205,85%,50%)", bg: "hsl(205,85%,96%)", border: "hsl(205,85%,78%)"},
];

// ─── Decision options ─────────────────────────────────────────────────────────

type DecisionOption = {
  value: DecisionResult;
  label: string;
  color: string;
  bg: string;
  border: string;
};

const DECISION_OPTIONS: DecisionOption[] = [
  { value: "pending",    label: "Pending",    color: "hsl(220,70%,28%)",  bg: "hsl(220,70%,95%)",  border: "hsl(220,70%,72%)"  },
  { value: "accepted",   label: "Accepted",   color: "hsl(142,60%,30%)",  bg: "hsl(142,60%,95%)",  border: "hsl(142,60%,78%)"  },
  { value: "rejected",   label: "Rejected",   color: "hsl(0,65%,42%)",    bg: "hsl(0,65%,96%)",    border: "hsl(0,65%,80%)"    },
  { value: "waitlisted", label: "Waitlisted", color: "hsl(38,85%,35%)",   bg: "hsl(38,85%,95%)",   border: "hsl(38,85%,75%)"   },
  { value: "deferred",   label: "Deferred",   color: "hsl(25,85%,38%)",   bg: "hsl(25,85%,95%)",   border: "hsl(25,85%,78%)"   },
];

function getDecisionConfig(d: DecisionResult | null) {
  return DECISION_OPTIONS.find((o) => o.value === d) ?? null;
}

// ─── Admissions category options ──────────────────────────────────────────────

type CategoryOption = {
  value: AdmissionsCategory;
  label: string;
  color: string;
  bg: string;
  border: string;
};

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "reach",  label: "Reach",  color: "hsl(0,65%,42%)",    bg: "hsl(0,65%,96%)",    border: "hsl(0,65%,80%)"    },
  { value: "target", label: "Target", color: "hsl(38,85%,35%)",   bg: "hsl(38,85%,95%)",   border: "hsl(38,85%,75%)"   },
  { value: "safety", label: "Safety", color: "hsl(142,60%,30%)",  bg: "hsl(142,60%,95%)",  border: "hsl(142,60%,78%)"  },
];

function getCategoryConfig(c: AdmissionsCategory | null) {
  return CATEGORY_OPTIONS.find((o) => o.value === c) ?? null;
}

// ─── Deadline helpers ─────────────────────────────────────────────────────────

function getDeadlineStatus(iso: string): { label: string; className: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split("-").map(Number);
  const deadline = new Date(y, m - 1, d);
  const diffDays = Math.round((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0)  return { label: "Overdue",        className: "text-destructive" };
  if (diffDays === 0) return { label: "Today",          className: "text-destructive" };
  if (diffDays <= 7)  return { label: `${diffDays}d left`, className: "text-destructive" };
  if (diffDays <= 30) return { label: `${diffDays}d left`, className: "text-[hsl(38,85%,35%)]" };
  return { label: `${diffDays}d left`, className: "text-[hsl(142,60%,35%)]" };
}

// ─── Portal dropdown ──────────────────────────────────────────────────────────

interface PortalDropdownProps {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}

const DROPDOWN_HEIGHT = 220;

function PortalDropdown({ trigger, children }: PortalDropdownProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const openDropdown = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(true);
  }, []);

  const closeDropdown = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, closeDropdown]);

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

  const panel =
    open && rect
      ? createPortal(
          <div
            style={{
              position: "fixed",
              ...(window.innerHeight - rect.bottom < DROPDOWN_HEIGHT
                ? { bottom: window.innerHeight - rect.top + 6 }
                : { top: rect.bottom + 6 }),
              left: rect.left,
              zIndex: 9999,
              minWidth: Math.max(rect.width, 160),
            }}
            className="rounded-xl border border-border bg-card shadow-xl py-1.5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children(closeDropdown)}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-block"
        onClick={() => (open ? closeDropdown() : openDropdown())}
      >
        {trigger}
      </div>
      {panel}
    </>
  );
}

// ─── Deadline cell ────────────────────────────────────────────────────────────

function DeadlineCell({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const status = value ? getDeadlineStatus(value) : null;
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <DatePicker value={value} onChange={onChange} />
      {status && (
        <span className={cn("text-[15px] font-semibold pl-0.5 leading-tight", status.className)}>
          {status.label}
        </span>
      )}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

interface CollegeRowProps {
  college: TrackedCollege;
  onRemove: (id: string) => void;
  onViewDetails: (college: TrackedCollege) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDecisionChange: (id: string, decision: DecisionResult | null) => void;
  onDeadlineChange: (id: string, deadline: string | null) => void;
  onCategoryChange: (id: string, category: AdmissionsCategory | null) => void;
  onNotesChange: (id: string, notes: string) => void;
  isLast: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent<HTMLTableRowElement>) => void;
  onDragEnd: () => void;
}


export const CollegeRow = memo(function CollegeRow({
  college,
  onRemove,
  onViewDetails,
  onStatusChange,
  onDecisionChange,
  onDeadlineChange,
  onCategoryChange,
  onNotesChange,
  isLast,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
}: CollegeRowProps) {
  const appOption = APP_OPTIONS.find((o) => o.value === college.application_status) ?? APP_OPTIONS[0];
  const decisionConfig = getDecisionConfig(college.decision);
  const categoryConfig = getCategoryConfig(college.admissions_category);
  const borderColor = decisionConfig?.color ?? "hsl(270,60%,55%)";

  return (
    <tr
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={cn(
        "group transition-colors",
        isDragging ? "opacity-40" : "hover:bg-muted/30",
        !isLast && "border-b border-border"
      )}
      style={{ boxShadow: `inset 4px 0 0 ${borderColor}` }}
    >
      {/* Drag handle */}
      <td className="pl-3 w-8 cursor-grab active:cursor-grabbing text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </td>

      {/* University */}
      <td className="pl-2 pr-4 py-4">
        <button onClick={() => onViewDetails(college)} className="text-left group/name">
          <span className="font-medium text-foreground group-hover/name:text-primary transition-colors leading-tight">
            {college.name}
          </span>
          {college.location && (
            <span className="block text-xs text-muted-foreground mt-1">
              {college.location}
            </span>
          )}
        </button>
        {college.website_url && (
          <a
            href={college.website_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-primary transition-colors w-fit"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Website</span>
          </a>
        )}
      </td>

      {/* Acceptance rate */}
      <td className="px-4 py-4 text-sm text-foreground tabular-nums whitespace-nowrap">
        {formatAcceptanceRate(college.acceptance_rate)}
      </td>

      {/* Admissions category */}
      <td className="px-4 py-4">
        <PortalDropdown
          trigger={
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap"
              style={
                categoryConfig
                  ? { color: categoryConfig.color, backgroundColor: categoryConfig.bg, borderColor: categoryConfig.border }
                  : { color: "var(--muted-foreground)", backgroundColor: "var(--muted)", borderColor: "var(--border)" }
              }
            >
              {categoryConfig ? categoryConfig.label : "—"}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>
          }
        >
          {(close) => (
            <>
              {college.admissions_category && (
                <>
                  <button
                    onClick={() => { onCategoryChange(college.id, null); close(); }}
                    className="w-full text-left px-3.5 py-2 text-sm text-muted-foreground hover:bg-muted/60 rounded-lg mx-0.5 transition-colors"
                  >
                    Clear
                  </button>
                  <div className="my-1 mx-2 border-t border-border" />
                </>
              )}
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onCategoryChange(college.id, opt.value); close(); }}
                  className="w-full text-left px-3.5 py-2 text-sm font-semibold rounded-lg mx-0.5 transition-all flex items-center gap-2.5 hover:opacity-90"
                  style={{
                    color: opt.color,
                    backgroundColor: college.admissions_category === opt.value ? opt.bg : "transparent",
                  }}
                >
                  <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </>
          )}
        </PortalDropdown>
      </td>

      {/* Application dropdown */}
      <td className="px-4 py-4">
        <PortalDropdown
          trigger={
            <button
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
              style={{ color: appOption.color, backgroundColor: appOption.bg, borderColor: appOption.border }}
            >
              {appOption.label}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
          }
        >
          {(close) => APP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onStatusChange(college.id, opt.value);
                if (opt.value === "submitted") {
                  onDecisionChange(college.id, "pending");
                } else {
                  onDecisionChange(college.id, null);
                }
                close();
              }}
              className="w-full text-left px-3.5 py-2 text-sm font-medium rounded-lg mx-0.5 transition-all flex items-center gap-2.5 hover:opacity-90"
              style={{
                color: opt.color,
                backgroundColor: college.application_status === opt.value ? opt.bg : "transparent",
              }}
            >
              <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
              {opt.label}
            </button>
          ))}
        </PortalDropdown>
      </td>

      {/* Decision dropdown */}
      <td className="px-4 py-4">
        <PortalDropdown
          trigger={
            <button
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
              style={
                decisionConfig
                  ? { color: decisionConfig.color, backgroundColor: decisionConfig.bg, borderColor: decisionConfig.border }
                  : { color: "var(--muted-foreground)", backgroundColor: "var(--muted)", borderColor: "var(--border)" }
              }
            >
              {decisionConfig ? decisionConfig.label : "—"}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
          }
        >
          {(close) => (<>
            {college.decision && (
              <>
                <button
                  onClick={() => { onDecisionChange(college.id, null); close(); }}
                  className="w-full text-left px-3.5 py-2 text-sm text-muted-foreground hover:bg-muted/60 rounded-lg mx-0.5 transition-colors"
                >
                  Clear
                </button>
                <div className="my-1 mx-2 border-t border-border" />
              </>
            )}
            {DECISION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  if (opt.value === "accepted") {
                    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
                  }
                  onDecisionChange(college.id, opt.value);
                  close();
                }}
                className="w-full text-left px-3.5 py-2 text-sm font-medium rounded-lg mx-0.5 transition-all flex items-center gap-2.5 hover:opacity-90"
                style={{
                  color: opt.color,
                  backgroundColor: college.decision === opt.value ? opt.bg : "transparent",
                }}
              >
                <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                {opt.label}
              </button>
            ))}
          </>)}
        </PortalDropdown>
      </td>

      {/* Deadline */}
      <td className="px-4 py-4">
        <DeadlineCell
          value={college.personal_deadline}
          onChange={(v) => onDeadlineChange(college.id, v)}
        />
      </td>

      {/* Notes */}
      <td className="px-2 py-4">
        <PortalDropdown
          trigger={
            <button
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-all",
                college.notes
                  ? "text-primary bg-primary/10 hover:bg-primary/15"
                  : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-muted-foreground"
              )}
              aria-label="Notes"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
          }
        >
          {(close) => (
            <div className="p-3 w-64">
              <p className="text-xs font-semibold text-muted-foreground mb-2 truncate">
                Notes — {college.name}
              </p>
              <textarea
                autoFocus
                value={college.notes}
                onChange={(e) => onNotesChange(college.id, e.target.value)}
                placeholder="Add notes for this college…"
                rows={5}
                className="w-full text-sm text-foreground bg-muted/40 rounded-lg px-2.5 py-2 resize-none outline-none placeholder:text-muted-foreground/50 focus:bg-muted/60 transition-colors"
                onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); close(); } }}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={close}
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </PortalDropdown>
      </td>

      {/* Remove */}
      <td className="pr-3 py-4">
        <button
          onClick={() => onRemove(college.id)}
          className="rounded-md p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remove ${college.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
});
