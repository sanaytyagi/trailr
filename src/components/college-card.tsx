"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Trash2, ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAcceptanceRate } from "@/lib/utils";
import type { TrackedCollege, ApplicationStatus, DecisionResult } from "@/types";

// ─── Application options ──────────────────────────────────────────────────────

type AppOption = {
  value: ApplicationStatus;
  label: string;
  color: string;
  bg: string;
  border: string;
};

const APP_OPTIONS: AppOption[] = [
  { value: "not_started", label: "Not Started", color: "hsl(0,65%,42%)",   bg: "hsl(0,65%,96%)",   border: "hsl(0,65%,80%)"  },
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

// ─── Portal dropdown ──────────────────────────────────────────────────────────

interface PortalDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
}

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
              top: rect.bottom + 6,
              left: rect.left,
              zIndex: 9999,
              minWidth: Math.max(rect.width, 160),
            }}
            className="rounded-xl border border-border bg-card shadow-xl py-1.5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children}
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

// ─── Row ──────────────────────────────────────────────────────────────────────

interface CollegeRowProps {
  college: TrackedCollege;
  onRemove: (id: string) => void;
  onViewDetails: (college: TrackedCollege) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDecisionChange: (id: string, decision: DecisionResult | null) => void;
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
  isLast,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
}: CollegeRowProps) {
  const appOption = APP_OPTIONS.find((o) => o.value === college.application_status) ?? APP_OPTIONS[0];
  const decisionConfig = getDecisionConfig(college.decision);
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
        isDragging ? "opacity-40" : "hover:bg-muted/25",
        !isLast && "border-b border-border"
      )}
      style={{ boxShadow: `inset 4px 0 0 ${borderColor}` }}
    >
      {/* Drag handle */}
      <td className="pl-3 w-8 cursor-grab active:cursor-grabbing text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </td>

      {/* University */}
      <td className="pl-2 pr-4 py-3.5">
        <button onClick={() => onViewDetails(college)} className="text-left group/name">
          <span className="font-medium text-foreground group-hover/name:text-primary transition-colors leading-tight">
            {college.name}
          </span>
          {college.location && (
            <span className="block text-xs text-muted-foreground mt-0.5">
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
            className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground hover:text-primary transition-colors w-fit"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Website</span>
          </a>
        )}
      </td>

      {/* Acceptance rate */}
      <td className="px-4 py-3.5 text-sm text-foreground tabular-nums whitespace-nowrap">
        {formatAcceptanceRate(college.acceptance_rate)}
      </td>

      {/* Application dropdown */}
      <td className="px-4 py-3.5">
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
          {APP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onStatusChange(college.id, opt.value);
                if (opt.value === "submitted") {
                  onDecisionChange(college.id, "pending");
                } else {
                  onDecisionChange(college.id, null);
                }
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
      <td className="px-4 py-3.5">
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
          {college.decision && (
            <>
              <button
                onClick={() => onDecisionChange(college.id, null)}
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
              onClick={() => onDecisionChange(college.id, opt.value)}
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
        </PortalDropdown>
      </td>

      {/* Remove */}
      <td className="pr-3 py-3.5">
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
