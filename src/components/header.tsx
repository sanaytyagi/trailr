"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { TableIcon, MenuIcon, LogOut, Settings, ChevronDown, Users, CalendarDays, BookText, ListTree, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useProfile } from "@/hooks/use-profile";
import { useCounselorNotifications } from "@/hooks/use-counselor-notifications";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [supabase] = useState(() => createClient());
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { profile, loading: profileLoading } = useProfile();
  const isCounselor = !profileLoading && !!user && profile?.role === "counselor";
  const { count: unreadCount } = useCounselorNotifications(profile ?? null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
      } else {
        setUser(session?.user ?? null);
      }
    });
    // If the stored token is already invalid on mount, clear it silently
    supabase.auth.getSession().then(({ error }) => {
      if (error?.message?.toLowerCase().includes("refresh token")) {
        supabase.auth.signOut();
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const userInitial = ((user?.user_metadata?.name || user?.email || "U") as string)[0].toUpperCase();
  const userDisplayName = user?.user_metadata?.name || user?.email || "";

const navHref = (path: string) => user ? path : "/auth?mode=signup";
  const authHref = (path: string) => user ? path : "/auth?mode=login";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="flex h-16 w-full items-center justify-between">
        {/* Logo */}
        <Link href={user ? "/tracker" : "/"} className="flex items-center gap-2.5 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/transparent_logo.png"
            alt="Trailr logo"
            className="h-14 w-auto transition-opacity group-hover:opacity-85"
          />
          <span className="text-2xl font-bold tracking-tight text-foreground">
            Trailr
          </span>
        </Link>

        {/* Desktop nav — right side */}
        <div className="hidden md:flex items-center gap-2 pr-4">
          {isCounselor ? (
            <>
              <Link
                href="/counselor"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === "/counselor" || pathname.startsWith("/counselor/")
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Users className="h-3.5 w-3.5" />
                My Students
              </Link>
              <Link
                href="/counselor/deadlines"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === "/counselor/deadlines"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Deadlines
              </Link>
            </>
          ) : (
            <>
              <Link
                href={navHref("/tracker")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === "/tracker"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <TableIcon className="h-3.5 w-3.5" />
                Tracker
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground min-w-[16px]">
                    {unreadCount > 5 ? "5+" : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                href={navHref("/essays")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === "/essays" || pathname.startsWith("/essays/")
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <BookText className="h-3.5 w-3.5" />
                Essays
              </Link>

              <Link
                href={navHref("/list-builder")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === "/list-builder"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <ListTree className="h-3.5 w-3.5" />
                List Builder
              </Link>

              <Link
                href={navHref("/assistant")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === "/assistant"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Assistant
              </Link>
            </>
          )}

          {user ? (
            /* ── Authenticated: compact avatar dropdown ── */
            <div ref={userMenuRef} className="relative ml-1">
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold select-none">
                  {userInitial}
                </div>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-150", userMenuOpen && "rotate-180")} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border bg-card shadow-md overflow-hidden z-50">
                  <div className="px-3 py-2.5 border-b border-border">
                    <p className="text-sm text-primary truncate">{userDisplayName}</p>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                      pathname === "/settings"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Settings
                  </Link>
                  <button
                    onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── Unauthenticated: Sign In + Get Started ── */
            <>
              <Link
                href="/auth?mode=login"
                className={cn(
                  "inline-flex items-center rounded-md px-3 py-2.5 text-sm font-medium",
                  "text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                )}
              >
                Sign In
              </Link>
              <Link
                href="/auth?mode=signup"
                className={cn(
                  "inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold",
                  "bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                )}
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="md:hidden pr-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Open menu"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" showClose>
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4 pt-4">
                {isCounselor ? (
                  <>
                    <Link
                      href="/counselor"
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        pathname === "/counselor" || pathname.startsWith("/counselor/")
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Users className="h-4 w-4" />
                      My Students
                    </Link>
                    <Link
                      href="/counselor/deadlines"
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        pathname === "/counselor/deadlines"
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <CalendarDays className="h-4 w-4" />
                      Deadlines
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={navHref("/tracker")}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        pathname === "/tracker"
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <TableIcon className="h-4 w-4" />
                      Tracker
                      {unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground min-w-[16px] ml-auto">
                          {unreadCount > 5 ? "5+" : unreadCount}
                        </span>
                      )}
                    </Link>

                    <Link
                      href={navHref("/essays")}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        pathname === "/essays" || pathname.startsWith("/essays/")
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <BookText className="h-4 w-4" />
                      Essays
                    </Link>

                    <Link
                      href={navHref("/list-builder")}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        pathname === "/list-builder"
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <ListTree className="h-4 w-4" />
                      List Builder
                    </Link>

                    <Link
                      href={navHref("/assistant")}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        pathname === "/assistant"
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Sparkles className="h-4 w-4" />
                      Assistant
                    </Link>
                  </>
                )}

                {user ? (
                  <>
                    <div className="px-3 py-2 text-sm font-medium text-foreground truncate">{userDisplayName}</div>
                    <Link
                      href="/settings"
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        pathname === "/settings"
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <button
                      onClick={() => { setMobileOpen(false); handleSignOut(); }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth?mode=login"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/auth?mode=signup"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
