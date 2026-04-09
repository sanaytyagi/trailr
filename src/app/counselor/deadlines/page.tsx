"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { DeadlineCalendar, type DeadlineEntry } from "@/components/deadline-calendar";

interface StudentProfile {
  id: string;
  full_name: string | null;
  email: string;
}

export default function CounselorDeadlinesPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [supabase] = useState(() => createClient());

  const [entries, setEntries] = useState<DeadlineEntry[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
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

    const { data: studentProfiles } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, email")
      .eq("counselor_id", profile.id);

    if (!studentProfiles || studentProfiles.length === 0) {
      setStudents([]);
      setEntries([]);
      setLoading(false);
      return;
    }

    setStudents(studentProfiles as StudentProfile[]);

    const studentIds = (studentProfiles as any[]).map((s: any) => s.id);
    const nameMap = Object.fromEntries(
      (studentProfiles as any[]).map((s: any) => [s.id, s.full_name ?? s.email])
    );

    // Include all deadlines (submitted + unsubmitted) for Change 1
    const { data: userColleges } = await (supabase as any)
      .from("user_colleges")
      .select("user_id, application_status, personal_deadline, college:colleges(id, name)")
      .in("user_id", studentIds)
      .not("personal_deadline", "is", null);

    const allEntries: DeadlineEntry[] = ((userColleges ?? []) as any[])
      .filter((c: any) => c.personal_deadline)
      .map((c: any) => {
        const college = c.college as { id: string; name: string };
        const studentName = nameMap[c.user_id] as string;
        return {
          collegeId: `${c.user_id}-${college.id}`,
          collegeName: `${studentName} — ${college.name}`,
          deadline: c.personal_deadline as string,
          studentId: c.user_id as string,
          applicationStatus: c.application_status as string,
          studentName,
          rawCollegeName: college.name,
        };
      });

    setEntries(allEntries);
    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    if (profile?.role === "counselor") fetchData();
  }, [profile, fetchData]);

  if (profileLoading || loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.role !== "counselor") return null;

  const filteredEntries = selectedStudent === "all"
    ? entries
    : entries.filter((e) => e.studentId === selectedStudent);

  function handleEntryClick(entry: DeadlineEntry) {
    if (entry.studentId) router.push(`/counselor/${entry.studentId}`);
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deadlines</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All upcoming deadlines across your students</p>
        </div>

        {students.length > 1 && (
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Students</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name ?? s.email}
              </option>
            ))}
          </select>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-border bg-card">
          <p className="text-sm font-medium text-foreground mb-1">No deadlines yet</p>
          <p className="text-xs text-muted-foreground">
            Deadlines will appear here when your students set them on their college tracker.
          </p>
        </div>
      ) : (
        <DeadlineCalendar entries={filteredEntries} onEntryClick={handleEntryClick} twoColumn />
      )}
    </div>
  );
}
