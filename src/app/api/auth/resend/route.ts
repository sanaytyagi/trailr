import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import { resendSchema } from "@/lib/schemas/auth";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
  getRateLimitAdminClient,
  getClientIp,
} from "@/lib/rate-limit";

const ENDPOINT = "auth-resend";
const WINDOW = 15 * 60;
const MAX = 5;

// Resends the signup confirmation email. Mirrors the reset endpoint: rate-limit
// gate, then always return { ok: true } so the response can't be used to probe
// which emails are registered or already confirmed.
export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, 4 * 1024);
  if (!parsed.ok) return parsed.response;

  const validation = resendSchema.safeParse(parsed.data);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const { email } = validation.data;

  const ip = getClientIp(req);
  const key = `ip:${ip}|email:${email}`;
  const admin = getRateLimitAdminClient();

  const limit = await checkRateLimit(admin, {
    endpoint: ENDPOINT,
    key,
    windowSeconds: WINDOW,
    max: MAX,
  });
  if (!limit.ok) {
    return rateLimitedResponse(
      limit,
      "Too many requests. Try again in 15 minutes."
    );
  }

  await recordRateLimitHit(admin, { endpoint: ENDPOINT, key });

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${new URL(req.url).origin}/auth/callback?next=/onboarding`,
    },
  });

  // Don't leak whether the email exists or is already confirmed.
  if (error) {
    console.error("auth-resend error:", error.message);
  }

  return NextResponse.json({ ok: true });
}
