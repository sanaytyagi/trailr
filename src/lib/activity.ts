import type { SupabaseClient } from "@supabase/supabase-js";

interface ActivityEvent {
  studentId: string;
  counselorId: string;
  type: string;
  collegeName?: string;
  collegeId?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(
  supabase: SupabaseClient,
  event: ActivityEvent
): Promise<void> {
  try {
    await supabase.from("activity_feed").insert({
      student_id: event.studentId,
      counselor_id: event.counselorId,
      type: event.type,
      college_name: event.collegeName ?? null,
      college_id: event.collegeId ?? null,
      metadata: event.metadata ?? null,
    });
  } catch {
    // Fire-and-forget: never throw
  }
}
