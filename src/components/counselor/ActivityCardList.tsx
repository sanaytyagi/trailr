"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivityCard {
  title: string;
  description: string;
}

interface ActivityCardListProps {
  cards: ActivityCard[];
  onChange: (cards: ActivityCard[]) => void;
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  addLabel: string;
  max: number;
}

export function ActivityCardList({
  cards,
  onChange,
  titlePlaceholder,
  descriptionPlaceholder,
  addLabel,
  max,
}: ActivityCardListProps) {
  function update(index: number, field: keyof ActivityCard, value: string) {
    const next = cards.map((c, i) => (i === index ? { ...c, [field]: value } : c));
    onChange(next);
  }

  function remove(index: number) {
    onChange(cards.filter((_, i) => i !== index));
  }

  function add() {
    if (cards.length >= max) return;
    onChange([...cards, { title: "", description: "" }]);
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.map((card, i) => (
        <div key={i} className="flex items-start gap-2 group">
        <div className="flex-1 rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
          <input
            type="text"
            placeholder={titlePlaceholder}
            value={card.title}
            onChange={(e) => update(i, "title", e.target.value)}
            className={cn(
              "w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm font-medium",
              "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            )}
          />
          <textarea
            placeholder={descriptionPlaceholder}
            value={card.description}
            onChange={(e) => update(i, "description", e.target.value)}
            rows={2}
            className={cn(
              "w-full resize-none rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm",
              "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all leading-relaxed"
            )}
          />
        </div>

        {cards.length > 1 && (
          <button
            type="button"
            onClick={() => remove(i)}
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      ))}

      {cards.length < max && (
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      )}

      {cards.length >= max && (
        <p className="text-xs text-muted-foreground">Max {max} entries reached</p>
      )}
    </div>
  );
}
