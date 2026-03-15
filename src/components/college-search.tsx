"use client";

import { useRef, useState } from "react";
import { Search, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAcceptanceRate } from "@/lib/utils";
import { useColleges } from "@/hooks/use-colleges";
import type { College, SearchResult } from "@/types";

interface CollegeSearchProps {
  onAdd: (college: College) => void;
  isTracked: (id: string) => boolean;
}

export function CollegeSearch({ onAdd, isTracked }: CollegeSearchProps) {
  const { query, setQuery, results, isLoading } = useColleges();
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const showDropdown = isOpen;

  const handleSelect = (result: SearchResult) => {
    if (isTracked(result.id)) return;
    fetch(`/api/colleges/${result.slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.college) {
          onAdd(data.college);
          setQuery("");
          setIsOpen(false);
          inputRef.current?.blur();
        }
      })
      .catch(() => {
        onAdd(result as College);
        setQuery("");
        setIsOpen(false);
      });
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-label="Search for a college to track"
          aria-autocomplete="list"
          placeholder="Search for a college to track..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setIsOpen(false); inputRef.current?.blur(); }
          }}
          className={cn(
            "h-11 w-full rounded-xl border border-border bg-card pl-9 pr-4",
            "text-sm placeholder:text-muted-foreground text-foreground",
            "outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "transition-shadow"
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (results.length > 0 || (query.length >= 2 && !isLoading)) && (
        <div
          role="listbox"
          aria-label="College search results"
          className={cn(
            "absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-md",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          {results.length === 0 && !isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No colleges found. Try a different search.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((result) => {
                const tracked = isTracked(result.id);
                return (
                  <li key={result.id} role="option" aria-selected={tracked}>
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        tracked ? "cursor-default opacity-50" : "hover:bg-muted cursor-pointer"
                      )}
                      onClick={() => handleSelect(result)}
                      disabled={tracked}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{result.name}</p>
                        {result.location && (
                          <p className="text-xs text-muted-foreground">
                            {result.location}
                            {result.acceptance_rate !== null && (
                              <span className="ml-2 font-mono">
                                {formatAcceptanceRate(result.acceptance_rate)} acceptance
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      {tracked && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Already tracked" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
