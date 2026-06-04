import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasFullQuiz } from "@/lib/assistant/profile";

export async function proxy(request: NextRequest) {
  // We need to mutate the response to forward refreshed auth cookies.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: use getUser() not getSession() — getUser() validates the JWT
  // server-side and cannot be spoofed by a forged cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect authenticated app routes — unauthenticated users go to /auth.
  const PROTECTED = ["/tracker", "/settings", "/essays", "/list-builder", "/assistant"];
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("mode", "login");
    return NextResponse.redirect(url);
  }

  // Redirect already-signed-in users away from /auth.
  if (user && pathname === "/auth") {
    const url = request.nextUrl.clone();
    url.pathname = "/tracker";
    return NextResponse.redirect(url);
  }

  // Core-profile gate: a student without a core_profile must complete the
  // onboarding core step first, so every AI surface has data to personalize from.
  // Centralized here (matches the auth gate above).
  //
  // Loop-safety: this only fires on PROTECTED paths. /onboarding is NOT in
  // PROTECTED and NOT in the matcher below, so redirecting there cannot
  // re-trigger this middleware. Counselors have no core_profile and are skipped
  // by the role check. After the student saves their core profile, the next
  // navigation reads the fresh value and passes through.
  if (user && isProtected) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role, core_profile")
      .eq("id", user.id)
      .maybeSingle();

    if (prof && prof.role === "student" && !prof.core_profile) {
      // A student who already completed the full List Builder quiz has their
      // state/gpa/major in user_lists.colleges.quiz_answers — don't force them
      // through the onboarding core step. Migration 013 backfills core_profile
      // for these accounts; this is the self-healing belt for any that slip
      // through. The extra query only runs while core_profile is null.
      const { data: listRow } = await supabase
        .from("user_lists")
        .select("colleges")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!hasFullQuiz(listRow?.colleges)) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/tracker/:path*",
    "/settings/:path*",
    "/essays/:path*",
    "/list-builder/:path*",
    "/assistant/:path*",
    "/auth",
  ],
};
