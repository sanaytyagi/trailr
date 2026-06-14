"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, CheckCircle2, XCircle, Link2, UserCheck, MessageSquare, Share2 } from "lucide-react";
import type { College } from "@/types";
import { CollegeSearch, type CollegeSearchHandle } from "@/components/college-search";
import { CollegeGrid } from "@/components/college-grid";
import { CollegeDetailDialog } from "@/components/college-detail-dialog";
import { DeadlineCalendar } from "@/components/deadline-calendar";
import { ProfileCompletionNudge } from "@/components/profile-completion-nudge";
import { useTrackedColleges } from "@/hooks/use-tracked-colleges";
import { useProfile } from "@/hooks/use-profile";
import { useCounselorNotifications, type CounselorNotification } from "@/hooks/use-counselor-notifications";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { TrackedCollege, ApplicationStatus, DecisionResult } from "@/types";

type DeadlineFilter = "overdue" | "this_week" | "this_month" | "no_date";
type CardFilter = "all" | "submitted" | "accepted" | "waitlisted" | "rejected";

// Counselor feature is hidden pre-launch. Set NEXT_PUBLIC_COUNSELOR_ENABLED=true to restore.
const COUNSELOR_ENABLED = process.env.NEXT_PUBLIC_COUNSELOR_ENABLED === "true";

// ── Status / decision badge style maps ───────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not Started", color: "hsl(215,15%,50%)", bg: "hsl(215,15%,94%)" },
  in_progress:  { label: "In Progress", color: "hsl(38,85%,35%)",  bg: "hsl(38,85%,95%)"  },
  submitted:    { label: "Submitted",   color: "hsl(205,85%,50%)", bg: "hsl(205,85%,96%)" },
};

const DECISION_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "Pending",    color: "hsl(220,70%,28%)", bg: "hsl(220,70%,95%)" },
  accepted:   { label: "Accepted",   color: "hsl(142,60%,30%)", bg: "hsl(142,60%,95%)" },
  rejected:   { label: "Rejected",   color: "hsl(0,65%,42%)",   bg: "hsl(0,65%,96%)"   },
  waitlisted: { label: "Waitlisted", color: "hsl(38,85%,35%)",  bg: "hsl(38,85%,95%)"  },
  deferred:   { label: "Deferred",   color: "hsl(25,85%,38%)",  bg: "hsl(25,85%,95%)"  },
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  active,
  onClick,
}: {
  label: string;
  value: number;
  accent?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group rounded-xl border bg-card px-5 py-4 flex flex-col gap-1 text-left w-full cursor-pointer",
        "transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 hover:bg-primary/[0.04]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? "border-primary/40 shadow-md ring-1 ring-primary/20 -translate-y-0.5 bg-primary/[0.06]"
          : "border-border shadow-sm"
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-3xl font-bold tabular-nums", accent ?? "text-foreground")}>
        {value}
      </span>
    </button>
  );
}

// ── Card detail panel ─────────────────────────────────────────────────────────

const CARD_LABEL: Record<CardFilter, string> = {
  all: "All Colleges",
  submitted: "Submitted",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  rejected: "Rejected",
};

function getCardColleges(colleges: TrackedCollege[], filter: CardFilter): TrackedCollege[] {
  if (filter === "all") return colleges;
  if (filter === "submitted") return colleges.filter((c) => c.application_status === "submitted");
  if (filter === "accepted")  return colleges.filter((c) => c.decision === "accepted");
  if (filter === "waitlisted") return colleges.filter((c) => c.decision === "waitlisted");
  if (filter === "rejected")  return colleges.filter((c) => c.decision === "rejected");
  return [];
}

function CardPanel({
  filter,
  colleges,
  onClose,
}: {
  filter: CardFilter;
  colleges: TrackedCollege[];
  onClose: () => void;
}) {
  const list = getCardColleges(colleges, filter);

  return (
    <div className="panel-enter mb-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
        <span className="text-sm font-semibold text-foreground">
          {CARD_LABEL[filter]}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {list.length} college{list.length !== 1 ? "s" : ""}
          </span>
        </span>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      {list.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground mb-1">
            No {CARD_LABEL[filter].toLowerCase()} colleges yet.
          </p>
          <p className="text-xs text-muted-foreground">
            They'll appear here once you track and update them.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border max-h-72 overflow-y-auto">
          {list.map((c) => {
            const status = STATUS_STYLE[c.application_status];
            const decision = c.decision ? DECISION_STYLE[c.decision] : null;
            return (
              <li
                key={c.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  {c.location && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.location}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-xs font-medium rounded-md px-2 py-0.5 whitespace-nowrap"
                    style={{ color: status.color, backgroundColor: status.bg }}
                  >
                    {status.label}
                  </span>
                  {decision && (
                    <span
                      className="text-xs font-medium rounded-md px-2 py-0.5 whitespace-nowrap"
                      style={{ color: decision.color, backgroundColor: decision.bg }}
                    >
                      {decision.label}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Segmented filter group ────────────────────────────────────────────────────

function SegmentGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap shrink-0">
        {label}
      </span>
      <div className="inline-flex items-center rounded-lg bg-muted/70 p-0.5">
        <button
          onClick={() => onChange(null)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap leading-none",
            value === null
              ? "bg-card shadow-sm text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(value === opt.value ? null : opt.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap leading-none",
              value === opt.value
                ? "bg-card shadow-sm text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Animated progress bar ─────────────────────────────────────────────────────

function ProgressBar({ submitted, total }: { submitted: number; total: number }) {
  const [width, setWidth] = useState(0);
  const target = total > 0 ? (submitted / total) * 100 : 0;

  useEffect(() => {
    const id = setTimeout(() => setWidth(target), 80);
    return () => clearTimeout(id);
  }, [target]);

  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full motion-reduce:transition-none", width === 100 ? "bg-[hsl(142,60%,40%)]" : "bg-primary")}
        style={{
          width: `${width}%`,
          transition: "width 0.9s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

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
    setRound,
    setDeadline,
    setAdmissionsCategory,
    calendarConnected,
  } = useTrackedColleges();

  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const router = useRouter();

  // Anon users get redirected to /auth — matches the gating pattern used by
  // /essays, /list-builder, /assistant.
  useEffect(() => {
    if (!profileLoading && !profile) router.replace("/auth?mode=login");
  }, [profile, profileLoading, router]);
  const { notifications, count: unreadCount, markAllRead } = useCounselorNotifications(profile ?? null);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [calendarBannerDismissed, setCalendarBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("calendar-banner-dismissed") === "true";
  });
  const [shownNotifs, setShownNotifs] = useState<CounselorNotification[]>([]);
  const [supabase] = useState(() => createClient());
  const [inviteCode, setInviteCode] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [counselorName, setCounselorName] = useState<string | null>(null);
  const [counselorNotes, setCounselorNotes] = useState<Record<string, string>>({});
  const [essayCounts, setEssayCounts] = useState<Record<string, number>>({});

  // Snapshot the 3 most recent notifications when they first load
  useEffect(() => {
    if (shownNotifs.length === 0 && notifications.length > 0) {
      setShownNotifs(notifications.slice(0, 3));
    }
  }, [notifications]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark all as read when the section is visible
  useEffect(() => {
    if (!notifDismissed && unreadCount > 0 && profile?.counselor_id) {
      markAllRead();
    }
  }, [unreadCount, notifDismissed, profile?.counselor_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch counselor name + notes when profile has a counselor_id
  useEffect(() => {
    if (!profile?.counselor_id) return;

    async function fetchCounselorData() {
      const { data: counselorProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", profile!.counselor_id!)
        .single();
      setCounselorName(counselorProfile?.full_name ?? null);

      const { data: notes } = await supabase
        .from("counselor_college_notes")
        .select("college_id, note")
        .eq("student_id", profile!.id);
      if (notes) {
        const map: Record<string, string> = {};
        for (const row of notes) map[row.college_id] = row.note;
        setCounselorNotes(map);
      }
    }
    fetchCounselorData();
  }, [profile, supabase]);

  // Fetch essay counts per college
  useEffect(() => {
    if (!profile) return;
    async function fetchEssayCounts() {
      const { data } = await supabase
        .from("essays")
        .select("college_id")
        .eq("user_id", profile!.id);
      if (data) {
        const counts: Record<string, number> = {};
        for (const row of data) {
          counts[row.college_id] = (counts[row.college_id] ?? 0) + 1;
        }
        setEssayCounts(counts);
      }
    }
    fetchEssayCounts();
  }, [profile, supabase]);

  async function handleConnect() {
    if (!inviteCode.trim()) return;
    setConnecting(true);
    setConnectError(null);

    const { data: counselor } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("invite_code", inviteCode.trim().toUpperCase())
      .eq("role", "counselor")
      .maybeSingle();

    if (!counselor) {
      setConnectError("No counselor found with that invite code.");
      setConnecting(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({ counselor_id: counselor.id })
      .eq("id", profile!.id);

    await refetchProfile();
    setInviteCode("");
    setIsChanging(false);
    setConnecting(false);
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    await supabase
      .from("profiles")
      .update({ counselor_id: null })
      .eq("id", profile!.id);
    setCounselorName(null);
    setCounselorNotes({});
    await refetchProfile();
    setDisconnecting(false);
  }

  const searchRef = useRef<CollegeSearchHandle>(null);
  const [selectedCollege, setSelectedCollege] = useState<TrackedCollege | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<CardFilter | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "add" | "remove"; exiting: boolean } | null>(null);
  const toastHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "add" | "remove" = "add") => {
    // Cancel any in-flight timers so rapid calls don't stack
    if (toastHideTimer.current) clearTimeout(toastHideTimer.current);
    if (toastExitTimer.current) clearTimeout(toastExitTimer.current);
    setToast({ message, type, exiting: false });
    // After 2.6s start exit animation, after 2.6 + 350ms remove from DOM
    toastHideTimer.current = setTimeout(() => {
      setToast(prev => prev ? { ...prev, exiting: true } : null);
      toastExitTimer.current = setTimeout(() => setToast(null), 350);
    }, 2600);
  }, []);

  const handleAddCollege = useCallback((college: College) => {
    addCollege(college);
    setLastAddedId(college.id);
    showToast(`${college.name} added`);
    setTimeout(() => setLastAddedId(null), 900);
  }, [addCollege, showToast]);

  const handleRemoveCollege = useCallback((collegeId: string) => {
    const college = trackedColleges.find(c => c.id === collegeId);
    removeCollege(collegeId);
    if (college) showToast(`${college.name} removed`, "remove");
  }, [removeCollege, trackedColleges, showToast]);

  // Filters
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | null>(null);
  const [filterDecision, setFilterDecision] = useState<DecisionResult | null>(null);
  const [filterDeadline, setFilterDeadline] = useState<DeadlineFilter | null>(null);

  const hasFilters = filterStatus || filterDecision || filterDeadline;

  // Stats (always from full list)
  const stats = useMemo(() => ({
    total: trackedColleges.length,
    submitted: trackedColleges.filter((c) => c.application_status === "submitted").length,
    accepted: trackedColleges.filter((c) => c.decision === "accepted").length,
    rejected: trackedColleges.filter((c) => c.decision === "rejected").length,
    waitlisted: trackedColleges.filter((c) => c.decision === "waitlisted").length,
  }), [trackedColleges]);

  // Filtered list (for main table)
  const filteredColleges = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return trackedColleges.filter((c) => {
      if (filterStatus && c.application_status !== filterStatus) return false;
      if (filterDecision && c.decision !== filterDecision) return false;
      if (filterDeadline) {
        const dl = c.personal_deadline ? new Date(c.personal_deadline + "T00:00:00") : null;
        if (filterDeadline === "no_date" && dl !== null) return false;
        if (filterDeadline === "overdue" && (!dl || dl >= today)) return false;
        if (filterDeadline === "this_week") {
          const cutoff = new Date(today); cutoff.setDate(today.getDate() + 7);
          if (!dl || dl < today || dl > cutoff) return false;
        }
        if (filterDeadline === "this_month") {
          const cutoff = new Date(today); cutoff.setDate(today.getDate() + 30);
          if (!dl || dl < today || dl > cutoff) return false;
        }
      }
      return true;
    });
  }, [trackedColleges, filterStatus, filterDecision, filterDeadline]);

  const deadlineEntries = useMemo(() =>
    trackedColleges
      .filter((c) => c.personal_deadline !== null && c.application_status !== "submitted")
      .map((c) => ({ collegeId: c.id, collegeName: c.name, deadline: c.personal_deadline! })),
    [trackedColleges]
  );

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

  const clearFilters = () => {
    setFilterStatus(null);
    setFilterDecision(null);
    setFilterDeadline(null);
  };

  const handleCardClick = (card: CardFilter) =>
    setActiveCard((prev) => (prev === card ? null : card));


  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Left column */}
        <div className="flex-1 min-w-0">
          {/* Nudge students with a core profile to finish the full quiz */}
          <ProfileCompletionNudge />
          {/* Counselor connect banner / chip */}
          {COUNSELOR_ENABLED && profile && profile.role === "student" && (
            profile.counselor_id && !isChanging ? (
              <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm">
                <UserCheck className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">Counselor:</span>
                <span className="font-medium text-foreground">{counselorName ?? "Connected"}</span>
                <div className="ml-auto flex items-center gap-3">
                  <button
                    onClick={() => { setIsChanging(true); setConnectError(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Change
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="text-xs text-destructive/70 hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    {disconnecting ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card">
                <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {isChanging ? "Change counselor" : "Connect with your counselor"}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                    placeholder="Enter invite code"
                    maxLength={6}
                    className="h-8 rounded-md border border-input bg-background px-3 text-sm font-mono uppercase tracking-widest w-36 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={handleConnect}
                    disabled={connecting || !inviteCode.trim()}
                    className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {connecting ? "Connecting…" : "Connect"}
                  </button>
                  {isChanging && (
                    <button
                      onClick={() => { setIsChanging(false); setInviteCode(""); setConnectError(null); }}
                      className="h-8 rounded-md px-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {connectError && (
                  <p className="w-full text-xs text-destructive mt-1">{connectError}</p>
                )}
              </div>
            )
          )}

          {/* Google Calendar banner */}
          {profile?.role === "student" && !calendarConnected && !calendarBannerDismissed && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card">
              <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-sm text-muted-foreground">Sync your deadlines to Google Calendar</span>
              <div className="ml-auto flex items-center gap-3">
                <a
                  href="/api/calendar/google/connect"
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Connect
                </a>
                <button
                  onClick={() => {
                    setCalendarBannerDismissed(true);
                    localStorage.setItem("calendar-banner-dismissed", "true");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* From your counselor */}
          {COUNSELOR_ENABLED && profile?.counselor_id && !notifDismissed && shownNotifs.length > 0 && (
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-primary">From your counselor</span>
                <button
                  onClick={() => setNotifDismissed(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-0.5">
                {shownNotifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => router.push(`/essays/${n.essay_id}`)}
                    className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary/10 transition-colors"
                  >
                    <MessageSquare className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-xs text-foreground">
                      Your counselor left a comment on your{" "}
                      {n.college_name ? <strong>{n.college_name}</strong> : "an"} essay
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title + search + add button */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-1">My College List</h1>
            <p className="text-sm text-muted-foreground mb-4">
              {!hydrated
                ? "Loading your colleges…"
                : trackedColleges.length > 0
                  ? `Tracking ${trackedColleges.length} college${trackedColleges.length !== 1 ? "s" : ""}`
                  : "Search and track colleges you're interested in."}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <CollegeSearch ref={searchRef} onAdd={handleAddCollege} isTracked={isTracked} />
              </div>
              <button
                onClick={() => searchRef.current?.focus()}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 h-11 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap shrink-0 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Add College
              </button>
            </div>
          </div>

          {/* Stats cards */}
          {hydrated && trackedColleges.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                <StatCard
                  label="Colleges" value={stats.total}
                  active={activeCard === "all"}
                  onClick={() => handleCardClick("all")}
                />
                <StatCard
                  label="Submitted" value={stats.submitted} accent="text-[hsl(205,85%,45%)]"
                  active={activeCard === "submitted"}
                  onClick={() => handleCardClick("submitted")}
                />
                <StatCard
                  label="Accepted" value={stats.accepted} accent="text-[hsl(142,60%,35%)]"
                  active={activeCard === "accepted"}
                  onClick={() => handleCardClick("accepted")}
                />
                <StatCard
                  label="Waitlisted" value={stats.waitlisted} accent="text-[hsl(38,85%,35%)]"
                  active={activeCard === "waitlisted"}
                  onClick={() => handleCardClick("waitlisted")}
                />
                <StatCard
                  label="Rejected" value={stats.rejected} accent="text-[hsl(0,65%,45%)]"
                  active={activeCard === "rejected"}
                  onClick={() => handleCardClick("rejected")}
                />
              </div>

              {/* Card detail panel — remounts on filter change to replay animation */}
              {activeCard && (
                <div key={activeCard}>
                  <CardPanel
                    filter={activeCard}
                    colleges={trackedColleges}
                    onClose={() => setActiveCard(null)}
                  />
                </div>
              )}

              {/* Progress bar */}
              <div className="mb-6 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">Application Progress</span>
                    <button
                      onClick={() => router.push("/lists")}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Share2 className="h-3 w-3" />
                      Share List
                    </button>
                  </div>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {stats.submitted} of {stats.total} submitted
                  </span>
                </div>
                <ProgressBar submitted={stats.submitted} total={stats.total} />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {stats.total - stats.submitted} remaining
                </p>
              </div>
            </>
          )}

          {/* Filters */}
          {hydrated && trackedColleges.length > 0 && (
            <div className="mb-4 rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
                <SegmentGroup<ApplicationStatus>
                  label="Application"
                  options={[
                    { value: "not_started", label: "Not Started" },
                    { value: "in_progress", label: "In Progress" },
                    { value: "submitted",   label: "Submitted"   },
                  ]}
                  value={filterStatus}
                  onChange={setFilterStatus}
                />
                <SegmentGroup<DecisionResult>
                  label="Decision"
                  options={[
                    { value: "pending",    label: "Pending"    },
                    { value: "accepted",   label: "Accepted"   },
                    { value: "rejected",   label: "Rejected"   },
                    { value: "waitlisted", label: "Waitlisted" },
                    { value: "deferred",   label: "Deferred"   },
                  ]}
                  value={filterDecision}
                  onChange={setFilterDecision}
                />
                <SegmentGroup<DeadlineFilter>
                  label="Deadline"
                  options={[
                    { value: "overdue",     label: "Overdue"     },
                    { value: "this_week",   label: "This Week"   },
                    { value: "this_month",  label: "This Month"  },
                    { value: "no_date",     label: "No Date"     },
                  ]}
                  value={filterDeadline}
                  onChange={setFilterDeadline}
                />
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    <X className="h-3 w-3" />
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Grid */}
          {hydrated && filteredColleges.length === 0 && hasFilters && (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-border bg-card">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">No colleges match these filters</p>
              <p className="text-xs text-muted-foreground mb-4">Try adjusting your selection or removing a filter.</p>
              <button
                onClick={clearFilters}
                className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
              >
                Clear filters
              </button>
            </div>
          )}

          {hydrated && (filteredColleges.length > 0 || !hasFilters) && (
            <CollegeGrid
              colleges={filteredColleges}
              onRemove={handleRemoveCollege}
              onViewDetails={handleViewDetails}
              onStatusChange={handleStatusChange}
              onRoundChange={setRound}
              onDecisionChange={handleDecisionChange}
              onDeadlineChange={setDeadline}
              onCategoryChange={setAdmissionsCategory}
              onNotesChange={handleNotesChange}
              lastAddedId={lastAddedId}
              counselorNotes={Object.keys(counselorNotes).length > 0 ? counselorNotes : undefined}
              essayCounts={essayCounts}
            />
          )}

          {!hydrated && (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={cn("flex items-center gap-4 px-5 py-4 animate-pulse", i !== 4 && "border-b border-border")}>
                  <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-48 rounded bg-muted" />
                    <div className="h-2.5 w-32 rounded bg-muted/60" />
                  </div>
                  <div className="h-7 w-20 rounded-lg bg-muted shrink-0" />
                  <div className="h-7 w-24 rounded-lg bg-muted shrink-0" />
                  <div className="h-7 w-16 rounded-lg bg-muted shrink-0" />
                  <div className="h-7 w-20 rounded-lg bg-muted shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column — deadline calendar */}
        <div className="w-full lg:w-72 lg:shrink-0 lg:sticky lg:top-20 lg:mt-36">
          <DeadlineCalendar entries={deadlineEntries} />
        </div>
      </div>

      {/* College action toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
          "flex items-center gap-2 rounded-xl border border-border bg-card shadow-lg px-4 py-2.5",
          "text-sm font-medium text-foreground",
          toast.exiting
            ? "animate-out fade-out-0 slide-out-to-bottom-3 duration-300 fill-mode-forwards"
            : "animate-in fade-in-0 slide-in-from-bottom-3 duration-200"
        )}>
          {toast.type === "remove"
            ? <XCircle className="h-4 w-4 text-destructive shrink-0" />
            : <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
          {toast.message}
        </div>
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
