import { createClient } from "@/lib/supabase/client";
import type { ChecklistItem } from "@/types/counselor";

export async function upsertChecklistItems(userId: string, items: ChecklistItem[]) {
  if (items.length === 0) return;
  const supabase = createClient();
  const rows = items.map((item) => ({
    user_id: userId,
    college: item.college,
    action_id: item.id,
    action: item.action,
    why: item.why,
    urgency: item.urgency,
    completed: false,
  }));
  const { error } = await supabase
    .from("checklist_items")
    .upsert(rows, { onConflict: "user_id,action_id", ignoreDuplicates: true });
  if (error) console.error("[checklist] upsert error:", error.code, error.message);
}

export async function getChecklistItems(userId: string): Promise<ChecklistItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((row) => ({
    id: row.action_id,
    college: row.college,
    action: row.action,
    why: row.why,
    urgency: row.urgency as ChecklistItem["urgency"],
    completed: row.completed,
  }));
}

export async function toggleChecklistItem(userId: string, actionId: string, completed: boolean) {
  const supabase = createClient();
  await supabase
    .from("checklist_items")
    .update({ completed })
    .eq("user_id", userId)
    .eq("action_id", actionId);
}
