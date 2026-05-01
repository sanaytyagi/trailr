import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";
import { parseJsonBody } from "@/lib/parse-json-body";
import { syncEventSchema } from "@/lib/schemas/sync-event";
import {
  checkRateLimit,
  recordRateLimitHit,
  rateLimitedResponse,
} from "@/lib/rate-limit";

const PROVIDER = "google_calendar";
const ENDPOINT = "calendar-sync-event";
const WINDOW = 60 * 60;
const MAX = 60;

export async function POST(req: NextRequest) {
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

  const parsed = await parseJsonBody(req, 4 * 1024);
  if (!parsed.ok) return parsed.response;

  const validation = syncEventSchema.safeParse(parsed.data);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }
  const { college_id, college_name, deadline } = validation.data;

  const accessToken = await getValidAccessToken(user.id);
  if (!accessToken) {
    // Token revoked — tell the frontend to show reconnect toast
    return NextResponse.json({ disconnected: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: existing } = await db
    .from("calendar_events")
    .select("event_id")
    .eq("user_id", user.id)
    .eq("college_id", college_id)
    .eq("provider", PROVIDER)
    .maybeSingle();

  try {
    if (!deadline) {
      // Clear deadline — delete the event if it exists
      if (existing?.event_id) {
        await deleteCalendarEvent(accessToken, existing.event_id);
        await db.from("calendar_events").delete()
          .eq("user_id", user.id).eq("college_id", college_id).eq("provider", PROVIDER);
      }
      await recordRateLimitHit(supabase, { endpoint: ENDPOINT, userId: user.id });
      return NextResponse.json({ ok: true, action: "deleted" });
    }

    if (existing?.event_id) {
      await updateCalendarEvent(accessToken, existing.event_id, college_name, deadline);
      await recordRateLimitHit(supabase, { endpoint: ENDPOINT, userId: user.id });
      return NextResponse.json({ ok: true, action: "updated" });
    }

    const eventId = await createCalendarEvent(accessToken, college_name, deadline);
    await db.from("calendar_events").insert({
      user_id: user.id,
      college_id,
      provider: PROVIDER,
      event_id: eventId,
    });
    await recordRateLimitHit(supabase, { endpoint: ENDPOINT, userId: user.id });
    return NextResponse.json({ ok: true, action: "created" });

  } catch (err) {
    console.error("sync-event error:", err);
    return NextResponse.json({ error: "Calendar sync failed" }, { status: 500 });
  }
}
