import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

const ENDPOINT = "colleges-slug";
const WINDOW = 60 * 60;
const MAX = 240;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (typeof slug !== "string" || slug.length > 200) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

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
    return rateLimitedResponse(limit);
  }

  const { data, error } = await supabase
    .from("colleges")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "College not found" }, { status: 404 });
  }

  await recordRateLimitHit(supabase, { endpoint: ENDPOINT, userId: user.id });

  return NextResponse.json({ college: data });
}
