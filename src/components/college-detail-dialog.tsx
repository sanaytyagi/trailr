"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, MapPin } from "lucide-react";
import { StatsDisplay } from "./stats-display";
import type { TrackedCollege, ApplicationStatus } from "@/types";
import { COLLEGE_TYPE_LABELS, APPLICATION_STATUS_LABELS } from "@/lib/constants";

interface CollegeDetailDialogProps {
  college: TrackedCollege | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (collegeId: string, status: ApplicationStatus) => void;
  onNotesChange: (collegeId: string, notes: string) => void;
}

export function CollegeDetailDialog({
  college,
  open,
  onOpenChange,
  onStatusChange,
  onNotesChange,
}: CollegeDetailDialogProps) {
  if (!college) return null;

  const typeLabel = college.college_type
    ? (COLLEGE_TYPE_LABELS[college.college_type] ?? college.college_type)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold leading-tight">
                {college.name}
              </DialogTitle>
              {college.location && (
                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{college.location}</span>
                </div>
              )}
            </div>
            {typeLabel && (
              <Badge variant="secondary" className="shrink-0 mt-0.5">
                {typeLabel}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex items-baseline gap-2 py-2">
          <StatsDisplay acceptanceRate={college.acceptance_rate} size="lg" />
          <span className="text-sm text-muted-foreground">acceptance rate</span>
        </div>

        <Separator />

        <div className="space-y-2">
          <label
            htmlFor="application-status"
            className="text-sm font-semibold text-foreground"
          >
            Application Status
          </label>
          <select
            id="application-status"
            value={college.application_status}
            onChange={(e) =>
              onStatusChange(college.id, e.target.value as ApplicationStatus)
            }
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
          >
            {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="college-notes"
            className="text-sm font-semibold text-foreground"
          >
            Personal Notes
          </label>
          <textarea
            id="college-notes"
            value={college.notes}
            onChange={(e) => onNotesChange(college.id, e.target.value)}
            placeholder="Add notes about this college..."
            rows={3}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring resize-none transition-shadow"
          />
        </div>

        {college.website_url && (
          <>
            <Separator />
            <a
              href={college.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline underline-offset-2 w-fit"
            >
              <ExternalLink className="h-4 w-4" />
              Visit Admissions Website
            </a>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
