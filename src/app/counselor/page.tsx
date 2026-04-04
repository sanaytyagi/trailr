"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Check, Users, Activity, CalendarDays, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

interface StudentSummary {
  id: string;
  full_name: string | null;
  email: string;
  totalColleges: number;
  submitted: number;
  accepted: number;
  waitlisted: number;
  rejected: number;
}

interface UpcomingDeadline {
  studentName: string;
  collegeName: string;
  deadline: string;
  studentId: string;
  daysUntil: number;
}

interface ActivityEvent {
  id: string;
  student_id: string;
  type: string;
  college_name: string | null;
  created_at: string;
  studentName: string | null;
}

const STAT_CHIPS = [
  { key: "totalColleges", label: "Colleges", color: undefined, bg: undefined },
  { key: "submitted",     label: "Submitted", color: "hsl(205,85%,50%)", bg: "hsl(205,85%,96%)" },
  { key: "accepted",      label: "Accepted",  color: "hsl(142,60%,30%)", bg: "hsl(142,60%,95%)" },
  { key: "waitlisted",    label: "Waitlisted",color: "hsl(38,85%,35%)",  bg: "hsl(38,85%,95%)"  },
  { key: "rejected",      label: "Rejected",  color: "hsl(0,65%,42%)",   bg: "hsl(0,65%,96%)"   },
] as const;

export default function CounselorPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [supabase] = useState(() => createClient());
  const [students, setStudents] = useState<StudentSummary[]>([]);
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

    const { data: studentProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("counselor_id", profile.id);

    if (!studentProfiles || studentProfiles.length === 0) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const studentIds = studentProfiles.map((s) => s.id);
    const nameMap = Object.fromEntries(studentProfiles.map((s) => [s.id, s.full_name ?? s.email]));

    const { data: userColleges } = await supabase
      .from("user_colleges")
      .select("user_id, application_status, decision, personal_deadline, college:colleges(id, name)")
      .in("user_id", studentIds);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in14 = new Date(today); in14.setDate(today.getDate() + 14);

    // Build student summaries
    const summaries: StudentSummary[] = studentProfiles.map((sp) => {
      const colleges = (userColleges ?? []).filter((c) => c.user_id === sp.id);
      return {
        id: sp.id,
        full_name: sp.full_name,
        email: sp.email,
        totalColleges: colleges.length,
        submitted: colleges.filter((c) => c.application_status === "submitted").length,
        accepted: colleges.filter((c) => c.decision === "accepted").length,
        waitlisted: colleges.filter((c) => c.decision === "waitlisted").length,
        rejected: colleges.filter((c) => c.decision === "rejected").length,
      };
    });
    setStudents(summaries);

    // Build upcoming deadlines (next 14 days, not yet submitted)
    const deadlines: UpcomingDeadline[] = (userColleges ?? [])
      .filter((c) => c.personal_deadline && c.application_status !== "submitted")
      .filter((c) => {
        const d = new Date(c.personal_deadline! + "T00:00:00");
        return d >= today && d <= in14;
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
        };
      })
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
    setUpcomingDeadlines(deadlines);

    // Fetch activity feed
    const { data: feed } = await supabase
      .from("activity_feed")
      .select("id, student_id, type, college_name, created_at")
      .eq("counselor_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30);

    setActivity(
      (feed ?? []).map((e) => ({ ...e, studentName: nameMap[e.student_id] ?? null }))
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

  function formatActivity(event: ActivityEvent): string {
    const name = event.studentName ?? "A student";
    switch (event.type) {
      case "add_college":    return `${name} added ${event.college_name ?? "a college"}`;
      case "remove_college": return `${name} removed ${event.college_name ?? "a college"}`;
      case "status_change":  return `${name} updated status for ${event.college_name ?? "a college"}`;
      case "decision_change":return `${name} changed decision status for ${event.college_name ?? "a college"}`;
      default:               return `${name} made an update`;
    }
  }

  if (profileLoading || loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.role !== "counselor") return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
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

      <div className="flex gap-6 items-start">
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

                    {/* Chevron */}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar — two stacked cards */}
        <div className="w-72 shrink-0 flex flex-col gap-4">

          {/* Upcoming Deadlines */}
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
              <ul className="divide-y divide-border max-h-56 overflow-y-auto">
                {upcomingDeadlines.map((dl, i) => {
                  const urgency = dl.daysUntil === 0
                    ? "text-red-600"
                    : dl.daysUntil <= 7
                    ? "text-amber-600"
                    : "text-muted-foreground";
                  return (
                    <li
                      key={i}
                      className="px-4 py-2.5 flex items-start justify-between gap-2 cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => router.push(`/counselor/${dl.studentId}`)}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground leading-snug truncate">{dl.collegeName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{dl.studentName}</p>
                      </div>
                      <span className={cn("text-[10px] font-semibold whitespace-nowrap mt-0.5 tabular-nums", urgency)}>
                        {dl.daysUntil === 0 ? "Today" : `${dl.daysUntil}d`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Recent Activity */}
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
                  <li key={event.id} className="px-4 py-3">
                    <p className="text-sm text-foreground leading-snug">{formatActivity(event)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
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
