"use client";

import { useState } from "react";

function getDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function getInitials(name: string): string {
  const skip = new Set(["of", "the", "and", "at", "in", "for", "a"]);
  return name
    .split(/\s+/)
    .filter((w) => !skip.has(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Ordered list of logo URL builders to try in sequence. */
function buildSources(domain: string): string[] {
  return [
    // Google's high-quality favicon API (used by Chrome new tab page)
    `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=64`,
    // Google S2 favicon fallback
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  ];
}

interface CollegeLogoProps {
  name: string;
  website_url: string | null;
  logo_url?: string | null;
  /** Outer container size in px. Default 32. */
  size?: number;
}

export function CollegeLogo({
  name,
  website_url,
  size = 36,
}: CollegeLogoProps) {
  const domain = getDomain(website_url);
  const sources = domain ? buildSources(domain) : [];

  const [srcIndex, setSrcIndex] = useState(0);
  const initials = getInitials(name);
  // Inner image is constrained to this max dimension, with 6px padding on each side
  const maxImgSize = size - 12;

  const currentSrc = sources[srcIndex] ?? null;

  return (
    <div
      className="shrink-0 rounded-lg border border-border/50 bg-white dark:bg-background flex items-center justify-center shadow-sm"
      style={{ width: size, height: size, padding: 6 }}
    >
      {currentSrc ? (
        // Plain <img> intentionally — university domains are unpredictable,
        // so Next.js Image remote patterns would need a wildcard allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentSrc}
          alt={`${name} logo`}
          className="block"
          style={{
            maxWidth: maxImgSize,
            maxHeight: maxImgSize,
            width: "auto",
            height: "auto",
            objectFit: "contain",
          }}
          onError={() => setSrcIndex((i) => i + 1)}
        />
      ) : (
        <span
          className="font-semibold text-muted-foreground/70 select-none leading-none"
          style={{ fontSize: Math.max(8, Math.floor(maxImgSize * 0.42)) }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
