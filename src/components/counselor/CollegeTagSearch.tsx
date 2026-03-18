"use client";

import { useRef, useState } from "react";
import { Search, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useColleges } from "@/hooks/use-colleges";

interface CollegeTagSearchProps {
  colleges: string[];
  onChange: (colleges: string[]) => void;
  max?: number;
}

export function CollegeTagSearch({ colleges, onChange, max = 15 }: CollegeTagSearchProps) {
  const { query, setQuery, results, isLoading } = useColleges();
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdded = (name: string) =>
    colleges.some((c) => c.toLowerCase() === name.toLowerCase());

  function handleSelect(name: string) {
    if (isAdded(name) || colleges.length >= max) return;
    onChange([...colleges, name]);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleRemove(name: string) {
    onChange(colleges.filter((c) => c !== name));
  }

  const atMax = colleges.length >= max;

  return (
    <div className="w-full space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder={atMax ? `Max ${max} colleges reached` : "Search for a college..."}
          value={query}
          disabled={atMax}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Escape") setIsOpen(false); }}
          className={cn(
            "h-11 w-full rounded-xl border border-border bg-card pl-9 pr-4",
            "text-sm placeholder:text-muted-foreground text-foreground",
            "outline-none focus:border-border transition-colors",
            atMax && "opacity-50 cursor-not-allowed"
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}

        {/* Dropdown */}
        {isOpen && !atMax && (results.length > 0 || (query.length >= 2 && !isLoading)) && (
          <div className={cn(
            "absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-md",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}>
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No colleges found. Try a different search.
              </div>
            ) : (
              <ul className="max-h-60 overflow-y-auto py-1">
                {results.map((result) => {
                  const added = isAdded(result.name);
                  return (
                    <li key={result.id}>
                      <button
                        disabled={added}
                        onClick={() => handleSelect(result.name)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          added ? "opacity-40 cursor-default" : "hover:bg-muted cursor-pointer"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{result.name}</p>
                          {result.location && (
                            <p className="text-xs text-muted-foreground">{result.location}</p>
                          )}
                        </div>
                        {added && <span className="text-xs text-muted-foreground shrink-0">Added</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Added colleges list */}
      {colleges.length > 0 && (
        <ul className="space-y-1.5">
          {colleges.map((name) => (
            <li
              key={name}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className="text-sm font-medium text-foreground truncate">{name}</span>
              <button
                onClick={() => handleRemove(name)}
                className="ml-3 shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                aria-label={`Remove ${name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
