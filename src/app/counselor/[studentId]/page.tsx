"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

interface StudentCollege {
  id: string;
  college_id: string;
  application_status: string;
  application_round: string;
  decision: string | null;
  personal_deadline: string | null;
  college: {
    id: string;
    name: string;
    location: string | null;
    acceptance_rate: number | null;
  };
}

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
      .select("id, college_id, application_status, application_round, decision, personal_deadline, college:colleges(id, name, location, acceptance_rate)")
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Page-level header — outside the card */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/counselor")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
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

      {/* Unified card: stats + progress + table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

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
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left pl-6 pr-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">College</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Application</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deadline</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-amber-700">Counselor Note</th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((c, i) => {
                const status = STATUS_STYLE[c.application_status] ?? STATUS_STYLE.not_started;
                const decision = c.decision ? DECISION_STYLE[c.decision] : null;
                const note = notes[c.college_id];
                const isEditingThis = editingNote === c.college_id;

                return (
                  <tr
                    key={c.id}
                    className={cn("hover:bg-muted/20 transition-colors", i < colleges.length - 1 && "border-b border-border")}
                  >
                    <td className="pl-6 pr-4 py-4">
                      <p className="font-medium text-foreground">{c.college.name}</p>
                      {c.college.location && (
                        <p className="text-xs text-muted-foreground mt-0.5">{c.college.location}</p>
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
                      {c.personal_deadline
                        ? new Date(c.personal_deadline + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                        : <span className="text-muted-foreground/40">—</span>}
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
        )}
      </div>
    </div>
  );
}
