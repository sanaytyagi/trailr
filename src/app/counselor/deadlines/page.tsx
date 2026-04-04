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

    const { data: studentProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("counselor_id", profile.id);

    if (!studentProfiles || studentProfiles.length === 0) {
      setStudents([]);
      setEntries([]);
      setLoading(false);
      return;
    }

    setStudents(studentProfiles);

    const studentIds = studentProfiles.map((s) => s.id);
    const nameMap = Object.fromEntries(
      studentProfiles.map((s) => [s.id, s.full_name ?? s.email])
    );

    const { data: userColleges } = await supabase
      .from("user_colleges")
      .select("user_id, application_status, personal_deadline, college:colleges(id, name)")
      .in("user_id", studentIds)
      .not("personal_deadline", "is", null)
      .neq("application_status", "submitted");

    const allEntries: DeadlineEntry[] = (userColleges ?? [])
      .filter((c) => c.personal_deadline)
      .map((c) => ({
        collegeId: `${c.user_id}-${(c.college as any).id}`,
        collegeName: `${nameMap[c.user_id]} — ${(c.college as any).name}`,
        deadline: c.personal_deadline!,
        studentId: c.user_id,
      }));

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
    : entries.filter((e) => (e as any).studentId === selectedStudent);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
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
        <div className="flex justify-center">
          <DeadlineCalendar entries={filteredEntries} />
        </div>
      )}
    </div>
  );
}
