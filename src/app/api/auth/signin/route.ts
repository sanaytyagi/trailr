import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseJsonBody } from "@/lib/parse-json-body";
import { signinSchema } from "@/lib/schemas/auth";
import {
  checkRateLimit,
  recordRateLimitHit,
  clearRateLimit,
  rateLimitedResponse,
  getRateLimitAdminClient,
  getClientIp,
} from "@/lib/rate-limit";

const ENDPOINT = "auth-signin";
const WINDOW = 15 * 60; // 15 min
const MAX = 5; // failed attempts per window before lockout

// Sign-in runs server-side here so the rate limiter can authoritatively tell a
// success from a failure and count ONLY failed attempts toward the lockout. (A
// client-reported result could be faked by an attacker, defeating the limit.)
// On success we return the session tokens; the client calls setSession() so the
// browser fires onAuthStateChange and the header/UI updates without a refresh.
export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, 4 * 1024);
  if (!parsed.ok) return parsed.response;

  const validation = signinSchema.safeParse(parsed.data);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 400 }
    );
  }
  const { email, password } = validation.data;

  const ip = getClientIp(req);
  const key = `ip:${ip}|email:${email}`;
  const admin = getRateLimitAdminClient();

  // Block first, based on prior FAILED attempts in the window.
  const limit = await checkRateLimit(admin, {
    endpoint: ENDPOINT,
    key,
    windowSeconds: WINDOW,
    max: MAX,
  });
  if (!limit.ok) {
    return rateLimitedResponse(
      limit,
      "Too many sign-in attempts. Try again in 15 minutes."
    );
  }

  // Authenticate server-side with a stateless anon client (no session persisted
  // here — the browser owns the session via setSession on the response).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    // Count ONLY failed attempts toward the lockout.
    await recordRateLimitHit(admin, { endpoint: ENDPOINT, key });

    // A registered-but-unconfirmed email is a distinct, actionable case: tell
    // the user and let the client offer to resend the confirmation link.
    if (error?.code === "email_not_confirmed") {
      return NextResponse.json(
        {
          error: "Please confirm your email before signing in.",
          code: "email_not_confirmed",
        },
        { status: 401 }
      );
    }

    // Everything else gets one generic message. Not revealing whether the email
    // exists keeps the endpoint from being used to enumerate accounts.
    return NextResponse.json(
      { error: "The email or password you entered is incorrect." },
      { status: 401 }
    );
  }

  // Verified success: reset the failure counter so a legitimate user is never
  // locked out by their own successful logins.
  await clearRateLimit(admin, { endpoint: ENDPOINT, key });

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
