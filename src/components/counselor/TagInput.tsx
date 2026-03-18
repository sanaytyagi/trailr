"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  max: number;
}

export function TagInput({ tags, onChange, placeholder, max }: TagInputProps) {
  const [value, setValue] = useState("");
  const atMax = tags.length >= max;

  function addTag(raw: string) {
    const trimmed = raw.replace(/,+$/, "").trim();
    if (!trimmed) return;
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    if (tags.length >= max) return;
    onChange([...tags, trimmed]);
    setValue("");
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(value);
    } else if (e.key === "Backspace" && value === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (v.endsWith(",")) {
      addTag(v);
    } else {
      setValue(v);
    }
  }

  return (
    <div className="w-full">
      <div
        className={cn(
          "min-h-[48px] w-full rounded-xl border border-input bg-muted/50 px-3 py-2",
          "focus-within:ring-2 focus-within:ring-primary/20 transition-all"
        )}
      >
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="ml-0.5 rounded-full hover:bg-primary/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {!atMax && (
            <input
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={tags.length === 0 ? placeholder : ""}
              className="flex-1 min-w-[140px] bg-transparent text-sm placeholder:text-muted-foreground outline-none py-0.5"
            />
          )}
        </div>
      </div>
      {atMax && (
        <p className="text-xs text-muted-foreground mt-1.5">Max {max} reached</p>
      )}
    </div>
  );
}
