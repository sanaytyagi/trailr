"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, MessageSquare, BookText } from "lucide-react";
import { CollegeLogo } from "@/components/college-logo";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

interface StudentEssay {
  id: string;
  college_id: string | null;
  prompt: string;
  word_limit: number;
  body: string;
  status: "not_started" | "drafting" | "final";
}

interface StudentCollege {
  id: string;
  college_id: string;
  application_status: string;
  application_round: string;
  decision: string | null;
  personal_deadline: string | null;
  admissions_category: "reach" | "high_match" | "target" | "safety" | null;
  college: {
    id: string;
    name: string;
    location: string | null;
    acceptance_rate: number | null;
    website_url: string | null;
    logo_url: string | null;
  };
}

const CATEGORY_ORDER: Record<string, number> = { reach: 0, high_match: 1, target: 2, safety: 3 };

function getDeadlineStatus(iso: string): { label: string; className: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split("-").map(Number);
  const deadline = new Date(y, m - 1, d);
  const diffDays = Math.round((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0)   return { label: "Overdue",          className: "text-destructive" };
  if (diffDays === 0) return { label: "Today",            className: "text-destructive" };
  if (diffDays <= 7)  return { label: `${diffDays}d left`, className: "text-destructive" };
  if (diffDays <= 30) return { label: `${diffDays}d left`, className: "text-[hsl(38,85%,35%)]" };
  return                     { label: `${diffDays}d left`, className: "text-[hsl(142,60%,35%)]" };
}

const CATEGORY_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  reach:      { label: "Reach",      color: "hsl(0,65%,42%)",    bg: "hsl(0,65%,96%)",    border: "hsl(0,65%,80%)"    },
  high_match: { label: "High Match", color: "hsl(38,85%,35%)",   bg: "hsl(38,85%,95%)",   border: "hsl(38,85%,75%)"   },
  target:     { label: "Match",      color: "hsl(213,80%,40%)",  bg: "hsl(213,80%,95%)",  border: "hsl(213,80%,75%)"  },
  safety:     { label: "Safety",     color: "hsl(142,60%,30%)",  bg: "hsl(142,60%,95%)",  border: "hsl(142,60%,78%)"  },
};

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

const STAT_COLS = [
  { key: "total",      label: "Colleges",   color: undefined },
  { key: "submitted",  label: "Submitted",  color: "hsl(205,85%,45%)" },
  { key: "accepted",   label: "Accepted",   color: "hsl(142,60%,35%)" },
  { key: "waitlisted", label: "Waitlisted", color: "hsl(38,85%,35%)"  },
  { key: "rejected",   label: "Rejected",   color: "hsl(0,65%,45%)"   },
] as const;

export default function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [supabase] = useState(() => createClient());

  const [student, setStudent] = useState<{ full_name: string | null; email: string } | null>(null);
  const [colleges, setColleges] = useState<StudentCollege[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"colleges" | "essays">(
    searchParams.get("tab") === "essays" ? "essays" : "colleges"
  );
  const [studentEssays, setStudentEssays] = useState<StudentEssay[]>([]);
  const [essaysLoaded, setEssaysLoaded] = useState(false);

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

    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("id, full_name, email, counselor_id")
      .eq("id", studentId)
      .single();

    if (!studentProfile || studentProfile.counselor_id !== profile.id) {
      router.push("/counselor");
      return;
    }

    setStudent({ full_name: studentProfile.full_name, email: studentProfile.email });

    const { data: userColleges } = await supabase
      .from("user_colleges")
      .select("id, college_id, application_status, application_round, decision, personal_deadline, admissions_category, college:colleges(id, name, location, acceptance_rate, website_url, logo_url)")
      .eq("user_id", studentId)
      .order("added_at", { ascending: true });

    setColleges((userColleges ?? []) as unknown as StudentCollege[]);

    const { data: counselorNotes } = await supabase
      .from("counselor_college_notes")
      .select("college_id, note")
      .eq("counselor_id", profile.id)
      .eq("student_id", studentId);

    if (counselorNotes) {
      const map: Record<string, string> = {};
      for (const row of counselorNotes) map[row.college_id] = row.note;
      setNotes(map);
    }

    setLoading(false);
  }, [profile, studentId, supabase, router]);

  useEffect(() => {
    if (profile?.role === "counselor") fetchData();
  }, [profile, fetchData]);

  async function saveNote(collegeId: string, note: string) {
    if (!profile) return;
    if (note.trim()) {
      await supabase.from("counselor_college_notes").upsert(
        { counselor_id: profile.id, student_id: studentId, college_id: collegeId, note: note.trim(), updated_at: new Date().toISOString() },
        { onConflict: "counselor_id,student_id,college_id" }
      );
      setNotes((prev) => ({ ...prev, [collegeId]: note.trim() }));
    } else {
      await supabase
        .from("counselor_college_notes")
        .delete()
        .eq("counselor_id", profile.id)
        .eq("student_id", studentId)
        .eq("college_id", collegeId);
      setNotes((prev) => { const next = { ...prev }; delete next[collegeId]; return next; });
    }
    setEditingNote(null);
  }

  async function loadEssays() {
    if (!profile || essaysLoaded) return;
    const { data: essays } = await supabase
      .from("essays")
      .select("id, college_id, prompt, word_limit, body, status")
      .eq("user_id", studentId)
      .order("created_at", { ascending: true });
    setStudentEssays((essays ?? []) as StudentEssay[]);
    setEssaysLoaded(true);
  }

  useEffect(() => {
    if (tab === "essays" && !essaysLoaded && profile) loadEssays();
  }, [tab, essaysLoaded, profile]);

  if (profileLoading || loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.role !== "counselor" || !student) return null;

  const stats = {
    total: colleges.length,
    submitted: colleges.filter((c) => c.application_status === "submitted").length,
    accepted: colleges.filter((c) => c.decision === "accepted").length,
    waitlisted: colleges.filter((c) => c.decision === "waitlisted").length,
    rejected: colleges.filter((c) => c.decision === "rejected").length,
  };

  const pct = stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0;
  const isComplete = pct === 100 && stats.total > 0;

  const sortedColleges = [...colleges].sort((a, b) => {
    const ai = a.admissions_category != null ? (CATEGORY_ORDER[a.admissions_category] ?? 99) : 99;
    const bi = b.admissions_category != null ? (CATEGORY_ORDER[b.admissions_category] ?? 99) : 99;
    return ai - bi;
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Page-level header — outside the card */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/counselor")}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            {student.full_name ?? student.email}
          </h1>
          {student.full_name && (
            <p className="text-sm text-muted-foreground">{student.email}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {(["colleges", "essays"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); if (t === "essays") loadEssays(); }}
            className={cn(
              "px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Essays tab */}
      {tab === "essays" && (
        <div className="flex flex-col gap-4">
          {studentEssays.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border">
              <BookText className="h-9 w-9 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-foreground mb-0.5">No essays yet</p>
              <p className="text-xs text-muted-foreground">This student hasn't added any essays.</p>
            </div>
          ) : (
            (() => {
              // Group by college_id (skip personal statements with no college)
              const byCollege = new Map<string, StudentEssay[]>();
              for (const e of studentEssays) {
                const key = e.college_id ?? "__common_app__";
                const arr = byCollege.get(key) ?? [];
                arr.push(e);
                byCollege.set(key, arr);
              }
              // Build college name map from colleges state
              const nameMap = new Map(colleges.map((c) => [c.college_id, c.college.name]));

              return Array.from(byCollege.entries()).map(([collegeId, essays]) => (
                <div key={collegeId} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border bg-muted/30">
                    <p className="text-sm font-semibold text-foreground">{collegeId === "__common_app__" ? "Common App Personal Statement" : (nameMap.get(collegeId) ?? collegeId)}</p>
                  </div>
                  <div className="divide-y divide-border">
                    {essays.map((essay) => {
                      const words = essay.body.trim() === "" ? 0 : essay.body.trim().split(/\s+/).length;
                      const pct = Math.min((words / essay.word_limit) * 100, 100);
                      const over = words > essay.word_limit;
                      const statusLabel = essay.status === "final" ? "Complete" : !essay.body.trim() ? "Not Started" : "Drafting";
                      const badgeCls =
                        statusLabel === "Complete" ? "bg-emerald-100 text-emerald-700" :
                        statusLabel === "Drafting" ? "bg-amber-100 text-amber-700" :
                        "bg-muted text-muted-foreground";
                      return (
                        <div
                          key={essay.id}
                          onClick={() => router.push(`/essays/${essay.id}`)}
                          className="px-5 py-4 cursor-pointer hover:bg-primary/5 hover:border-l-2 hover:border-l-primary transition-all group"
                        >
                          {/* Prompt */}
                          <p className="text-sm text-foreground line-clamp-2 leading-snug mb-2.5 group-hover:text-primary transition-colors">
                            {essay.prompt || <span className="italic text-muted-foreground">No prompt</span>}
                          </p>
                          {/* Word count + status */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className={cn("text-[11px] mt-1 tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
                                {words} / {essay.word_limit} words
                              </p>
                            </div>
                            <span className={cn("shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-0.5", badgeCls)}>
                              {statusLabel}
                            </span>
                          </div>
                          {/* View link */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => router.push(`/essays/${essay.id}`)}
                              className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                            >
                              View essay →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()
          )}
        </div>
      )}

      {/* Unified card: stats + progress + table */}
      {tab === "colleges" && <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

        {/* Stats strip */}
        <div className="flex items-center gap-8 px-6 py-4 border-b border-border bg-muted/20 flex-wrap">
          {STAT_COLS.map(({ key, label, color }) => (
            <div key={key} className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
              <span
                className="text-2xl font-bold tabular-nums"
                style={color ? { color } : undefined}
              >
                {stats[key]}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar strip */}
        {stats.total > 0 && (
          <div className="px-6 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-foreground">Application Progress</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {stats.submitted} of {stats.total} submitted
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full", isComplete ? "bg-[hsl(142,60%,40%)]" : "bg-primary")}
                style={{ width: `${pct}%`, transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </div>
          </div>
        )}

        {/* College table — nested directly inside the card */}
        {colleges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-foreground mb-1">No colleges tracked yet</p>
            <p className="text-xs text-muted-foreground">This student hasn't added any colleges.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left pl-5 pr-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">College</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Application</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deadline</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-amber-700">Counselor Note</th>
              </tr>
            </thead>
            <tbody>
              {sortedColleges.map((c, i) => {
                const status = STATUS_STYLE[c.application_status] ?? STATUS_STYLE.not_started;
                const decision = c.decision ? DECISION_STYLE[c.decision] : null;
                const category = c.admissions_category ? CATEGORY_STYLE[c.admissions_category] : null;
                const note = notes[c.college_id];
                const isEditingThis = editingNote === c.college_id;

                const urgencyDot = (() => {
                  if (!c.personal_deadline || c.application_status === "submitted") return null;
                  const ds = getDeadlineStatus(c.personal_deadline);
                  if (ds.className === "text-[hsl(142,60%,35%)]") return null;
                  return ds.className === "text-[hsl(38,85%,35%)]"
                    ? "bg-[hsl(38,85%,50%)]"
                    : "bg-destructive";
                })();

                return (
                  <tr
                    key={c.id}
                    className={cn("hover:bg-muted/20 transition-colors", i < sortedColleges.length - 1 && "border-b border-border")}
                  >
                    <td className="pl-5 pr-4 py-4">
                      <div className="flex items-center gap-3">
                        <CollegeLogo
                          name={c.college.name}
                          website_url={c.college.website_url}
                          logo_url={c.college.logo_url}
                          size={32}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-foreground">{c.college.name}</p>
                            {urgencyDot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", urgencyDot)} />}
                          </div>
                          {c.college.location && (
                            <p className="text-xs text-muted-foreground mt-0.5">{c.college.location}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {category ? (
                        <span
                          className="text-xs font-semibold rounded-md border px-2 py-0.5 whitespace-nowrap"
                          style={{ color: category.color, backgroundColor: category.bg, borderColor: category.border }}
                        >
                          {category.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="text-xs font-medium rounded-md px-2 py-0.5 whitespace-nowrap"
                        style={{ color: status.color, backgroundColor: status.bg }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {decision ? (
                        <span
                          className="text-xs font-medium rounded-md px-2 py-0.5 whitespace-nowrap"
                          style={{ color: decision.color, backgroundColor: decision.bg }}
                        >
                          {decision.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-muted-foreground">
                      {c.personal_deadline ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{new Date(c.personal_deadline + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                          {c.application_status !== "submitted" && (() => {
                            const ds = getDeadlineStatus(c.personal_deadline);
                            return <span className={cn("font-medium", ds.className)}>{ds.label}</span>;
                          })()}
                        </div>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-4 max-w-[200px]">
                      {isEditingThis ? (
                        <div className="flex flex-col gap-1">
                          <textarea
                            autoFocus
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            rows={3}
                            className="w-full text-xs bg-muted/50 rounded-md px-2 py-1.5 resize-none outline-none focus:ring-2 focus:ring-ring"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveNote(c.college_id, editingText)}
                              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingNote(null)}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingNote(c.college_id); setEditingText(note ?? ""); }}
                          className="text-left w-full rounded-md px-2 py-1 hover:bg-muted/60 transition-colors group"
                        >
                          {note ? (
                            <p className="text-xs text-amber-900 leading-snug">{note}</p>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                              <MessageSquare className="h-3 w-3" />
                              Add note
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>}
    </div>
  );
}
