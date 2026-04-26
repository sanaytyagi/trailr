"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthForm } from "@/components/ui/premium-auth";

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [supabase] = useState(() => createClient());

  function handleModeChange(mode: "login" | "signup" | "reset") {
    // Keep the URL in sync so back/forward and bookmarks work; reset mode
    // is transient and shouldn't show in the URL.
    const next = new URLSearchParams(searchParams.toString());
    if (mode === "reset") next.delete("mode");
    else next.set("mode", mode);
    const qs = next.toString();
    router.replace(qs ? `/auth?${qs}` : "/auth", { scroll: false });
  }

  // Redirect already-signed-in users.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/onboarding");
    });
  }, [supabase, router]);

  // Lock body scroll for this page only.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function handleSuccess() {
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-8 group w-fit mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/transparent_logo.png"
            alt="Trailr logo"
            className="h-16 w-auto transition-opacity group-hover:opacity-80"
          />
          <span className="text-4xl font-bold tracking-tight text-foreground transition-opacity group-hover:opacity-80">
            Trailr
          </span>
        </Link>

        {/* Auth card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <AuthForm onSuccess={handleSuccess} initialMode={initialMode} onModeChange={handleModeChange} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <span className="underline underline-offset-2 cursor-pointer hover:text-foreground transition-colors">
            Privacy Policy
          </span>
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthPageInner />
    </Suspense>
  );
}
