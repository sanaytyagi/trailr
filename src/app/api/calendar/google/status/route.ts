import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ connected: false });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("user_integrations")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "google_calendar")
    .maybeSingle();

  return NextResponse.json({ connected: !!data });
}
