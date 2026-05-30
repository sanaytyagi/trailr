"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function ResetCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // PKCE flow: code in search params
    const code = new URL(window.location.href).searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          router.replace("/auth?error=invalid_link");
        } else {
          router.replace("/auth/update-password");
        }
      });
      return;
    }

    // Implicit flow: token in hash — listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/auth/update-password");
      } else if (event === "SIGNED_IN") {
        // Signed in via hash token but not a recovery — shouldn't happen, but guard it
        router.replace("/auth/update-password");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
