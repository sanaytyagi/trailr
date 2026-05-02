import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import { signupSchema } from "@/lib/schemas/auth";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
  getRateLimitAdminClient,
  getClientIp,
} from "@/lib/rate-limit";

const ENDPOINT = "auth-signup";
const WINDOW = 15 * 60;
const MAX = 5;

// Rate-limit gate only. The actual signUp runs on the client so the browser's
// Supabase instance fires onAuthStateChange and the header/UI updates without
// a hard refresh.
export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, 4 * 1024);
  if (!parsed.ok) return parsed.response;

  const validation = signupSchema.safeParse(parsed.data);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid signup details" },
      { status: 400 }
    );
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
      "Too many signup attempts. Try again in 15 minutes."
    );
  }

  await recordRateLimitHit(admin, { endpoint: ENDPOINT, key });

  return NextResponse.json({ ok: true });
}
