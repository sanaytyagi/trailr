import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeToken, getValidAccessToken, deleteCalendarEvent } from "@/lib/google-calendar";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

const PROVIDER = "google_calendar";
const ENDPOINT = "calendar-disconnect";
const WINDOW = 60 * 60;
const MAX = 10;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: integration } = await db
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", user.id)
    .eq("provider", PROVIDER)
    .maybeSingle();

  // Delete all Google Calendar events before revoking the token
  const accessToken = await getValidAccessToken(user.id);
  if (accessToken) {
    const { data: events } = await db
      .from("calendar_events")
      .select("event_id")
      .eq("user_id", user.id)
      .eq("provider", PROVIDER);

    if (events?.length) {
      await Promise.allSettled(
        (events as Array<{ event_id: string }>).map((e) =>
          deleteCalendarEvent(accessToken, e.event_id)
        )
      );
    }
  }

  if (integration?.access_token) {
    await revokeToken(integration.access_token);
  }

  await Promise.all([
    db.from("user_integrations").delete().eq("user_id", user.id).eq("provider", PROVIDER),
    db.from("calendar_events").delete().eq("user_id", user.id).eq("provider", PROVIDER),
  ]);

  await recordRateLimitHit(supabase, { endpoint: ENDPOINT, userId: user.id });

  return NextResponse.json({ ok: true });
}
