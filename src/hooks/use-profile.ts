"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "student" | "counselor";
  counselor_id: string | null;
  invite_code: string | null;
  created_at: string;
}

export function useProfile() {
  const [supabase] = useState(() => createClient());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    setProfile(data as Profile | null);
    setLoading(false);
  }, [supabase]);

  // Re-fetch on route change — catches the case where a profile was just created
  // (e.g. onboarding → /counselor) without an auth state change firing
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile, pathname]);

  // Re-fetch on auth state change (sign in / sign out)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });
    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  return { profile, loading, refetch: fetchProfile };
}
