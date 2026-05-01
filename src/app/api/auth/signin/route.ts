import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import { signinSchema } from "@/lib/schemas/auth";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
  getRateLimitAdminClient,
  getClientIp,
} from "@/lib/rate-limit";

const ENDPOINT = "auth-signin";
const WINDOW = 15 * 60; // 15 min
const MAX = 5;

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

  // Record the attempt BEFORE calling Supabase so brute-force counters tick
  // even on successful guesses.
  await recordRateLimitHit(admin, { endpoint: ENDPOINT, key });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status ?? 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    user: { id: data.user?.id, email: data.user?.email },
  });
}
