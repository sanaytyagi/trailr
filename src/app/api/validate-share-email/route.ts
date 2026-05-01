import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import { shareEmailSchema } from "@/lib/schemas/share-email";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

const ENDPOINT = "validate-share-email";
const WINDOW = 60 * 60;
const MAX = 20;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();

  // Verify requester is authenticated
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkRateLimit(supabase, {
    endpoint: ENDPOINT,
    userId: user.id,
    windowSeconds: WINDOW,
    max: MAX,
  });
  if (!limit.ok) {
    return rateLimitedResponse(
      limit,
      "Too many email validation requests. Try again later."
    );
  }

  const parsed = await parseJsonBody(req, 4 * 1024);
  if (!parsed.ok) return parsed.response;

  const validation = shareEmailSchema.safeParse(parsed.data);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid email" },
      { status: 400 }
    );
  }
  const { email } = validation.data;

  // Query GoTrue admin endpoint for a specific email — avoids loading all users into memory
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to validate email" }, { status: 500 });
  }

  const json = await res.json();
  const exists = Array.isArray(json.users) && json.users.length > 0;

  await recordRateLimitHit(supabase, { endpoint: ENDPOINT, userId: user.id });

  return NextResponse.json({ exists });
}
