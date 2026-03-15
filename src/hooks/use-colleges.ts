"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { SearchResult } from "@/types";
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_CHARS } from "@/lib/constants";


export function useColleges() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < SEARCH_MIN_CHARS) {
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/colleges/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.colleges ?? []);
    } catch {
      toast.error("Failed to search colleges. Please try again.");
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const results = query.length < SEARCH_MIN_CHARS ? [] : searchResults;

  return { query, setQuery, results, isLoading };
}
