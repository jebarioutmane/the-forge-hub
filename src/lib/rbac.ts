import { supabase } from "@/integrations/supabase/client";

const SUPER_ADMIN_EMAIL = "outmane.jebari@um6p.ma";

export function isSuperAdminEmail(email: string | undefined | null): boolean {
  return email?.toLowerCase() === SUPER_ADMIN_EMAIL;
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export function canEditProfiles(
  currentUserEmail: string | undefined | null,
  currentUserRole: string | null | undefined
): boolean {
  return isSuperAdminEmail(currentUserEmail) || isAdminRole(currentUserRole);
}

export async function updateProfileRole(profileId: string, newRole: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", profileId);
  if (error) throw error;
}
