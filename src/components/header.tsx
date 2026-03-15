"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap, ChevronDown, TableIcon, CalendarIcon, MenuIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const tools = [
  { label: "Tracker", href: "/tracker", icon: TableIcon, description: "Track your college list" },
  { label: "Calendar", href: "/calendar", icon: CalendarIcon, description: "View key dates" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="flex h-16 w-full items-center justify-between px-6 lg:px-10">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity group-hover:opacity-85">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">
            CollegeTrackr
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-base font-medium transition-colors",
                "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Tools
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              {tools.map((tool) => (
                <DropdownMenuItem
                  key={tool.href}
                  onClick={() => router.push(tool.href)}
                >
                  <tool.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{tool.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

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
                <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tools
                </p>
                {tools.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <tool.icon className="h-4 w-4" />
                    {tool.label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
