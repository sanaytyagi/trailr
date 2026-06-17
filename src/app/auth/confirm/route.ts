import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Auto-confirms the email link. Clicking the link in the email IS the
// confirmation, so we verify the OTP server-side and redirect straight to
// onboarding — no extra "Confirm email" button to press. The SSR client writes
// the session cookies onto the redirect response, so the user lands already
// signed in.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Recovery links must always land on the set-new-password screen. We force it
  // here rather than trusting the email template's `next`, so a "reset password"
  // click can never silently sign the user in and drop them on onboarding
  // without letting them choose a new password.
  const next =
    type === "recovery"
      ? "/auth/update-password"
      : searchParams.get("next") ?? "/onboarding";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=invalid_link`);
}
