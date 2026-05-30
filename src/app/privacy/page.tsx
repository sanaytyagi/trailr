"use client";

import { useEffect, useRef } from "react";
import Footer from "@/components/footer";

export default function PrivacyPage() {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (divRef.current) {
      divRef.current.setAttribute("name", "termly-embed");
    }

    const existing = document.getElementById("termly-jssdk");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = "termly-jssdk";
    script.src = "https://app.termly.io/embed-policy.min.js";
    document.body.appendChild(script);

    return () => {
      document.getElementById("termly-jssdk")?.remove();
    };
  }, []);

  return (
    <>
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-24">
          <div ref={divRef} data-id="920f70a4-9ed1-4a5d-9a6b-0fdf46c15a52" />
        </div>
      </main>
      <Footer />
    </>
  );
}
