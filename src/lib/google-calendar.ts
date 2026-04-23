import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

const PROVIDER = "google_calendar";

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
  );
}

export function buildAuthUrl(state: string): string {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state,
  });
}

export async function exchangeCode(code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function revokeToken(accessToken: string) {
  const client = oauthClient();
  try {
    await client.revokeToken(accessToken);
  } catch {
    // Best-effort — always delete local tokens even if revocation fails
  }
}

/**
 * Returns a valid access token for the user, refreshing if expired.
 * Returns null if the refresh token has been revoked (caller should disconnect).
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;

  const { data: integration, error } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .eq("provider", PROVIDER)
    .single();

  if (error || !integration) return null;

  // Token still valid
  if (new Date(integration.token_expiry) > new Date()) {
    return integration.access_token as string;
  }

  // Refresh
  const client = oauthClient();
  client.setCredentials({ refresh_token: integration.refresh_token });

  try {
    const { credentials } = await client.refreshAccessToken();
    const newExpiry = new Date(Date.now() + (credentials.expiry_date ?? 3600 * 1000));

    await supabase
      .from("user_integrations")
      .update({
        access_token: credentials.access_token,
        token_expiry: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", PROVIDER);

    return credentials.access_token as string;
  } catch {
    // Refresh token revoked — clean up
    await supabase
      .from("user_integrations")
      .delete()
      .eq("user_id", userId)
      .eq("provider", PROVIDER);
    await supabase
      .from("calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("provider", PROVIDER);
    return null;
  }
}

function buildCalendarEvent(collegeName: string, deadline: string) {
  return {
    summary: `${collegeName} — Application Deadline`,
    description: "College application deadline tracked via Trailr.",
    start: { date: deadline },   // all-day event (date only, no time)
    end: { date: deadline },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 7 * 24 * 60 },   // 1 week before
        { method: "popup", minutes: 24 * 60 },         // 1 day before
      ],
    },
  };
}

export async function createCalendarEvent(
  accessToken: string,
  collegeName: string,
  deadline: string,
): Promise<string> {
  const client = oauthClient();
  client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: client });

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: buildCalendarEvent(collegeName, deadline),
  });

  return res.data.id!;
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  collegeName: string,
  deadline: string,
): Promise<void> {
  const client = oauthClient();
  client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: client });

  await calendar.events.update({
    calendarId: "primary",
    eventId,
    requestBody: buildCalendarEvent(collegeName, deadline),
  });
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  const client = oauthClient();
  client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: client });

  await calendar.events.delete({ calendarId: "primary", eventId });
}
