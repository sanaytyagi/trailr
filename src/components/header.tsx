"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { TableIcon, MenuIcon, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
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
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    // Keep in sync with auth state changes (sign in / sign out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="flex h-16 w-full items-center justify-between px-6 lg:px-10">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
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

        {/* Desktop nav + auth — right side */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/tracker"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/tracker"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <TableIcon className="h-3.5 w-3.5" />
            Tracker
          </Link>

          {user ? (
            <>
              <span className="max-w-[180px] truncate text-sm font-bold text-primary">
                {user.user_metadata?.name || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium",
                  "text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                )}
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth?mode=login"
                className={cn(
                  "inline-flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  "text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                )}
              >
                Sign In
              </Link>
              <Link
                href="/auth?mode=signup"
                className={cn(
                  "inline-flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  "bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                )}
              >
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Open menu"
              >
                <MenuIcon className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" showClose>
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4 pt-4">
                <Link
                  href="/tracker"
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
                </Link>

                {user ? (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      handleSignOut();
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
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
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      Register
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
