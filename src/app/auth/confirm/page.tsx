"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, AlertTriangle } from "lucide-react";

function ConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/onboarding";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!tokenHash || !type) {
      router.replace("/auth?error=invalid_link");
      return;
    }
    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    setIsLoading(false);
    if (error) {
      router.replace("/auth?error=invalid_link");
      return;
    }
    router.replace(next);
  }

  const linkMissing = !tokenHash || !type;

  return (
    <div className="h-[calc(100vh-4rem)] bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-3 mb-8 group w-fit mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/transparent_logo.png"
            alt="Trailr logo"
            className="h-12 w-auto transition-opacity group-hover:opacity-80"
          />
          <span className="text-4xl font-bold tracking-tight text-foreground transition-opacity group-hover:opacity-80">
            Trailr
          </span>
        </Link>

        <div className="rounded-2xl border border-border bg-card shadow-sm p-8 text-center space-y-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mx-auto">
            <Mail className="h-7 w-7 text-primary" />
          </div>

          <h2 className="text-xl font-semibold text-foreground">Confirm your email</h2>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Click below to verify your account and finish signing up.
          </p>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || linkMissing}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-50 transition-opacity"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm email"}
          </button>

          <div className="pt-2 border-t border-border">
            <Link
              href="/auth"
              className="text-sm text-primary hover:text-primary/80 transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmInner />
    </Suspense>
  );
}
