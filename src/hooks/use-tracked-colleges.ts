"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import type {
  TrackedCollege,
  ApplicationStatus,
  ApplicationRound,
  DecisionResult,
  AdmissionsCategory,
  College,
} from "@/types";

// ---------------------------------------------------------------------------
// Shape of a row returned by the join query
// user_colleges.* + colleges embedded as "college"
// ---------------------------------------------------------------------------
interface UserCollegeRow {
  id: string;
  user_id: string;
  college_id: string;
  application_status: string;
  application_round: string;
  decision: string | null;
  admissions_category: string | null;
  personal_deadline: string | null;
  notes: string;
  sort_order: number | null;
  added_at: string;
  updated_at: string;
  college: College;
}

function rowToTracked(row: UserCollegeRow): TrackedCollege {
  return {
    ...row.college,
    application_status: (row.application_status as ApplicationStatus) ?? "not_started",
    application_round: (row.application_round as ApplicationRound) ?? "unknown",
    decision: (row.decision as DecisionResult | null) ?? null,
    admissions_category: (row.admissions_category as AdmissionsCategory | null) ?? null,
    personal_deadline: row.personal_deadline ?? null,
    notes: row.notes ?? "",
    added_at: row.added_at,
  };
}

async function getCounselorId(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("counselor_id")
    .eq("id", userId)
    .single();
  return data?.counselor_id ?? null;
}

export function useTrackedColleges() {
  const [supabase] = useState(() => createClient());

  const [trackedColleges, setTrackedColleges] = useState<TrackedCollege[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  // Ref so setDeadline callback always sees the current value without re-creating itself
  const calendarConnectedRef = useRef(false);

  // -------------------------------------------------------------------------
  // Load on mount — fetch this user's rows joined with college data.
  // RLS on user_colleges ensures we only ever receive our own rows.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        setHydrated(true);
        return;
      }

      const { data, error } = await supabase
        .from("user_colleges")
        .select("*, college:colleges(*)")
        .eq("user_id", user.id)
        .order("added_at", { ascending: true });

      if (cancelled) return;

      if (!error && data) {
        setTrackedColleges(
          (data as unknown as UserCollegeRow[]).map(rowToTracked)
        );
      }

      // Check Google Calendar connection status
      try {
        const statusRes = await fetch("/api/calendar/google/status");
        if (statusRes.ok) {
          const { connected } = await statusRes.json() as { connected: boolean };
          setCalendarConnected(connected);
          calendarConnectedRef.current = connected;
        }
      } catch {
        // Non-blocking — calendar status failure doesn't break the tracker
      }

      setHydrated(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const isTracked = useCallback(
    (collegeId: string) => trackedColleges.some((c) => c.id === collegeId),
    [trackedColleges]
  );

  // -------------------------------------------------------------------------
  // Add college — optimistic insert
  // -------------------------------------------------------------------------
  const addCollege = useCallback(
    async (college: College) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (trackedColleges.some((c) => c.id === college.id)) return;

      const optimistic: TrackedCollege = {
        ...college,
        application_status: "not_started",
        application_round: "unknown",
        decision: null,
        admissions_category: null,
        personal_deadline: null,
        notes: "",
        added_at: new Date().toISOString(),
      };

      setTrackedColleges((prev) => [...prev, optimistic]);

      const { error } = await supabase.from("user_colleges").insert({
        user_id: user.id,
        college_id: college.id,
        application_status: "not_started",
        application_round: "unknown",
        notes: "",
      });

      if (error) {
        // Revert on failure
        setTrackedColleges((prev) => prev.filter((c) => c.id !== college.id));
        console.error("addCollege:", error.message);
      } else {
        const counselorId = await getCounselorId(supabase, user.id);
        if (counselorId) {
          logActivity(supabase, {
            studentId: user.id,
            counselorId,
            type: "add_college",
            collegeName: college.name,
            collegeId: college.id,
          });
        }
      }
    },
    [supabase, trackedColleges]
  );

  // -------------------------------------------------------------------------
  // Remove college
  // -------------------------------------------------------------------------
  const removeCollege = useCallback(
    async (collegeId: string) => {
      setTrackedColleges((prev) => prev.filter((c) => c.id !== collegeId));

      const { error } = await supabase
        .from("user_colleges")
        .delete()
        .eq("college_id", collegeId);
      // RLS automatically scopes this to the signed-in user.

      if (!error) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const counselorId = await getCounselorId(supabase, user.id);
          const college = trackedColleges.find((c) => c.id === collegeId);
          if (counselorId && college) {
            logActivity(supabase, {
              studentId: user.id,
              counselorId,
              type: "remove_college",
              collegeName: college.name,
              collegeId: college.id,
            });
          }
        }
      }

      if (error) {
        console.error("removeCollege:", error.message);
        // Resync state
        const { data: currentUser } = await supabase.auth.getUser();
        const userId = currentUser.user?.id;
        if (!userId) return;
        const { data } = await supabase
          .from("user_colleges")
          .select("*, college:colleges(*)")
          .eq("user_id", userId)
          .order("added_at", { ascending: true });
        if (data) {
          setTrackedColleges(
            (data as unknown as UserCollegeRow[]).map(rowToTracked)
          );
        }
      }
    },
    [supabase]
  );

  // -------------------------------------------------------------------------
  // Field setters — optimistic update + background Supabase sync.
  // RLS on user_colleges enforces that .update() only touches the caller's rows.
  // -------------------------------------------------------------------------
  const setNote = useCallback(
    (collegeId: string, note: string) => {
      setTrackedColleges((prev) =>
        prev.map((c) => (c.id === collegeId ? { ...c, notes: note } : c))
      );
      supabase
        .from("user_colleges")
        .update({ notes: note, updated_at: new Date().toISOString() })
        .eq("college_id", collegeId)
        .then(({ error }) => {
          if (error) console.error("setNote:", error.message);
        });
    },
    [supabase]
  );

  const setStatus = useCallback(
    (collegeId: string, status: ApplicationStatus) => {
      setTrackedColleges((prev) =>
        prev.map((c) =>
          c.id === collegeId ? { ...c, application_status: status } : c
        )
      );
      supabase
        .from("user_colleges")
        .update({ application_status: status, updated_at: new Date().toISOString() })
        .eq("college_id", collegeId)
        .then(async ({ error }) => {
          if (error) { console.error("setStatus:", error.message); return; }
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const counselorId = await getCounselorId(supabase, user.id);
          if (!counselorId) return;
          setTrackedColleges((prev) => {
            const college = prev.find((c) => c.id === collegeId);
            if (college) {
              logActivity(supabase, {
                studentId: user.id,
                counselorId,
                type: "status_change",
                collegeName: college.name,
                collegeId: college.id,
                metadata: { status },
              });
            }
            return prev;
          });
        });
    },
    [supabase]
  );

  const setDecision = useCallback(
    (collegeId: string, decision: DecisionResult | null) => {
      setTrackedColleges((prev) =>
        prev.map((c) => (c.id === collegeId ? { ...c, decision } : c))
      );
      supabase
        .from("user_colleges")
        .update({ decision, updated_at: new Date().toISOString() })
        .eq("college_id", collegeId)
        .then(async ({ error }) => {
          if (error) { console.error("setDecision:", error.message); return; }
          if (!decision) return;
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const counselorId = await getCounselorId(supabase, user.id);
          if (!counselorId) return;
          setTrackedColleges((prev) => {
            const college = prev.find((c) => c.id === collegeId);
            if (college) {
              logActivity(supabase, {
                studentId: user.id,
                counselorId,
                type: "decision_change",
                collegeName: college.name,
                collegeId: college.id,
                metadata: { decision },
              });
            }
            return prev;
          });
        });
    },
    [supabase]
  );

  const setRound = useCallback(
    (collegeId: string, round: ApplicationRound) => {
      setTrackedColleges((prev) =>
        prev.map((c) =>
          c.id === collegeId ? { ...c, application_round: round } : c
        )
      );
      supabase
        .from("user_colleges")
        .update({ application_round: round, updated_at: new Date().toISOString() })
        .eq("college_id", collegeId)
        .then(({ error }) => {
          if (error) console.error("setRound:", error.message);
        });
    },
    [supabase]
  );

  const setDeadline = useCallback(
    (collegeId: string, deadline: string | null) => {
      // Capture college name before the state update for the calendar sync call
      const collegeName = trackedColleges.find((c) => c.id === collegeId)?.name ?? "";

      setTrackedColleges((prev) =>
        prev.map((c) =>
          c.id === collegeId ? { ...c, personal_deadline: deadline } : c
        )
      );

      supabase
        .from("user_colleges")
        .update({ personal_deadline: deadline, updated_at: new Date().toISOString() })
        .eq("college_id", collegeId)
        .then(({ error }) => {
          if (error) console.error("setDeadline:", error.message);
        });

      // Fire-and-forget calendar sync if connected
      if (calendarConnectedRef.current && collegeName) {
        fetch("/api/calendar/google/sync-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ college_id: collegeId, college_name: collegeName, deadline }),
        })
          .then((res) => res.json())
          .then((data: { disconnected?: boolean }) => {
            if (data.disconnected) {
              setCalendarConnected(false);
              calendarConnectedRef.current = false;
              toast.warning("Google Calendar disconnected", {
                description: "Your Google Calendar access was revoked. Reconnect in Settings.",
                duration: 8000,
              });
            }
          })
          .catch(() => {}); // Silent fail — calendar sync is best-effort
      }
    },
    [supabase, trackedColleges]
  );

  const setAdmissionsCategory = useCallback(
    (collegeId: string, category: AdmissionsCategory | null) => {
      setTrackedColleges((prev) =>
        prev.map((c) =>
          c.id === collegeId ? { ...c, admissions_category: category } : c
        )
      );
      supabase
        .from("user_colleges")
        .update({ admissions_category: category, updated_at: new Date().toISOString() })
        .eq("college_id", collegeId)
        .then(({ error }) => {
          if (error) console.error("setAdmissionsCategory:", error.message);
        });
    },
    [supabase]
  );

  return {
    trackedColleges,
    hydrated,
    calendarConnected,
    setCalendarConnected: (v: boolean) => {
      setCalendarConnected(v);
      calendarConnectedRef.current = v;
    },
    addCollege,
    removeCollege,
    isTracked,
    setNote,
    setStatus,
    setDecision,
    setRound,
    setDeadline,
    setAdmissionsCategory,
  };
}
