"use client";

import React, { useMemo, useState, useEffect } from "react";
import { CollegeRow } from "./college-card";
import { EmptyState } from "./empty-state";
import type { TrackedCollege, ApplicationStatus, DecisionResult } from "@/types";

const ORDER_KEY = "college-trackr-order";

interface CollegeGridProps {
  colleges: TrackedCollege[];
  onRemove: (id: string) => void;
  onViewDetails: (college: TrackedCollege) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDecisionChange: (id: string, decision: DecisionResult | null) => void;
}

export function CollegeGrid({
  colleges,
  onRemove,
  onViewDetails,
  onStatusChange,
  onDecisionChange,
}: CollegeGridProps) {
  const [order, setOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

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

  const sorted = useMemo(() => {
    const base = [...colleges];
    if (order.length > 0) {
      const orderMap = new Map(order.map((id, i) => [id, i]));
      return base.sort((a, b) => {
        const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
        const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
        return ai - bi;
      });
    }
    return base.sort((a, b) => a.name.localeCompare(b.name));
  }, [colleges, order]);

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
    setDraggingId(null); setDropIndex(null);
  }

  function handleDragEnd() { setDraggingId(null); setDropIndex(null); }

  if (colleges.length === 0) return <EmptyState />;

  const colSpan = 6; // grip + university + acceptance + application + decision + remove

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="w-8" />
            <th className="text-left pl-2 pr-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              University
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              Acceptance
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Application
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Decision
            </th>
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
                onDecisionChange={onDecisionChange}
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
