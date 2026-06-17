"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Mail, Loader2 } from "lucide-react";
import { useCooldown } from "@/lib/use-cooldown";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const resend = useCooldown(60);

  async function handleResend() {
    if (!email || isSending || resend.active) return;
    setIsSending(true);
    setMessage("");
    try {
      await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setMessage("Sent. Check your inbox and spam folder.");
      resend.start();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

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

          <h2 className="text-xl font-semibold text-foreground">Check your email</h2>

          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent a verification link to{" "}
            {email ? (
              <span className="font-medium text-foreground">{email}</span>
            ) : (
              "your email address"
            )}
            . Click the link to verify your account and get started.
          </p>

          <p className="text-xs text-muted-foreground">
            Can&apos;t find it? Check your spam folder.
          </p>

          {email && (
            <button
              type="button"
              onClick={handleResend}
              disabled={isSending || resend.active}
              className="w-full bg-primary text-primary-foreground font-medium py-2.5 px-6 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : resend.active ? (
                <>Resend in {resend.remaining}s</>
              ) : (
                <>Resend verification email</>
              )}
            </button>
          )}

          {message && <p className="text-xs text-muted-foreground">{message}</p>}

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

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
