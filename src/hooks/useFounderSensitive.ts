import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FounderSensitive {
  founder_id: string;
  rib_number: string | null;
  cin_number: string | null;
  passport_number: string | null;
}

/**
 * Sensitive founder identifiers live in the internal-only `founder_sensitive`
 * table (RLS restricted), not on `founders`.
 */
export function useFounderSensitiveMap(enabled = true) {
  return useQuery({
    queryKey: ["founder_sensitive"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_sensitive")
        .select("founder_id, rib_number, cin_number, passport_number");
      // Roles without access get a permission error — degrade to empty map.
      if (error) return new Map<string, FounderSensitive>();
      const map = new Map<string, FounderSensitive>();
      (data || []).forEach((r) => map.set(r.founder_id, r as FounderSensitive));
      return map;
    },
  });
}

export function useFounderSensitiveOne(founderId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["founder_sensitive", founderId],
    enabled: !!founderId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_sensitive")
        .select("founder_id, rib_number, cin_number, passport_number")
        .eq("founder_id", founderId as string)
        .maybeSingle();
      if (error) return null;
      return (data as FounderSensitive) ?? null;
    },
  });
}

export async function upsertFounderSensitive(
  founderId: string,
  values: { rib_number?: string | null; cin_number?: string | null; passport_number?: string | null }
) {
  const { error } = await supabase.from("founder_sensitive").upsert(
    {
      founder_id: founderId,
      ...values,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "founder_id" }
  );
  if (error) throw error;
}

export function useInvalidateFounderSensitive() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["founder_sensitive"] });
}
