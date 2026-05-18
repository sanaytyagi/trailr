"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, BookOpen, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Counselor role is hidden pre-launch. Set NEXT_PUBLIC_COUNSELOR_ENABLED=true to restore.
const COUNSELOR_ENABLED = process.env.NEXT_PUBLIC_COUNSELOR_ENABLED === "true";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function OnboardingPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth?mode=signin");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile check error:", profileError.message);
      }

      if (profile) {
        router.push(profile.role === "counselor" ? "/counselor" : "/tracker");
        return;
      }

      if (!COUNSELOR_ENABLED) {
        // Counselor role hidden pre-launch: onboard everyone straight to student.
        handleSelect("student");
        return;
      }

      setLoading(false);
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router]);

  async function handleSelect(role: "student" | "counselor") {
    setSubmitting(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check first — profile may already exist (returning user, or RLS hid it from check())
    const { data: existing } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) {
      router.push(existing.role === "counselor" ? "/counselor" : "/tracker");
      return;
    }

    const inviteCode = role === "counselor" ? generateInviteCode() : null;

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email!,
      full_name: (user.user_metadata?.name as string) ?? null,
      role,
      invite_code: inviteCode,
    });

    if (insertError) {
      // Duplicate key means profile was created between our check and insert — just redirect
      if (insertError.code === "23505") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        const actualRole = profile?.role ?? role;
        router.push(actualRole === "counselor" ? "/counselor" : "/tracker");
        return;
      }
      console.error("Failed to create profile:", insertError.message);
      setError("Failed to set up your account. Please try again.");
      setSubmitting(false);
      setLoading(false);
      return;
    }

    router.push(role === "counselor" ? "/counselor" : "/tracker");
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6">
      <div className="max-w-2xl w-full text-center mb-10">
        <h1 className="text-3xl font-bold mb-3">Welcome to Trailr</h1>
        <p className="text-muted-foreground text-lg">How will you be using the app?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-2xl w-full">
        <button
          onClick={() => handleSelect("student")}
          disabled={submitting}
          className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-8 text-center hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-1">I'm a Student</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Track your college applications, get AI-powered advice, and build your college list.
            </p>
          </div>
        </button>

        {COUNSELOR_ENABLED && (
          <button
            onClick={() => handleSelect("counselor")}
            disabled={submitting}
            className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-8 text-center hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">I'm a Counselor</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Monitor your students' progress, view their college lists, and add personalized notes.
              </p>
            </div>
          </button>
        )}
      </div>

      {error && (
        <p className="mt-6 text-sm text-destructive text-center">{error}</p>
      )}

      {submitting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}
