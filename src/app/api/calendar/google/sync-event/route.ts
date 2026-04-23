import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";

const PROVIDER = "google_calendar";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json() as { college_id: string; college_name: string; deadline: string | null };
  const { college_id, college_name, deadline } = body;

  if (!college_id || !college_name) {
    return NextResponse.json({ error: "Missing college_id or college_name" }, { status: 400 });
  }

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
      return NextResponse.json({ ok: true, action: "deleted" });
    }

    if (existing?.event_id) {
      await updateCalendarEvent(accessToken, existing.event_id, college_name, deadline);
      return NextResponse.json({ ok: true, action: "updated" });
    }

    const eventId = await createCalendarEvent(accessToken, college_name, deadline);
    await db.from("calendar_events").insert({
      user_id: user.id,
      college_id,
      provider: PROVIDER,
      event_id: eventId,
    });
    return NextResponse.json({ ok: true, action: "created" });

  } catch (err) {
    console.error("sync-event error:", err);
    return NextResponse.json({ error: "Calendar sync failed" }, { status: 500 });
  }
}
