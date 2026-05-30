import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="flex w-full items-center justify-between px-6 lg:px-10 py-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/transparent_logo.png" alt="Trailr logo" className="h-12 w-auto" />
          <div className="flex flex-col">
            <span className="text-xl font-bold text-foreground leading-tight">Trailr</span>
            <span className="text-xs text-muted-foreground">© {new Date().getFullYear()}</span>
          </div>
        </div>
        <nav className="flex items-center gap-6">
          <a
            href="mailto:sanaytyagi@gmail.com?subject=Feedback for Trailr"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Send Feedback
          </a>
          <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms and Conditions</Link>
          <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
        </nav>
      </div>
    </footer>
  );
}
