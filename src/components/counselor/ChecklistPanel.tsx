"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckSquare, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { getChecklistItems, toggleChecklistItem, upsertChecklistItems } from "@/lib/checklist";
import type { ChecklistItem } from "@/types/counselor";

const URGENCY_CONFIG = {
  now: { label: "Now", className: "bg-red-100 text-red-700" },
  this_summer: { label: "This Summer", className: "bg-yellow-100 text-yellow-700" },
  senior_year: { label: "Senior Year", className: "bg-blue-100 text-blue-700" },
};

interface ChecklistPanelProps {
  userId: string;
  newItems?: ChecklistItem[] | null;
}

export function ChecklistPanel({ userId, newItems }: ChecklistPanelProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const fetched = await getChecklistItems(userId);
    setItems(fetched);
  }, [userId]);

  // Initial load
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);


  // When AI returns new checklist items, upsert then refresh
  useEffect(() => {
    if (!newItems || newItems.length === 0) return;
    upsertChecklistItems(userId, newItems)
      .then(() => refresh())
      .catch((e) => console.error("[ChecklistPanel] persist failed:", e));
  }, [newItems, userId, refresh]);

  const handleToggle = async (item: ChecklistItem, checked: boolean) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completed: checked } : i))
    );
    await toggleChecklistItem(userId, item.id, checked);
  };

  const completed = items.filter((i) => i.completed).length;
  const total = items.length;

  // Group items by college
  const grouped = items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    if (!acc[item.college]) acc[item.college] = [];
    acc[item.college].push(item);
    return acc;
  }, {});

  return (
    <Card className="h-full rounded-none border-0 border-l flex flex-col">
      <CardHeader className="shrink-0 pb-3 px-4 pt-4 border-b">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <ListChecks className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold">Action Items</CardTitle>
        </div>
        {total > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completed} of {total} completed</span>
              <span>{Math.round((completed / total) * 100)}%</span>
            </div>
            <Progress value={(completed / total) * 100} className="h-1.5" />
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-3">
              <CheckSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No action items yet</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your action items will appear here after your first counselor evaluation
            </p>
          </div>
        ) : (
          <>
          <Accordion className="px-2 py-2">
            {Object.entries(grouped).map(([college, collegeItems]) => {
              const doneCount = collegeItems.filter((i) => i.completed).length;
              const pct = (doneCount / collegeItems.length) * 100;
              return (
                <AccordionItem key={college} value={college} className="rounded-md border border-border/60 mb-2 overflow-hidden">
                  <AccordionTrigger className="w-full py-2 px-3 hover:no-underline bg-muted/50 hover:bg-muted/70">
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="text-xs font-semibold truncate">{college}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground font-normal">
                          {doneCount}/{collegeItems.length}
                        </span>
                        <Progress value={pct} className="h-1 w-12" />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-1 pt-0.5">
                    <div className="px-1">
                      {collegeItems.map((item) => {
                        const urgency = URGENCY_CONFIG[item.urgency] ?? URGENCY_CONFIG.now;
                        return (
                          <div
                            key={item.id}
                            className="flex items-start gap-2.5 py-3 border-b border-border/50 last:border-b-0 transition-all duration-200"
                          >
                            <Checkbox
                              checked={item.completed}
                              onCheckedChange={(checked) => handleToggle(item, !!checked)}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium leading-snug", item.completed && "line-through text-muted-foreground")}>
                                {item.action}
                              </p>
                              <p className={cn("text-xs mt-0.5 leading-relaxed", item.completed ? "text-muted-foreground/60" : "text-muted-foreground")}>
                                {item.why}
                              </p>
                              <span className={cn("inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium transition-all duration-200", urgency.className, item.completed && "opacity-50")}>
                                {urgency.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  );
}
