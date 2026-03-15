import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("colleges")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "College not found" }, { status: 404 });
  }

  return NextResponse.json({ college: data });
}
