import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/google-calendar";

const PROVIDER = "google_calendar";
const SETTINGS_URL = "/settings?calendar=";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(new URL(`${SETTINGS_URL}denied`, req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL(`${SETTINGS_URL}error`, req.url));
  }

  // Verify CSRF state cookie
  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL(`${SETTINGS_URL}error`, req.url));
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.redirect(new URL(`${SETTINGS_URL}error`, req.url));
  }

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch {
    return NextResponse.redirect(new URL(`${SETTINGS_URL}error`, req.url));
  }

  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.redirect(new URL(`${SETTINGS_URL}error`, req.url));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  await db.from("user_integrations").upsert({
    user_id: user.id,
    provider: PROVIDER,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" });

  // Kick off sync-all in the background (fire and forget)
  fetch(new URL("/api/calendar/google/sync-all", req.url).toString(), {
    method: "POST",
    headers: { cookie: req.headers.get("cookie") ?? "" },
  }).catch(() => {});

  return NextResponse.redirect(new URL(`${SETTINGS_URL}connected`, req.url));
}
