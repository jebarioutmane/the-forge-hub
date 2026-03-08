import { supabase } from "@/integrations/supabase/client";

export async function logAction(
  sectionName: string,
  action: "INSERT" | "UPDATE" | "DELETE",
  recordId: string,
  oldData: Record<string, any> | null,
  newData: Record<string, any> | null,
  changedByName: string
) {
  const { error } = await supabase.from("history_logs").insert({
    section_name: sectionName,
    action,
    record_id: recordId,
    old_data: oldData,
    new_data: newData,
    changed_by_name: changedByName,
  });
  if (error) console.error("Failed to log action:", error.message);
}
