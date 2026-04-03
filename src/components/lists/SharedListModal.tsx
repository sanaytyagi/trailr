"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TrackedCollege } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SharedListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  ownerEmail: string;
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not Started", color: "hsl(215,15%,50%)", bg: "hsl(215,15%,94%)" },
  in_progress: { label: "In Progress", color: "hsl(38,85%,35%)", bg: "hsl(38,85%,95%)" },
  submitted: { label: "Submitted", color: "hsl(205,85%,50%)", bg: "hsl(205,85%,96%)" },
};

const DECISION_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "hsl(220,70%,28%)", bg: "hsl(220,70%,95%)" },
  accepted: { label: "Accepted", color: "hsl(142,60%,30%)", bg: "hsl(142,60%,95%)" },
  rejected: { label: "Rejected", color: "hsl(0,65%,42%)", bg: "hsl(0,65%,96%)" },
  waitlisted: { label: "Waitlisted", color: "hsl(38,85%,35%)", bg: "hsl(38,85%,95%)" },
  deferred: { label: "Deferred", color: "hsl(25,85%,38%)", bg: "hsl(25,85%,95%)" },
};

export function SharedListModal({ open, onOpenChange, ownerId, ownerEmail }: SharedListModalProps) {
  const [supabase] = useState(() => createClient());
  const [colleges, setColleges] = useState<TrackedCollege[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function fetchSharedList() {
      setLoading(true);

      const { data, error } = await supabase
        .from("user_colleges")
        .select("*, college:colleges(*)")
        .eq("user_id", ownerId)
        .order("added_at", { ascending: true });

      setLoading(false);

      if (!error && data) {
        const colleges = (data as any[]).map((row) => ({
          ...row.college,
          application_status: row.application_status ?? "not_started",
          application_round: row.application_round ?? "unknown",
          decision: row.decision ?? null,
          admissions_category: row.admissions_category ?? null,
          personal_deadline: row.personal_deadline ?? null,
          notes: row.notes ?? "",
          added_at: row.added_at,
        }));

        setColleges(colleges);
      }
    }

    fetchSharedList();
  }, [open, ownerId, supabase]);

  const stats = {
    total: colleges.length,
    submitted: colleges.filter((c) => c.application_status === "submitted").length,
    accepted: colleges.filter((c) => c.decision === "accepted").length,
    rejected: colleges.filter((c) => c.decision === "rejected").length,
    waitlisted: colleges.filter((c) => c.decision === "waitlisted").length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 px-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : colleges.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <p className="text-sm text-muted-foreground">
              {ownerEmail} hasn't added any colleges yet
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm px-6 py-4">
              <h2 className="text-2xl font-bold mb-1">{ownerEmail}'s College List</h2>
              <p className="text-sm text-muted-foreground">
                Viewing {stats.total} college{stats.total !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="px-6 py-8">
              {/* Stats cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                <div className="group rounded-xl border bg-card px-5 py-4 flex flex-col gap-1 text-left w-full shadow-sm border-border">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Colleges
                  </span>
                  <span className="text-3xl font-bold tabular-nums text-foreground">
                    {stats.total}
                  </span>
                </div>
                <div className="group rounded-xl border bg-card px-5 py-4 flex flex-col gap-1 text-left w-full shadow-sm border-border">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Submitted
                  </span>
                  <span className="text-3xl font-bold tabular-nums text-[hsl(205,85%,45%)]">
                    {stats.submitted}
                  </span>
                </div>
                <div className="group rounded-xl border bg-card px-5 py-4 flex flex-col gap-1 text-left w-full shadow-sm border-border">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Accepted
                  </span>
                  <span className="text-3xl font-bold tabular-nums text-[hsl(142,60%,35%)]">
                    {stats.accepted}
                  </span>
                </div>
                <div className="group rounded-xl border bg-card px-5 py-4 flex flex-col gap-1 text-left w-full shadow-sm border-border">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Waitlisted
                  </span>
                  <span className="text-3xl font-bold tabular-nums text-[hsl(38,85%,35%)]">
                    {stats.waitlisted}
                  </span>
                </div>
                <div className="group rounded-xl border bg-card px-5 py-4 flex flex-col gap-1 text-left w-full shadow-sm border-border">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Rejected
                  </span>
                  <span className="text-3xl font-bold tabular-nums text-[hsl(0,65%,45%)]">
                    {stats.rejected}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-6 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Application Progress</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {stats.submitted} of {stats.total} submitted
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.submitted === stats.total && stats.total > 0
                        ? "bg-[hsl(142,60%,40%)]"
                        : "bg-primary"
                    }`}
                    style={{
                      width: `${stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {stats.total - stats.submitted} remaining
                </p>
              </div>

              {/* College grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {colleges.map((college) => {
                  const status = STATUS_STYLE[college.application_status];
                  const decision = college.decision ? DECISION_STYLE[college.decision] : null;

                  return (
                    <div
                      key={college.id}
                      className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{college.name}</h3>
                        {college.location && (
                          <p className="text-xs text-muted-foreground mb-3">{college.location}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        <span
                          className="text-xs font-medium rounded-md px-2 py-1"
                          style={{ color: status.color, backgroundColor: status.bg }}
                        >
                          {status.label}
                        </span>
                        {decision && (
                          <span
                            className="text-xs font-medium rounded-md px-2 py-1"
                            style={{ color: decision.color, backgroundColor: decision.bg }}
                          >
                            {decision.label}
                          </span>
                        )}
                      </div>

                      {college.personal_deadline && (
                        <div className="text-xs text-muted-foreground mb-2">
                          <span className="font-medium">Deadline:</span>{" "}
                          {new Date(college.personal_deadline + "T00:00:00").toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </div>
                      )}

                      {college.notes && (
                        <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                          <span className="font-medium">Notes:</span>
                          <p className="mt-1">{college.notes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
