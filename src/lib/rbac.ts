import { supabase } from "@/integrations/supabase/client";

/**
 * Update a user's role via the security-definer RPC.
 * Access control is enforced server-side (RLS + the RPC's own checks),
 * so this helper carries no client-side email/role gating.
 * UI-level gating should come from usePermissions() (roles + role_permissions),
 * which mirrors what the database allows.
 */
export async function updateProfileRole(profileId: string, newRole: string) {
  const { error } = await (supabase as any).rpc("update_user_role", {
    _target_id: profileId,
    _new_role: newRole,
  });
  if (error) throw error;
}
