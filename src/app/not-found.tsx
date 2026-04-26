import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">404</p>
      <h1 className="text-3xl font-bold text-foreground mb-3 tracking-tight">
        Page not found
      </h1>
      <p className="max-w-sm text-muted-foreground mb-8 leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>
    </main>
  );
}
