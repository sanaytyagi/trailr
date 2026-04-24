import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SignInRequired({
  title = "Sign In Required",
  description,
  mode = "login",
}: {
  title?: string;
  description: string;
  mode?: "login" | "signup";
}) {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
      <p className="max-w-sm text-muted-foreground mb-6">{description}</p>
      <Link href={`/auth?mode=${mode}`}>
        <Button>Sign In</Button>
      </Link>
    </main>
  );
}
