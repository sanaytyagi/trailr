import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  if (!user && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
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
