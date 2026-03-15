"use client";

import { useState, useEffect, useCallback } from "react";
import type { TrackedCollege, ApplicationStatus, ApplicationRound, DecisionResult, College } from "@/types";
import {
  LOCALSTORAGE_TRACKED_KEY,
  LOCALSTORAGE_NOTES_KEY,
  LOCALSTORAGE_STATUSES_KEY,
  LOCALSTORAGE_DECISIONS_KEY,
  LOCALSTORAGE_ROUNDS_KEY,
} from "@/lib/constants";

function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSetItem(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Migrate old localStorage status values to new schema
function migrateStatus(raw: string): ApplicationStatus {
  const map: Record<string, ApplicationStatus> = {
    applying: "in_progress",
    applied: "submitted",
    accepted: "submitted",
    rejected: "submitted",
    waitlisted: "submitted",
    committed: "submitted",
    deferred: "submitted",
    researching: "not_started",
    planning: "not_started",
    not_started: "not_started",
    in_progress: "in_progress",
    submitted: "submitted",
  };
  return map[raw] ?? "not_started";
}

export function useTrackedColleges() {
  const [trackedColleges, setTrackedColleges] = useState<TrackedCollege[]>([]);
  const [notes, setNotesState] = useState<Record<string, string>>({});
  const [statuses, setStatusesState] = useState<Record<string, ApplicationStatus>>({});
  const [decisions, setDecisionsState] = useState<Record<string, DecisionResult>>({});
  const [rounds, setRoundsState] = useState<Record<string, ApplicationRound>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedColleges = safeGetItem<College[]>(LOCALSTORAGE_TRACKED_KEY, []);
    const storedNotes = safeGetItem<Record<string, string>>(LOCALSTORAGE_NOTES_KEY, {});
    const storedStatuses = safeGetItem<Record<string, string>>(LOCALSTORAGE_STATUSES_KEY, {});
    const storedDecisions = safeGetItem<Record<string, DecisionResult>>(LOCALSTORAGE_DECISIONS_KEY, {});
    const storedRounds = safeGetItem<Record<string, ApplicationRound>>(LOCALSTORAGE_ROUNDS_KEY, {});

    const hydrated = storedColleges.map((c) => ({
      ...c,
      application_status: migrateStatus(storedStatuses[c.id] ?? "researching"),
      application_round: storedRounds[c.id] ?? "unknown",
      decision: storedDecisions[c.id] ?? null,
      notes: storedNotes[c.id] ?? "",
      added_at: (c as TrackedCollege).added_at ?? new Date().toISOString(),
    }));

    setTrackedColleges(hydrated);
    setNotesState(storedNotes);
    setStatusesState(Object.fromEntries(
      Object.entries(storedStatuses).map(([k, v]) => [k, migrateStatus(v)])
    ));
    setDecisionsState(storedDecisions);
    setRoundsState(storedRounds);
    setHydrated(true);
  }, []);

  const addCollege = useCallback((college: College) => {
    setTrackedColleges((prev) => {
      if (prev.find((c) => c.id === college.id)) return prev;
      const newEntry: TrackedCollege = {
        ...college,
        application_status: "not_started",
        application_round: "unknown",
        decision: null,
        notes: "",
        added_at: new Date().toISOString(),
      };
      const next = [...prev, newEntry];
      safeSetItem(LOCALSTORAGE_TRACKED_KEY, next);
      return next;
    });
  }, []);

  const removeCollege = useCallback((collegeId: string) => {
    setTrackedColleges((prev) => {
      const next = prev.filter((c) => c.id !== collegeId);
      safeSetItem(LOCALSTORAGE_TRACKED_KEY, next);
      return next;
    });
  }, []);

  const isTracked = useCallback(
    (collegeId: string) => trackedColleges.some((c) => c.id === collegeId),
    [trackedColleges]
  );

  const setNote = useCallback((collegeId: string, note: string) => {
    setNotesState((prev) => {
      const next = { ...prev, [collegeId]: note };
      safeSetItem(LOCALSTORAGE_NOTES_KEY, next);
      return next;
    });
    setTrackedColleges((prev) =>
      prev.map((c) => (c.id === collegeId ? { ...c, notes: note } : c))
    );
  }, []);

  const setStatus = useCallback((collegeId: string, status: ApplicationStatus) => {
    setStatusesState((prev) => {
      const next = { ...prev, [collegeId]: status };
      safeSetItem(LOCALSTORAGE_STATUSES_KEY, next);
      return next;
    });
    setTrackedColleges((prev) =>
      prev.map((c) => (c.id === collegeId ? { ...c, application_status: status } : c))
    );
  }, []);

  const setDecision = useCallback((collegeId: string, decision: DecisionResult | null) => {
    setDecisionsState((prev) => {
      const next = { ...prev };
      if (decision === null) delete next[collegeId];
      else next[collegeId] = decision;
      safeSetItem(LOCALSTORAGE_DECISIONS_KEY, next);
      return next;
    });
    setTrackedColleges((prev) =>
      prev.map((c) => (c.id === collegeId ? { ...c, decision } : c))
    );
  }, []);

  const setRound = useCallback((collegeId: string, round: ApplicationRound) => {
    setRoundsState((prev) => {
      const next = { ...prev, [collegeId]: round };
      safeSetItem(LOCALSTORAGE_ROUNDS_KEY, next);
      return next;
    });
    setTrackedColleges((prev) =>
      prev.map((c) => (c.id === collegeId ? { ...c, application_round: round } : c))
    );
  }, []);

  return {
    trackedColleges,
    notes,
    statuses,
    decisions,
    rounds,
    hydrated,
    addCollege,
    removeCollege,
    isTracked,
    setNote,
    setStatus,
    setDecision,
    setRound,
  };
}
