"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

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
