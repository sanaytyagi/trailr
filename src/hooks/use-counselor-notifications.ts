"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/hooks/use-profile";

export interface CounselorNotification {
  id: string;
  essay_id: string;
  college_id: string | null;
  college_name: string | null;
  counselor_name: string;
  created_at: string;
}

export function useCounselorNotifications(profile: Profile | null) {
  const [supabase] = useState(() => createClient());
  const [notifications, setNotifications] = useState<CounselorNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const fetchNotifications = useCallback(async () => {
    if (!profile || profile.role !== "student") {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("essay_comments")
      .select(`
        id, essay_id, created_at,
        essay:essays!essay_id(college_id, college:colleges!college_id(name)),
        counselor:profiles!counselor_id(full_name)
      `)
      .eq("resolved", false)
      .eq("read_by_student", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setNotifications(
        (data as any[]).map((c) => ({
          id: c.id,
          essay_id: c.essay_id,
          college_id: c.essay?.college_id ?? null,
          college_name: c.essay?.college?.name ?? null,
          counselor_name: c.counselor?.full_name ?? "Your counselor",
          created_at: c.created_at,
        }))
      );
    }
    setLoading(false);
  }, [profile?.id, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markAllRead() {
    if (!profile) return;
    await (supabase as any)
      .from("essay_comments")
      .update({ read_by_student: true })
      .eq("resolved", false)
      .eq("read_by_student", false);
    setNotifications([]);
  }

  async function markEssayRead(essayId: string) {
    await (supabase as any)
      .from("essay_comments")
      .update({ read_by_student: true })
      .eq("essay_id", essayId)
      .eq("read_by_student", false);
    setNotifications((prev) => prev.filter((n) => n.essay_id !== essayId));
  }

  return {
    notifications,
    count: notifications.length,
    loading,
    markAllRead,
    markEssayRead,
  };
}
