import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SEARCH_MAX_RESULTS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("q") ?? "").trim();

  // Reject queries that are unreasonably long (guards against abuse).
  if (raw.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const q = raw;

  const supabase = await createClient();

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

  return NextResponse.json({ colleges: data ?? [] });
}
