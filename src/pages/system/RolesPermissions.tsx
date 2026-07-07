import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ShieldAlert, ShieldCheck, Shield, Plus, Users, Sliders, Lock, Trash2, Check, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Role = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_external: boolean;
  cohort_scoped: boolean;
};

type Permission = {
  id?: string;
  role_id: string;
  section: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_see_sensitive: boolean;
};

const SECTIONS: { key: string; label: string }[] = [
  { key: "founders", label: "Founders" },
  { key: "tracking", label: "Tracking" },
  { key: "evaluations", label: "Evaluations" },
  { key: "portfolio", label: "Portfolio" },
  { key: "events", label: "Events" },
  { key: "stakeholders", label: "Stakeholders" },
  { key: "budget", label: "Budget" },
  { key: "expenses", label: "Expenses" },
  { key: "stipends", label: "Stipends" },
  { key: "contracts", label: "Contracts" },
  { key: "tasks", label: "Tasks" },
  { key: "reporting", label: "Reporting" },
  { key: "team", label: "Team" },
  { key: "history", label: "History" },
  { key: "library", label: "Library" },
  { key: "settings", label: "Settings" },
  { key: "budget_lines", label: "Budget Lines" },
];

const PERM_KEYS = ["can_view", "can_edit", "can_delete", "can_see_sensitive"] as const;
type PermKey = typeof PERM_KEYS[number];

const PERM_LABELS: Record<PermKey, string> = {
  can_view: "View",
  can_edit: "Edit",
  can_delete: "Delete",
  can_see_sensitive: "Sensitive",
};

function emptyPerm(role_id: string, section: string): Permission {
  return {
    role_id, section,
    can_view: false, can_edit: false, can_delete: false, can_see_sensitive: false,
  };
}

export default function RolesPermissions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: myProfile, isLoading: loadingMe } = useQuery({
    queryKey: ["me-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, role_id, roles:role_id(name)")
        .eq("id", user!.id)
        .maybeSingle();
      return data as any;
    },
  });

  const isSuperAdmin = myProfile?.roles?.name === "Super Admin";

  const { data: roles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ["roles-all"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as Role[];
    },
  });

  const { data: userCounts = {} } = useQuery({
    queryKey: ["role-user-counts"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("role_id");
      const counts: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        if (p.role_id) counts[p.role_id] = (counts[p.role_id] || 0) + 1;
      });
      return counts;
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<Role | null>(null);

  // ---- Role create/edit ----
  const [roleForm, setRoleForm] = useState({
    name: "", description: "", is_external: false, cohort_scoped: false,
  });

  const saveRole = useMutation({
    mutationFn: async () => {
      const payload = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim() || null,
        is_external: roleForm.is_external,
        cohort_scoped: roleForm.cohort_scoped,
      };
      if (!payload.name) throw new Error("Name required");
      if (activeRole && editRoleOpen) {
        const { error } = await supabase.from("roles").update(payload).eq("id", activeRole.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("roles").insert({ ...payload, is_system: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles-all"] });
      toast.success("Role saved");
      setCreateOpen(false); setEditRoleOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRole = useMutation({
    mutationFn: async (r: Role) => {
      if (r.is_system) throw new Error("System roles cannot be deleted");
      const { error } = await supabase.from("roles").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles-all"] });
      qc.invalidateQueries({ queryKey: ["role-user-counts"] });
      toast.success("Role deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- Matrix ----
  const { data: perms = [], refetch: refetchPerms } = useQuery({
    queryKey: ["role-permissions", activeRole?.id],
    enabled: !!activeRole && matrixOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("role_id", activeRole!.id);
      if (error) throw error;
      return data as Permission[];
    },
  });

  const [matrix, setMatrix] = useState<Record<string, Permission>>({});
  const isSuperAdminRole = activeRole?.name === "Super Admin";

  useEffect(() => {
    if (!activeRole) return;
    const map: Record<string, Permission> = {};
    SECTIONS.forEach((s) => {
      const existing = perms.find((p) => p.section === s.key);
      map[s.key] = existing
        ? { ...existing }
        : emptyPerm(activeRole.id, s.key);
      if (isSuperAdminRole) {
        map[s.key] = {
          ...map[s.key],
          can_view: true, can_edit: true, can_delete: true, can_see_sensitive: true,
        };
      }
    });
    setMatrix(map);
  }, [perms, activeRole, isSuperAdminRole]);

  function setCell(section: string, key: PermKey, value: boolean) {
    if (isSuperAdminRole) return;
    setMatrix((m) => ({ ...m, [section]: { ...m[section], [key]: value } }));
  }

  function applyPreset(preset: "full" | "view" | "none") {
    if (isSuperAdminRole) return;
    setMatrix((m) => {
      const next: Record<string, Permission> = {};
      Object.entries(m).forEach(([k, v]) => {
        if (preset === "full") next[k] = { ...v, can_view: true, can_edit: true, can_delete: true, can_see_sensitive: true };
        else if (preset === "view") next[k] = { ...v, can_view: true, can_edit: false, can_delete: false, can_see_sensitive: false };
        else next[k] = { ...v, can_view: false, can_edit: false, can_delete: false, can_see_sensitive: false };
      });
      return next;
    });
  }

  const saveMatrix = useMutation({
    mutationFn: async () => {
      if (!activeRole) throw new Error("No role");
      if (isSuperAdminRole) throw new Error("Super Admin permissions are locked");
      const rows = Object.values(matrix).map((p) => ({
        role_id: p.role_id,
        section: p.section,
        can_view: p.can_view,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        can_see_sensitive: p.can_see_sensitive,
      }));
      const { error } = await supabase
        .from("role_permissions")
        .upsert(rows, { onConflict: "role_id,section" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissions saved");
      refetchPerms();
      setMatrixOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- Access gate ----
  if (loadingMe) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isSuperAdmin) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
            <h1 className="font-serif text-2xl text-ink mb-2">Access restricted</h1>
            <p className="text-sm text-muted-foreground">
              Roles & Permissions is available to Super Admins only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl text-ink">Roles &amp; Permissions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define roles and control access section by section. This stage stores the configuration; enforcement across the app comes next.
          </p>
        </div>
        <Button onClick={() => {
          setActiveRole(null);
          setRoleForm({ name: "", description: "", is_external: false, cohort_scoped: false });
          setCreateOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" /> New Role
        </Button>
      </div>

      {loadingRoles ? (
        <div className="text-sm text-muted-foreground">Loading roles…</div>
      ) : roles.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No roles yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((r) => (
            <RoleCard
              key={r.id}
              role={r}
              userCount={userCounts[r.id] || 0}
              onEditRole={() => {
                setActiveRole(r);
                setRoleForm({
                  name: r.name,
                  description: r.description || "",
                  is_external: r.is_external,
                  cohort_scoped: r.cohort_scoped,
                });
                setEditRoleOpen(true);
              }}
              onEditMatrix={() => {
                setActiveRole(r);
                setMatrixOpen(true);
              }}
              onDelete={() => {
                if (confirm(`Delete role "${r.name}"?`)) deleteRole.mutate(r);
              }}
            />
          ))}
        </div>
      )}

      {/* ---- Create/Edit role dialog ---- */}
      <Dialog open={createOpen || editRoleOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditRoleOpen(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editRoleOpen ? "Edit role" : "New role"}
            </DialogTitle>
            <DialogDescription>
              {editRoleOpen ? "Update this role's metadata." : "Create a new custom role. You can define its permissions afterwards."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={roleForm.name} onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={roleForm.description} onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm">External</p>
                <p className="text-xs text-muted-foreground">Outside the internal team (e.g. sponsor, partner).</p>
              </div>
              <Switch checked={roleForm.is_external} onCheckedChange={(v) => setRoleForm((f) => ({ ...f, is_external: v }))} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm">Cohort scoped</p>
                <p className="text-xs text-muted-foreground">Users of this role only see data from specific cohorts.</p>
              </div>
              <Switch checked={roleForm.cohort_scoped} onCheckedChange={(v) => setRoleForm((f) => ({ ...f, cohort_scoped: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditRoleOpen(false); }}>Cancel</Button>
            <Button onClick={() => saveRole.mutate()} disabled={saveRole.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Matrix dialog ---- */}
      <Dialog open={matrixOpen} onOpenChange={setMatrixOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Permissions — {activeRole?.name}
            </DialogTitle>
            <DialogDescription>
              Toggle View, Edit, Delete and access to sensitive data (RIB / CIN / passport) for each section.
            </DialogDescription>
          </DialogHeader>

          {isSuperAdminRole && (
            <div className="rounded-md border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" />
              Super Admin is locked to full access on every section and cannot be reduced.
            </div>
          )}

          <div className="flex items-center gap-2 py-2">
            <span className="text-xs text-muted-foreground mr-1">Presets:</span>
            <Button size="sm" variant="outline" disabled={isSuperAdminRole} onClick={() => applyPreset("full")}>Full access</Button>
            <Button size="sm" variant="outline" disabled={isSuperAdminRole} onClick={() => applyPreset("view")}>View only</Button>
            <Button size="sm" variant="outline" disabled={isSuperAdminRole} onClick={() => applyPreset("none")}>No access</Button>
          </div>

          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-ink">Section</th>
                  {PERM_KEYS.map((k) => (
                    <th key={k} className="text-center px-3 py-2 font-medium text-ink w-24">
                      {PERM_LABELS[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map((s, idx) => {
                  const row = matrix[s.key] || emptyPerm(activeRole?.id || "", s.key);
                  return (
                    <tr key={s.key} className={cn("border-t border-border", idx % 2 === 1 && "bg-secondary/20")}>
                      <td className="px-4 py-2 text-ink">{s.label}</td>
                      {PERM_KEYS.map((k) => (
                        <td key={k} className="text-center px-3 py-2">
                          <Checkbox
                            checked={row[k]}
                            disabled={isSuperAdminRole}
                            onCheckedChange={(v) => setCell(s.key, k, !!v)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMatrixOpen(false)}>Close</Button>
            <Button disabled={isSuperAdminRole || saveMatrix.isPending} onClick={() => saveMatrix.mutate()}>
              Save permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleCard({
  role, userCount, onEditRole, onEditMatrix, onDelete,
}: {
  role: Role; userCount: number;
  onEditRole: () => void; onEditMatrix: () => void; onDelete: () => void;
}) {
  const Icon = role.name === "Super Admin" ? ShieldAlert : role.is_external ? Shield : ShieldCheck;
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-9 w-9 rounded-md border border-border bg-secondary flex items-center justify-center text-ink shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="font-serif text-lg truncate">{role.name}</CardTitle>
              {role.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{role.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Users className="h-3.5 w-3.5" />
            {userCount}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {role.is_system && <Badge variant="secondary">System</Badge>}
          {role.is_external && <Badge variant="secondary">External</Badge>}
          {role.cohort_scoped && <Badge variant="secondary">Cohort scoped</Badge>}
          {!role.is_system && !role.is_external && !role.cohort_scoped && (
            <Badge variant="outline">Custom</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onEditMatrix}>
            <Sliders className="h-3.5 w-3.5 mr-1.5" /> Permissions
          </Button>
          <Button size="sm" variant="outline" onClick={onEditRole}>
            Edit
          </Button>
          {!role.is_system && (
            <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
