"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DISMISS_KEY = "trailr:profile-nudge-dismissed";

// Shown on the tracker to a student who has the 3-field core profile but hasn't
// completed the full List Builder quiz. Finishing it gives the AI the full
// picture (budget, preferences, careers, etc.). Dismissible per browser.
export function ProfileCompletionNudge() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1") {
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: listRow }] = await Promise.all([
        supabase.from("profiles").select("role, core_profile").eq("id", user.id).maybeSingle(),
        supabase.from("user_lists").select("colleges").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!active || !profile || profile.role !== "student") return;

      // Only nudge when the core profile exists but the full quiz does not.
      const hasCore = !!profile.core_profile;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = (listRow?.colleges ?? null) as any;
      const hasFullQuiz =
        blob && typeof blob === "object" && !Array.isArray(blob) && !!blob.quiz_answers;

      if (hasCore && !hasFullQuiz) setShow(true);
    }

    check();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (!show) return null;

  function dismiss() {
    if (typeof window !== "undefined") localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/20 bg-primary/5 text-sm">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <span className="text-foreground">
        Finish your profile to get sharper AI advice. It takes about 2 minutes.
      </span>
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={() => router.push("/list-builder")}
          className="text-xs font-medium text-primary hover:underline"
        >
          Complete it
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
