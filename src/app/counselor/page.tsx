"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Check, Users, Activity, CalendarDays, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface StudentSummary {
  id: string;
  full_name: string | null;
  email: string;
  totalColleges: number;
  submitted: number;
  accepted: number;
  waitlisted: number;
  rejected: number;
  deferred: number;
  urgentDeadlines: number;
  overdueDeadlines: number;
}

interface UpcomingDeadline {
  studentName: string;
  collegeName: string;
  deadline: string;
  studentId: string;
  daysUntil: number;
  applicationStatus: "not_started" | "in_progress" | "submitted";
}

interface ActivityEvent {
  id: string;
  student_id: string;
  type: string;
  college_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  studentName: string | null;
}

interface DashboardStats {
  totalStudents: number;
  totalSubmitted: number;
  totalAccepted: number;
  urgentCount: number;
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold tabular-nums" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

const DECISION_COLORS: Record<string, { text: string; dot: string }> = {
  accepted:   { text: "text-emerald-700", dot: "bg-emerald-400" },
  rejected:   { text: "text-red-600",     dot: "bg-red-400"     },
  waitlisted: { text: "text-amber-700",   dot: "bg-amber-400"   },
  deferred:   { text: "text-amber-700",   dot: "bg-amber-400"   },
};

function renderActivity(event: ActivityEvent): React.ReactNode {
  const name = event.studentName ?? "A student";
  const boldName = <span className="font-semibold text-foreground">{name}</span>;
  const college = event.college_name ?? "a college";

  if (event.type === "decision_change") {
    const decision = (event.metadata?.decision as string | undefined) ?? "";
    const dc = DECISION_COLORS[decision];
    return (
      <div className="flex items-start gap-2">
        {dc && <span className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", dc.dot)} />}
        <div className="min-w-0">
          <p className="text-sm leading-snug">
            {boldName}{" "}
            <span className="text-muted-foreground">received a decision for</span>{" "}
            <span className="font-medium text-foreground">{college}</span>
            {decision && (
              <span className={cn("ml-1.5 text-xs font-bold", dc?.text ?? "text-foreground")}>
                — {decision.charAt(0).toUpperCase() + decision.slice(1)}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (event.type === "add_college" || event.type === "remove_college") {
    const verb = event.type === "add_college" ? "added" : "removed";
    return (
      <p className="text-xs text-muted-foreground leading-snug">
        <span className="font-medium text-foreground/80">{name}</span>{" "}
        {verb} <span className="italic">{college}</span>
      </p>
    );
  }

  if (event.type === "status_change") {
    const status = (event.metadata?.status as string | undefined) ?? "";
    const statusLabel: Record<string, string> = {
      not_started: "Not Started", in_progress: "In Progress", submitted: "Submitted",
    };
    return (
      <p className="text-sm leading-snug">
        {boldName}{" "}
        <span className="text-muted-foreground">updated status for</span>{" "}
        <span className="font-medium text-foreground">{college}</span>
        {status && (
          <span className="ml-1.5 text-xs text-muted-foreground">→ {statusLabel[status] ?? status}</span>
        )}
      </p>
    );
  }

  return <p className="text-sm text-foreground leading-snug">{boldName} made an update</p>;
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CounselorPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [supabase] = useState(() => createClient());
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadline[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (profileLoading) return;
    if (!profile) {
      router.push("/onboarding");
    } else if (profile.role !== "counselor") {
      router.push("/tracker");
    }
  }, [profile, profileLoading, router]);

  const fetchData = useCallback(async () => {
    if (!profile) return;

    const { data: studentProfiles } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, email")
      .eq("counselor_id", profile.id);

    if (!studentProfiles || studentProfiles.length === 0) {
      setStudents([]);
      setDashboardStats({ totalStudents: 0, totalSubmitted: 0, totalAccepted: 0, urgentCount: 0 });
      setLoading(false);
      return;
    }

    const studentIds = (studentProfiles as any[]).map((s) => s.id);
    const nameMap = Object.fromEntries((studentProfiles as any[]).map((s) => [s.id, s.full_name ?? s.email]));

    const { data: userColleges } = await (supabase as any)
      .from("user_colleges")
      .select("user_id, application_status, decision, personal_deadline, college:colleges(id, name)")
      .in("user_id", studentIds);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in14 = new Date(today); in14.setDate(today.getDate() + 14);

    // ── Dashboard aggregate stats (Change 1) ───────────────────────────────────
    const allColleges = (userColleges ?? []) as any[];
    const totalSubmitted = allColleges.filter(c => c.application_status === "submitted").length;
    const totalAccepted  = allColleges.filter(c => c.decision === "accepted").length;
    const urgentCount    = (studentProfiles as any[]).filter((sp: any) =>
      allColleges.some((c: any) => {
        if (c.user_id !== sp.id || c.application_status === "submitted" || !c.personal_deadline) return false;
        const d = new Date(c.personal_deadline + "T00:00:00");
        const days = (d.getTime() - today.getTime()) / 86400000;
        return days >= 0 && days <= 7;
      })
    ).length;
    setDashboardStats({ totalStudents: (studentProfiles as any[]).length, totalSubmitted, totalAccepted, urgentCount });

    // ── Student summaries (Change 2) ───────────────────────────────────────────
    const summaries: StudentSummary[] = (studentProfiles as any[]).map((sp: any) => {
      const colleges = allColleges.filter((c) => c.user_id === sp.id);

      const urgentDeadlines = colleges.filter(c => {
        if (c.application_status === "submitted" || !c.personal_deadline) return false;
        const d = new Date(c.personal_deadline + "T00:00:00");
        const days = (d.getTime() - today.getTime()) / 86400000;
        return days >= 0 && days <= 7;
      }).length;

      const overdueDeadlines = colleges.filter(c => {
        if (c.application_status === "submitted" || !c.personal_deadline) return false;
        return new Date(c.personal_deadline + "T00:00:00") < today;
      }).length;

      return {
        id: sp.id,
        full_name: sp.full_name,
        email: sp.email,
        totalColleges: colleges.length,
        submitted:  colleges.filter((c) => c.application_status === "submitted").length,
        accepted:   colleges.filter((c) => c.decision === "accepted").length,
        waitlisted: colleges.filter((c) => c.decision === "waitlisted").length,
        rejected:   colleges.filter((c) => c.decision === "rejected").length,
        deferred:   colleges.filter((c) => c.decision === "deferred").length,
        urgentDeadlines,
        overdueDeadlines,
      };
    });
    setStudents(summaries);

    // ── Upcoming deadlines — all within 14 days including submitted (Change 4) ─
    const deadlines: UpcomingDeadline[] = allColleges
      .filter((c) => {
        if (!c.personal_deadline) return false;
        const d = new Date(c.personal_deadline + "T00:00:00");
        return d <= in14;
      })
      .map((c) => {
        const d = new Date(c.personal_deadline! + "T00:00:00");
        const daysUntil = Math.round((d.getTime() - today.getTime()) / 86400000);
        return {
          studentName: nameMap[c.user_id],
          collegeName: (c.college as { name: string } | null)?.name ?? "Unknown",
          deadline: c.personal_deadline!,
          studentId: c.user_id,
          daysUntil,
          applicationStatus: c.application_status as "not_started" | "in_progress" | "submitted",
        };
      })
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
    setUpcomingDeadlines(deadlines);

    // ── Activity feed (Change 3) ───────────────────────────────────────────────
    const { data: feed } = await (supabase as any)
      .from("activity_feed")
      .select("id, student_id, type, college_name, metadata, created_at")
      .eq("counselor_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30);

    setActivity(
      ((feed ?? []) as any[]).map((e: any) => ({
        id: e.id,
        student_id: e.student_id,
        type: e.type,
        college_name: e.college_name,
        metadata: (e.metadata as Record<string, unknown> | null) ?? null,
        created_at: e.created_at,
        studentName: nameMap[e.student_id] ?? null,
      }))
    );

    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    if (profile?.role === "counselor") fetchData();
  }, [profile, fetchData]);

  function copyInviteCode() {
    if (!profile?.invite_code) return;
    navigator.clipboard.writeText(profile.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (profileLoading || loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.role !== "counselor") return null;

  const STAT_CHIPS = [
    { key: "totalColleges" as const, label: "Colleges",   color: undefined, bg: undefined },
    { key: "submitted"    as const, label: "Submitted",  color: "hsl(205,85%,50%)", bg: "hsl(205,85%,96%)" },
    { key: "accepted"     as const, label: "Accepted",   color: "hsl(142,60%,30%)", bg: "hsl(142,60%,95%)" },
    { key: "waitlisted"   as const, label: "Waitlisted", color: "hsl(38,85%,35%)",  bg: "hsl(38,85%,95%)"  },
    { key: "rejected"     as const, label: "Rejected",   color: "hsl(0,65%,42%)",   bg: "hsl(0,65%,96%)"   },
    { key: "deferred"     as const, label: "Deferred",   color: "hsl(25,85%,38%)",  bg: "hsl(25,85%,95%)"  },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">My Students</h1>
            {profile.invite_code && (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs">
                <span className="text-muted-foreground">Invite code</span>
                <span className="font-mono font-semibold tracking-widest text-foreground">{profile.invite_code}</span>
                <button
                  onClick={copyInviteCode}
                  className="flex items-center justify-center hover:text-foreground text-muted-foreground transition-colors"
                  title="Copy invite code"
                >
                  {copied
                    ? <Check className="h-3 w-3 text-primary" />
                    : <Copy className="h-3 w-3" />}
                </button>
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {students.length} student{students.length !== 1 ? "s" : ""} connected
          </p>
        </div>
      </div>

      {/* ── Change 1: Summary stat bar ──────────────────────────────────────── */}
      {dashboardStats && students.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Students"   value={dashboardStats.totalStudents} />
          <StatCard label="Total Submitted"  value={dashboardStats.totalSubmitted} color="hsl(205,85%,50%)" />
          <StatCard label="Total Accepted"   value={dashboardStats.totalAccepted}  color="hsl(142,60%,30%)" />
          <StatCard label="Urgent Flags"     value={dashboardStats.urgentCount}    color={dashboardStats.urgentCount > 0 ? "hsl(38,85%,35%)" : undefined} />
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Student roster */}
        <div className="flex-1 min-w-0">
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-border bg-card">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No students yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Share your invite code with students. They can enter it on their tracker page to connect with you.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm divide-y divide-border">
              {students.map((student) => {
                const pct = student.totalColleges > 0
                  ? (student.submitted / student.totalColleges) * 100
                  : 0;
                const isComplete = pct === 100 && student.totalColleges > 0;

                return (
                  <div
                    key={student.id}
                    onClick={() => router.push(`/counselor/${student.id}`)}
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors group"
                  >
                    {/* Name + email */}
                    <div className="w-44 shrink-0">
                      <p className="font-medium text-foreground leading-tight">
                        {student.full_name ?? student.email}
                      </p>
                      {student.full_name && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{student.email}</p>
                      )}
                    </div>

                    {/* Stats + progress bar */}
                    <div className="flex-1 min-w-0">
                      {/* Stat chips */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        {STAT_CHIPS.map(({ key, label, color, bg }) => {
                          const val = student[key];
                          if (key !== "totalColleges" && val === 0) return null;
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-0.5 whitespace-nowrap"
                              style={color ? { color, backgroundColor: bg } : { color: "hsl(var(--foreground))", backgroundColor: "hsl(var(--muted))" }}
                            >
                              <span className="tabular-nums">{val}</span>
                              <span className="opacity-70">{label}</span>
                            </span>
                          );
                        })}
                      </div>
                      {/* Progress bar */}
                      {student.totalColleges > 0 && (
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", isComplete ? "bg-[hsl(142,60%,40%)]" : "bg-primary")}
                            style={{ width: `${pct}%`, transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)" }}
                          />
                        </div>
                      )}
                      {student.totalColleges > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                          {student.submitted} of {student.totalColleges} submitted
                        </p>
                      )}
                    </div>

                    {/* ── Change 2: Urgency indicators ── */}
                    {(student.overdueDeadlines > 0 || student.urgentDeadlines > 0) && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {student.overdueDeadlines > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                            {student.overdueDeadlines} overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                            {student.urgentDeadlines} due soon
                          </span>
                        )}
                      </div>
                    )}

                    {/* Chevron */}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar — two stacked cards */}
        <div className="w-full lg:w-72 lg:shrink-0 flex flex-col gap-4">

          {/* ── Change 4: Deadline panel ── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Upcoming Deadlines</span>
            </div>
            {upcomingDeadlines.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No deadlines in the next 14 days.
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {upcomingDeadlines.map((dl, i) => {
                  const isSubmitted = dl.applicationStatus === "submitted";
                  const isOverdue = dl.daysUntil < 0 && !isSubmitted;
                  const isUrgent = !isSubmitted && !isOverdue && dl.daysUntil <= 7;

                  let dot: string | null = null;
                  let statusPill: React.ReactNode = null;

                  if (isSubmitted) {
                    statusPill = (
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 whitespace-nowrap">
                        Submitted
                      </span>
                    );
                  } else if (isOverdue) {
                    dot = "bg-red-400";
                    statusPill = (
                      <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                        Overdue
                      </span>
                    );
                  } else {
                    dot = isUrgent ? "bg-amber-400" : "bg-amber-300";
                    statusPill = (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                        Action needed
                      </span>
                    );
                  }

                  const daysLabel = isOverdue
                    ? `${Math.abs(dl.daysUntil)}d ago`
                    : dl.daysUntil === 0 ? "Today" : `${dl.daysUntil}d`;

                  return (
                    <li
                      key={i}
                      className={cn(
                        "px-4 py-2.5 flex items-start gap-2 cursor-pointer hover:bg-muted/20 transition-colors",
                        isSubmitted && "opacity-50"
                      )}
                      onClick={() => router.push(`/counselor/${dl.studentId}`)}
                    >
                      {dot && <span className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", dot)} />}
                      {!dot && <span className="h-2 w-2 mt-1.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground leading-snug truncate">{dl.collegeName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{dl.studentName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-[10px] font-semibold tabular-nums",
                            isOverdue ? "text-red-600" : isUrgent ? "text-amber-600" : "text-muted-foreground"
                          )}>
                            {daysLabel}
                          </span>
                          {statusPill}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Change 3: Activity feed with visual hierarchy ── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Recent Activity</span>
            </div>
            {activity.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No activity yet. Updates from students will appear here.
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {activity.map((event) => (
                  <li key={event.id} className="px-4 py-2.5">
                    {renderActivity(event)}
                    <p className="text-[10px] text-muted-foreground mt-1 pl-4">
                      {new Date(event.created_at).toLocaleDateString(undefined, {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
