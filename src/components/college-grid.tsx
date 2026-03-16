"use client";

import React, { useMemo, useState, useEffect } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { CollegeRow } from "./college-card";
import { EmptyState } from "./empty-state";
import { cn } from "@/lib/utils";
import type { TrackedCollege, ApplicationStatus, ApplicationRound, DecisionResult, AdmissionsCategory } from "@/types";

const ORDER_KEY = "college-trackr-order";

type SortCol = "name" | "acceptance_rate" | "category" | "application" | "round" | "decision" | "deadline";
type SortDir = "asc" | "desc";

// ── Custom sort-order maps ─────────────────────────────────────────────────
const CATEGORY_ORDER: Record<string, number> = { reach: 0, target: 1, safety: 2 };
const APP_ORDER: Record<string, number>      = { not_started: 0, in_progress: 1, submitted: 2 };
const ROUND_ORDER: Record<string, number>    = { ea: 0, ed: 1, rd: 2, rolling: 3, unknown: 4 };
const DECISION_ORDER: Record<string, number> = { pending: 0, accepted: 1, rejected: 2, waitlisted: 3, deferred: 4 };

// ── Sortable header cell ───────────────────────────────────────────────────
function SortableHeader({
  col, label, sortCol, sortDir, onSort, className,
}: {
  col: SortCol;
  label: string;
  sortCol: SortCol | null;
  sortDir: SortDir;
  onSort: (col: SortCol) => void;
  className?: string;
}) {
  const active = sortCol === col;
  return (
    <th className={className}>
      <button
        onClick={() => onSort(col)}
        className="flex items-center gap-1 group select-none"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span className={cn(
          "text-xs font-semibold uppercase tracking-wider transition-colors",
          active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        )}>
          {label}
        </span>
        {active ? (
          sortDir === "asc"
            ? <ChevronUp   className="h-3 w-3 text-primary shrink-0" />
            : <ChevronDown className="h-3 w-3 text-primary shrink-0" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
        )}
      </button>
    </th>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────
interface CollegeGridProps {
  colleges: TrackedCollege[];
  onRemove: (id: string) => void;
  onViewDetails: (college: TrackedCollege) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onRoundChange: (id: string, round: ApplicationRound) => void;
  onDecisionChange: (id: string, decision: DecisionResult | null) => void;
  onDeadlineChange: (id: string, deadline: string | null) => void;
  onCategoryChange: (id: string, category: AdmissionsCategory | null) => void;
  onNotesChange: (id: string, notes: string) => void;
  lastAddedId?: string | null;
}

export function CollegeGrid({
  colleges,
  onRemove,
  onViewDetails,
  onStatusChange,
  onRoundChange,
  onDecisionChange,
  onDeadlineChange,
  onCategoryChange,
  onNotesChange,
  lastAddedId,
}: CollegeGridProps) {
  const [order, setOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) setOrder(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (order.length === 0) return;
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); } catch {}
  }, [order]);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const base = [...colleges];

    // ── Active sort column ─────────────────────────────────────────────────
    if (sortCol) {
      const dir = sortDir === "asc" ? 1 : -1;
      return base.sort((a, b) => {
        switch (sortCol) {
          case "name":
            return dir * a.name.localeCompare(b.name);

          case "acceptance_rate": {
            // Nulls always last
            const av = a.acceptance_rate ?? (dir > 0 ? Infinity : -Infinity);
            const bv = b.acceptance_rate ?? (dir > 0 ? Infinity : -Infinity);
            return dir * (av - bv);
          }

          case "category": {
            const av = a.admissions_category != null ? CATEGORY_ORDER[a.admissions_category] : 99;
            const bv = b.admissions_category != null ? CATEGORY_ORDER[b.admissions_category] : 99;
            return dir * (av - bv);
          }

          case "application":
            return dir * (APP_ORDER[a.application_status] - APP_ORDER[b.application_status]);

          case "round": {
            const av = ROUND_ORDER[a.application_round] ?? 99;
            const bv = ROUND_ORDER[b.application_round] ?? 99;
            return dir * (av - bv);
          }

          case "decision": {
            const av = a.decision != null ? DECISION_ORDER[a.decision] : 99;
            const bv = b.decision != null ? DECISION_ORDER[b.decision] : 99;
            return dir * (av - bv);
          }

          case "deadline": {
            // Nulls always last
            const av = a.personal_deadline ? new Date(a.personal_deadline).getTime() : (dir > 0 ? Infinity : -Infinity);
            const bv = b.personal_deadline ? new Date(b.personal_deadline).getTime() : (dir > 0 ? Infinity : -Infinity);
            return dir * (av - bv);
          }

          default: return 0;
        }
      });
    }

    // ── No sort: drag-drop order or alphabetical ──────────────────────────
    if (order.length > 0) {
      const orderMap = new Map(order.map((id, i) => [id, i]));
      return base.sort((a, b) => {
        const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
        const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
        return ai - bi;
      });
    }
    return base.sort((a, b) => a.name.localeCompare(b.name));
  }, [colleges, order, sortCol, sortDir]);

  function handleDragStart(id: string) { setDraggingId(id); }

  function handleDragOver(e: React.DragEvent<HTMLTableRowElement>, index: number) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDropIndex(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
  }

  function handleDrop() {
    if (draggingId === null || dropIndex === null) return;
    const ids = sorted.map((c) => c.id);
    const from = ids.indexOf(draggingId);
    if (from === dropIndex || from + 1 === dropIndex) {
      setDraggingId(null); setDropIndex(null); return;
    }
    const next = [...ids];
    next.splice(from, 1);
    next.splice(dropIndex > from ? dropIndex - 1 : dropIndex, 0, draggingId);
    setOrder(next);
    // Clear sort so drag order is respected
    setSortCol(null);
    setDraggingId(null); setDropIndex(null);
  }

  function handleDragEnd() { setDraggingId(null); setDropIndex(null); }

  if (colleges.length === 0) return <EmptyState />;

  const colSpan = 10;

  const headerBase = "text-left px-4 py-3 whitespace-nowrap";
  const sortProps = { sortCol, sortDir, onSort: handleSort };

  return (
    <div className="table-enter rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="w-8" />
            <SortableHeader col="name"          label="University"   className="text-left pl-2 pr-4 py-3 whitespace-nowrap" {...sortProps} />
            <SortableHeader col="acceptance_rate" label="Acceptance" className={headerBase} {...sortProps} />
            <SortableHeader col="category"      label="Category"     className={headerBase} {...sortProps} />
            <SortableHeader col="application"   label="Application"  className={headerBase} {...sortProps} />
            <SortableHeader col="round"         label="Round"        className={headerBase} {...sortProps} />
            <SortableHeader col="decision"      label="Decision"     className={headerBase} {...sortProps} />
            <SortableHeader col="deadline"      label="My Deadline"  className={headerBase} {...sortProps} />
            <th className="w-10" />
            <th className="w-10" />
          </tr>
        </thead>
        <tbody onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
          {sorted.map((college, i) => (
            <React.Fragment key={college.id}>
              {dropIndex === i && draggingId !== null && (
                <tr className="pointer-events-none" aria-hidden>
                  <td colSpan={colSpan} className="p-0"><div className="h-0.5 bg-primary" /></td>
                </tr>
              )}
              <CollegeRow
                college={college}
                onRemove={onRemove}
                onViewDetails={onViewDetails}
                onStatusChange={onStatusChange}
                onRoundChange={onRoundChange}
                onDecisionChange={onDecisionChange}
                onDeadlineChange={onDeadlineChange}
                onCategoryChange={onCategoryChange}
                onNotesChange={onNotesChange}
                isNew={college.id === lastAddedId}
                isLast={i === sorted.length - 1}
                isDragging={draggingId === college.id}
                onDragStart={() => handleDragStart(college.id)}
                onDragOver={(e: React.DragEvent<HTMLTableRowElement>) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
              />
            </React.Fragment>
          ))}
          {dropIndex === sorted.length && draggingId !== null && (
            <tr className="pointer-events-none" aria-hidden>
              <td colSpan={colSpan} className="p-0"><div className="h-0.5 bg-primary" /></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
