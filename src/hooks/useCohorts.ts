import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_COHORT_START_MONTH,
  DEFAULT_COHORT_END_MONTH,
  computeActiveCohort,
  buildVisibleCohorts,
  parseCohort,
} from "@/lib/cohortYears";

export interface CohortRow {
  id: string;
  label: string;
  year: number;
  start_date: string | null;
  end_date: string | null;
  is_archived: boolean;
}

interface UseCohortsResult {
  all: CohortRow[];
  visible: string[];      // 5 labels: prev2, current, next2 (newest-first)
  active: string;         // stored label e.g. "2025-2026"
  startMonth: number;
  endMonth: number;
  isLoading: boolean;
}

export function useCohorts(): UseCohortsResult {
  const { data: settings } = useQuery({
    queryKey: ["app_settings", "cohort"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("key,value")
        .in("key", ["cohort_start_month", "cohort_end_month"]);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const v = typeof r.value === "number" ? r.value : Number(r.value);
        if (!Number.isNaN(v)) map[r.key] = v;
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const startMonth = settings?.cohort_start_month ?? DEFAULT_COHORT_START_MONTH;
  const endMonth = settings?.cohort_end_month ?? DEFAULT_COHORT_END_MONTH;

  const { data: cohorts, isLoading } = useQuery({
    queryKey: ["cohorts-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohorts")
        .select("id,label,year,start_date,end_date,is_archived" as any)
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CohortRow[];
    },
    staleTime: 60 * 1000,
  });

  const active = computeActiveCohort(startMonth);

  // Visible window = prev2..next2 (newest first). If a window label exists in
  // DB we keep it; otherwise we still surface it so dropdowns are predictable.
  const window = buildVisibleCohorts(active, 2, 2);
  const visible = [...window].sort((a, b) => {
    const pa = parseCohort(a)?.startYear ?? 0;
    const pb = parseCohort(b)?.startYear ?? 0;
    return pb - pa;
  });

  return {
    all: cohorts ?? [],
    visible,
    active,
    startMonth,
    endMonth,
    isLoading,
  };
}
