"use client";

import { useState } from "react";
import { CollegeSearch } from "@/components/college-search";
import { CollegeGrid } from "@/components/college-grid";
import { CollegeDetailDialog } from "@/components/college-detail-dialog";
import { useTrackedColleges } from "@/hooks/use-tracked-colleges";
import type { TrackedCollege, ApplicationStatus, DecisionResult } from "@/types";

export default function TrackerPage() {
  const {
    trackedColleges,
    hydrated,
    addCollege,
    removeCollege,
    isTracked,
    setNote,
    setStatus,
    setDecision,
  } = useTrackedColleges();

  const [selectedCollege, setSelectedCollege] = useState<TrackedCollege | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleViewDetails = (college: TrackedCollege) => {
    setSelectedCollege(college);
    setDialogOpen(true);
  };

  const handleStatusChange = (collegeId: string, status: ApplicationStatus) => {
    setStatus(collegeId, status);
    setSelectedCollege((prev) =>
      prev?.id === collegeId ? { ...prev, application_status: status } : prev
    );
  };

  const handleDecisionChange = (collegeId: string, decision: DecisionResult | null) => {
    setDecision(collegeId, decision);
    setSelectedCollege((prev) =>
      prev?.id === collegeId ? { ...prev, decision } : prev
    );
  };

  const handleNotesChange = (collegeId: string, notes: string) => {
    setNote(collegeId, notes);
    setSelectedCollege((prev) =>
      prev?.id === collegeId ? { ...prev, notes } : prev
    );
  };

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">My College List</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {hydrated && trackedColleges.length > 0
            ? `Tracking ${trackedColleges.length} college${trackedColleges.length !== 1 ? "s" : ""}`
            : "Search and track colleges you're interested in."}
        </p>
        <CollegeSearch onAdd={addCollege} isTracked={isTracked} />
      </div>

      {hydrated && (
        <CollegeGrid
          colleges={trackedColleges}
          onRemove={removeCollege}
          onViewDetails={handleViewDetails}
          onStatusChange={handleStatusChange}
          onDecisionChange={handleDecisionChange}
        />
      )}

      {!hydrated && (
        <div className="rounded-xl border border-border bg-card h-48 animate-pulse" />
      )}

      <CollegeDetailDialog
        college={selectedCollege}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onStatusChange={handleStatusChange}
        onNotesChange={handleNotesChange}
      />
    </main>
  );
}
