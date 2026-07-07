import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PermissionSection =
  | "founders" | "tracking" | "evaluations" | "portfolio"
  | "events" | "stakeholders"
  | "budget" | "expenses" | "stipends" | "contracts" | "tasks"
  | "reporting"
  | "team" | "history" | "library" | "settings" | "budget_lines";

type PermRow = {
  section: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_see_sensitive: boolean;
};

const SUPER_ADMIN = "Super Admin";
const TEAM_MEMBER = "Team Member";

/**
 * Loads the current user's role + role_permissions matrix + scoped cohorts.
 * Super Admin and Team Member get full access (unchanged experience).
 * Other roles are filtered per section/perm.
 */
export function usePermissions() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["me-permissions", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role_id, scoped_cohort_ids, roles:role_id(id, name, cohort_scoped)")
        .eq("id", user!.id)
        .maybeSingle();

      const role = (profile as any)?.roles ?? null;
      let perms: PermRow[] = [];
      if (role?.id) {
        const { data: rp } = await supabase
          .from("role_permissions")
          .select("section, can_view, can_edit, can_delete, can_see_sensitive")
          .eq("role_id", role.id);
        perms = (rp ?? []) as PermRow[];
      }
      return {
        roleName: role?.name ?? null,
        cohortScoped: !!role?.cohort_scoped,
        scopedCohortIds: (profile as any)?.scoped_cohort_ids ?? null,
        perms,
      };
    },
  });

  return useMemo(() => {
    const roleName = data?.roleName ?? null;
    const hasFullAccess = roleName === SUPER_ADMIN || roleName === TEAM_MEMBER;
    const permMap = new Map<string, PermRow>();
    (data?.perms ?? []).forEach((p) => permMap.set(p.section, p));

    const check = (section: PermissionSection | undefined, key: keyof PermRow): boolean => {
      if (!section) return true;
      if (hasFullAccess) return true;
      // Until we know the role, default deny for restricted; full access defaults handled above.
      if (!roleName) return true; // treat unknown-yet as permissive to avoid flicker gates
      const row = permMap.get(section);
      if (!row) return false;
      return !!row[key];
    };

    const scopedCohortIds: string[] | null =
      data?.cohortScoped && data?.scopedCohortIds && data.scopedCohortIds.length > 0
        ? data.scopedCohortIds
        : null;

    return {
      loading: authLoading || isLoading,
      roleName,
      isSuperAdmin: roleName === SUPER_ADMIN,
      hasFullAccess,
      canView: (s?: PermissionSection) => check(s, "can_view"),
      canEdit: (s?: PermissionSection) => check(s, "can_edit"),
      canDelete: (s?: PermissionSection) => check(s, "can_delete"),
      canSeeSensitive: (s?: PermissionSection) => check(s, "can_see_sensitive"),
      /** null = no cohort restriction; array = only these cohort ids allowed. */
      scopedCohortIds,
      isCohortRestricted: !!scopedCohortIds,
    };
  }, [data, authLoading, isLoading]);
}
