import { z } from "zod";

const citedItem = z.object({
  title: z.string().min(2),
  detail: z.string().min(10),
  url: z.string().url(),
});

export const citedItemSchema = citedItem;
export const followupItemsSchema = z.array(citedItem).min(1).max(8);

export const dossierSchema = z.object({
  fit_summary: z.string().min(40),
  programs: z.array(citedItem).min(1).max(5),
  faculty: z.array(citedItem).max(3),
  communities: z.array(citedItem).max(5),
  traditions: z.array(citedItem).max(3),
  news: z
    .array(
      citedItem.extend({
        date: z.string().optional(),
      })
    )
    .max(3),
});

export type Dossier = z.infer<typeof dossierSchema>;
export type CitedItem = z.infer<typeof citedItem>;

export const BANNED_GENERIC_PHRASES = [
  "rigorous academics",
  "world-class faculty",
  "diverse community",
  "strong alumni network",
  "vibrant campus",
  "well-rounded students",
  "top-tier",
  "cutting-edge research",
  "state-of-the-art facilities",
  "rich history",
  "innovative curriculum",
  "holistic approach",
  "global perspective",
  "passionate students",
  "dedicated faculty",
];

export function detectGenericPhrases(dossier: Dossier): string[] {
  const haystack = JSON.stringify(dossier).toLowerCase();
  return BANNED_GENERIC_PHRASES.filter((phrase) =>
    haystack.includes(phrase.toLowerCase())
  );
}

export function extractSources(dossier: Dossier): string[] {
  const urls = new Set<string>();
  const collect = (items: { url: string }[]) =>
    items.forEach((i) => urls.add(i.url));
  collect(dossier.programs);
  collect(dossier.faculty);
  collect(dossier.communities);
  collect(dossier.traditions);
  collect(dossier.news);
  return Array.from(urls);
}

export function validateDomainAllowlist(
  url: string,
  collegeDomain: string | null
): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith(".edu")) return true;
    if (collegeDomain && host.includes(collegeDomain.toLowerCase())) return true;
    const mediaAllowlist = [
      "nytimes.com",
      "washingtonpost.com",
      "usnews.com",
      "forbes.com",
      "bloomberg.com",
      "chronicle.com",
      "insidehighered.com",
      "reuters.com",
      "apnews.com",
      "wsj.com",
    ];
    return mediaAllowlist.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}
