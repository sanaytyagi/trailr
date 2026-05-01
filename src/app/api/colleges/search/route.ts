import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SEARCH_MAX_RESULTS } from "@/lib/constants";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

const ENDPOINT = "colleges-search";
const WINDOW = 60 * 60;
const MAX = 120;

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (raw.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }
  const q = raw;

  const supabase = await createClient();
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
      "Too many college searches. Try again later."
    );
  }

  let query = supabase
    .from("colleges")
    .select("id, name, slug, location, acceptance_rate, website_url")
    .order("name")
    .limit(SEARCH_MAX_RESULTS);

  if (q.length > 0) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordRateLimitHit(supabase, { endpoint: ENDPOINT, userId: user.id });

  return NextResponse.json({ colleges: data ?? [] });
}
