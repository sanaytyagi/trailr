import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeToken } from "@/lib/google-calendar";

const PROVIDER = "google_calendar";

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: integration } = await db
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", user.id)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (integration?.access_token) {
    await revokeToken(integration.access_token);
  }

  await Promise.all([
    db.from("user_integrations").delete().eq("user_id", user.id).eq("provider", PROVIDER),
    db.from("calendar_events").delete().eq("user_id", user.id).eq("provider", PROVIDER),
  ]);

  return NextResponse.json({ ok: true });
}
