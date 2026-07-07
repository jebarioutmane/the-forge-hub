import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import type { Tables } from "@/integrations/supabase/types";

type Cohort = Tables<"cohorts">;

/** Sentinel value representing the "All cohorts" selection. */
export const ALL_COHORTS = "all" as const;
export type CohortSelection = string; // cohort.id | "all"

interface CohortContextValue {
  /** Currently selected cohort id, or "all" for all cohorts. */
  selectedCohortId: CohortSelection;
  /** Change the selection. Kept in React state — not persisted to storage. */
  setSelectedCohortId: (id: CohortSelection) => void;
  /** Full row for the selected cohort, or null when "all" or not loaded. */
  selectedCohort: Cohort | null;
  /** Human label ("2025-2026" or "All cohorts"). */
  selectedCohortLabel: string;
  /** All cohorts (newest first). */
  cohorts: Cohort[];
  /** The row where is_active = true, if any. */
  activeCohort: Cohort | null;
  isLoading: boolean;
}

const CohortContext = createContext<CohortContextValue | undefined>(undefined);

export function CohortProvider({ children }: { children: React.ReactNode }) {
  const { data: allCohorts = [], isLoading } = useQuery({
    queryKey: ["cohorts", "global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohorts")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return data as Cohort[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { scopedCohortIds } = usePermissions();

  // Non-archived cohorts only; further restricted to scoped cohort ids when set.
  const cohorts = useMemo(
    () => {
      const base = allCohorts.filter((c) => !c.is_archived);
      if (!scopedCohortIds) return base;
      const allow = new Set(scopedCohortIds);
      return base.filter((c) => allow.has(c.id));
    },
    [allCohorts, scopedCohortIds]
  );

  const activeCohort = useMemo(
    () => cohorts.find((c) => c.is_active) ?? null,
    [cohorts]
  );

  // In-memory only — no localStorage / sessionStorage.
  const [selectedCohortId, setSelectedCohortId] = useState<CohortSelection>("");

  // Initialize once cohorts load: default to the active cohort, else "all".
  useEffect(() => {
    if (selectedCohortId) return;
    if (cohorts.length === 0) return;
    setSelectedCohortId(activeCohort ? activeCohort.id : ALL_COHORTS);
  }, [cohorts, activeCohort, selectedCohortId]);

  // If the selected cohort is archived/removed, snap back to active or "all".
  useEffect(() => {
    if (!selectedCohortId || selectedCohortId === ALL_COHORTS) return;
    const stillVisible = cohorts.some((c) => c.id === selectedCohortId);
    if (!stillVisible) {
      setSelectedCohortId(activeCohort ? activeCohort.id : ALL_COHORTS);
    }
  }, [cohorts, activeCohort, selectedCohortId]);

  const selectedCohort = useMemo(() => {
    if (!selectedCohortId || selectedCohortId === ALL_COHORTS) return null;
    return cohorts.find((c) => c.id === selectedCohortId) ?? null;
  }, [cohorts, selectedCohortId]);

  const selectedCohortLabel = useMemo(() => {
    if (selectedCohortId === ALL_COHORTS) return "All cohorts";
    return selectedCohort?.label ?? "";
  }, [selectedCohort, selectedCohortId]);

  const value: CohortContextValue = {
    selectedCohortId: selectedCohortId || ALL_COHORTS,
    setSelectedCohortId,
    selectedCohort,
    selectedCohortLabel,
    cohorts,
    activeCohort,
    isLoading,
  };

  return <CohortContext.Provider value={value}>{children}</CohortContext.Provider>;
}

export function useCohort(): CohortContextValue {
  const ctx = useContext(CohortContext);
  if (!ctx) {
    throw new Error("useCohort must be used inside a <CohortProvider>");
  }
  return ctx;
}
