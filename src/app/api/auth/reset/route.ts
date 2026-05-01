import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import { resetSchema } from "@/lib/schemas/auth";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
  getRateLimitAdminClient,
  getClientIp,
} from "@/lib/rate-limit";

const ENDPOINT = "auth-reset";
const WINDOW = 15 * 60;
const MAX = 5;

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, 4 * 1024);
  if (!parsed.ok) return parsed.response;

  const validation = resetSchema.safeParse(parsed.data);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid email" },
      { status: 400 }
    );
  }
  const { email, redirectTo } = validation.data;

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
      "Too many password reset attempts. Try again in 15 minutes."
    );
  }

  await recordRateLimitHit(admin, { endpoint: ENDPOINT, key });

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined
  );

  // Don't leak whether the email exists.
  if (error) {
    console.error("auth-reset error:", error.message);
  }

  return NextResponse.json({ ok: true });
}
