import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, createCalendarEvent } from "@/lib/google-calendar";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

const PROVIDER = "google_calendar";
const ENDPOINT = "calendar-sync-all";
const WINDOW = 60 * 60;
const MAX = 20;

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limit = await checkRateLimit(supabase, {
    endpoint: ENDPOINT,
    userId: user.id,
    windowSeconds: WINDOW,
    max: MAX,
  });
  if (!limit.ok) return rateLimitedResponse(limit);

  const accessToken = await getValidAccessToken(user.id);
  if (!accessToken) {
    return NextResponse.json({ disconnected: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Fetch all colleges with a personal_deadline set
  const { data: userColleges } = await db
    .from("user_colleges")
    .select("college_id, personal_deadline, colleges(name)")
    .eq("user_id", user.id)
    .not("personal_deadline", "is", null);

  if (!userColleges?.length) {
    await recordRateLimitHit(supabase, { endpoint: ENDPOINT, userId: user.id });
    return NextResponse.json({ ok: true, created: 0 });
  }

  // Fetch which ones already have events (from a prior connect)
  const { data: existingEvents } = await db
    .from("calendar_events")
    .select("college_id")
    .eq("user_id", user.id)
    .eq("provider", PROVIDER);

  const alreadySynced = new Set((existingEvents ?? []).map((e: { college_id: string }) => e.college_id));

  const toSync = (userColleges as Array<{ college_id: string; personal_deadline: string; colleges: { name: string } }>)
    .filter((uc) => !alreadySynced.has(uc.college_id) && uc.personal_deadline);

  // Parallel create — don't block on each one sequentially
  const results = await Promise.allSettled(
    toSync.map(async (uc) => {
      const eventId = await createCalendarEvent(accessToken, uc.colleges.name, uc.personal_deadline);
      await db.from("calendar_events").insert({
        user_id: user.id,
        college_id: uc.college_id,
        provider: PROVIDER,
        event_id: eventId,
      });
    })
  );

  const created = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  if (failed > 0) {
    console.error(`sync-all: ${failed} of ${toSync.length} events failed to create`);
  }

  await recordRateLimitHit(supabase, { endpoint: ENDPOINT, userId: user.id });

  return NextResponse.json({ ok: true, created });
}
