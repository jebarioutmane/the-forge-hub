import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { canEditProfiles, isSuperAdminEmail, updateProfileRole } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Pencil, Eye, User, CalendarIcon, Link2, X, Trash2, Shield, ShieldCheck, ShieldAlert, Search, Check, Mail, Phone, ExternalLink, Lock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { COUNTRIES, getFlag } from "@/lib/countries";
import { formatUrl } from "@/lib/formatUrl";
import { useCohort } from "@/contexts/CohortContext";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type LinkItem = { title: string; url: string };

const STATUS_OPTIONS = ["Active", "Inactive", "On leave", "On a mission", "Sick leave"];
const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
];

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  birthday: null as string | null,
  date_joined: null as string | null,
  cin_number: "",
  passport_number: "",
  status: "Active",
  status_until: null as string | null,
  status_note: "",
  nationalities: [] as string[],
  tags: [] as string[],
  description: "",
  links: [] as LinkItem[],
  avatar_url: "",
  title: "",
};

function parseLinks(raw: unknown): LinkItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((l: any) => l && typeof l === "object" && (l.title || l.url)).map((l: any) => ({
    title: l.title || "",
    url: l.url || "",
  }));
}

export default function SystemProfiles() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tagInput, setTagInput] = useState("");
  const [natSearch, setNatSearch] = useState("");
  const [natDropdownOpen, setNatDropdownOpen] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rolesList = [] } = useQuery({
    queryKey: ["roles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("id,name,is_system,is_external,cohort_scoped").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { cohorts } = useCohort();

  const currentProfile = profiles.find((p) => p.id === user?.id);
  const currentRoleName = rolesList.find((r) => r.id === (currentProfile as any)?.role_id)?.name;
  const isSuperAdmin = currentRoleName === "Super Admin";
  const hasEditRights = canEditProfiles(user?.email, currentProfile?.role);
  const superAdminRoleId = rolesList.find((r) => r.name === "Super Admin")?.id;
  const superAdminCount = superAdminRoleId
    ? profiles.filter((p: any) => p.role_id === superAdminRoleId).length
    : 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProfile && !isNew) throw new Error("No profile selected");
      const targetId = isNew ? undefined : selectedProfile?.id;
      const payload: any = {
        full_name: form.full_name || null,
        email: form.email || null,
        phone: form.phone || null,
        birthday: form.birthday || null,
        date_joined: form.date_joined || null,
        cin_number: form.cin_number || null,
        passport_number: form.passport_number || null,
        status: form.status || "Active",
        status_until: form.status === "On leave" ? (form.status_until || null) : null,
        status_note: form.status_note || null,
        nationalities: form.nationalities.length ? form.nationalities : null,
        tags: form.tags.length ? form.tags : null,
        description: form.description || null,
        links: form.links.length ? form.links : [],
        avatar_url: form.avatar_url || null,
        title: form.title || null,
      };

      if (isNew) {
        throw new Error("New members must be created via Supabase Auth. Use this form to edit existing profiles.");
      } else {
        const isOwnProfile = targetId === user?.id;
        const isAdmin = hasEditRights;
        if (!isOwnProfile && !isAdmin) throw new Error("No permission");
        const { error } = await supabase.from("profiles").update(payload).eq("id", targetId!);
        if (error) throw error;
      }
      return payload;
    },
    onSuccess: async (payload) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["presence"] });
      setEditOpen(false);
      toast.success("Profile saved");
      if (selectedProfile) {
        const safeOldData = { ...selectedProfile } as Record<string, any>;
        delete safeOldData.cin_number;
        delete safeOldData.passport_number;
        delete safeOldData.phone;
        delete safeOldData.birthday;
        const safeNewData = { ...payload } as Record<string, any>;
        delete safeNewData.cin_number;
        delete safeNewData.passport_number;
        delete safeNewData.phone;
        delete safeNewData.birthday;
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ profileId, role }: { profileId: string; role: string }) => {
      await updateProfileRole(profileId, role);
      return { profileId, role };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Role updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(profile: Profile) {
    setIsNew(false);
    setSelectedProfile(profile);
    setForm({
      full_name: profile.full_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      birthday: profile.birthday || null,
      date_joined: profile.date_joined || null,
      cin_number: profile.cin_number || "",
      passport_number: profile.passport_number || "",
      status: profile.status || "Active",
      status_until: profile.status_until || null,
      status_note: profile.status_note || "",
      nationalities: (profile.nationalities as string[]) || [],
      tags: (profile.tags as string[]) || [],
      description: profile.description || "",
      links: parseLinks(profile.links),
      avatar_url: profile.avatar_url || "",
      title: profile.title || "",
    });
    setEditOpen(true);
  }

  function openView(profile: Profile) {
    setSelectedProfile(profile);
    setViewOpen(true);
  }

  function addLink() {
    setForm((f) => ({ ...f, links: [...f.links, { title: "", url: "" }] }));
  }

  function removeLink(idx: number) {
    setForm((f) => ({ ...f, links: f.links.filter((_, i) => i !== idx) }));
  }

  function updateLink(idx: number, field: "title" | "url", value: string) {
    setForm((f) => ({
      ...f,
      links: f.links.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    }));
  }

  function toggleNationality(country: string) {
    setForm((f) => ({
      ...f,
      nationalities: f.nationalities.includes(country)
        ? f.nationalities.filter((n) => n !== country)
        : [...f.nationalities, country],
    }));
  }

  function addTag() {
    const val = tagInput.trim();
    if (val && !form.tags.includes(val)) {
      setForm((f) => ({ ...f, tags: [...f.tags, val] }));
    }
    setTagInput("");
  }

  const filteredCountries = useMemo(() => {
    if (!natSearch) return COUNTRIES;
    const q = natSearch.toLowerCase();
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [natSearch]);

  const initials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "super_admin":
        return { label: "Super Admin", icon: ShieldAlert, className: "bg-destructive/10 text-destructive border-destructive/20" };
      case "admin":
        return { label: "Admin", icon: ShieldCheck, className: "bg-primary/10 text-primary border-primary/20" };
      default:
        return { label: "User", icon: Shield, className: "bg-muted text-muted-foreground border-border" };
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Profiles</h1>
          <p className="text-sm text-muted-foreground">Directory of team members with accounts</p>
        </div>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No team members found. Profiles are created automatically when users sign up.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => {
            const isOwn = user?.id === profile.id;
            const canEdit = isOwn || hasEditRights;
            const roleBadge = getRoleBadge(profile.role);
            const RoleIcon = roleBadge.icon;
            const nationalities = (profile.nationalities as string[]) || [];
            const tags = (profile.tags as string[]) || [];

            return (
              <Card key={profile.id} className={cn("group relative flex flex-col overflow-hidden border-border/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300", highlightId === profile.id && "animate-target-flash")}>
                {/* Header gradient area */}
                <div className="relative h-24 bg-gradient-to-br from-secondary to-muted flex items-end justify-center">
                  <div className="absolute top-3 right-3 h-14 w-14 rounded-full bg-primary/[0.04]" />
                  {/* Avatar overlapping */}
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
                    <Avatar className="h-14 w-14 border-[3px] border-card shadow-md">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                        {initials(profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 px-5 pt-10 pb-4 text-center">
                  <h3 className="text-[15px] font-semibold text-foreground leading-tight truncate">
                    {profile.full_name || "Unnamed"}
                  </h3>
                  {profile.title && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile.title}</p>
                  )}

                  {/* Country flags */}
                  {nationalities.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5 truncate">
                      {nationalities.map((n) => `${getFlag(n)} ${n}`).join(" · ")}
                    </p>
                  )}

                  {/* Badges row */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 gap-1 font-medium", roleBadge.className)}>
                      <RoleIcon className="h-2.5 w-2.5" />
                      {roleBadge.label}
                    </Badge>
                    {isOwn && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">You</Badge>
                    )}
                    {profile.status && profile.status !== "Active" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-accent text-accent-foreground border-border">
                        {profile.status}
                      </Badge>
                    )}
                  </div>

                  {/* Tags as Apple-style badges */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-1 mt-2.5">
                      {tags.map((t) => (
                        <span key={t} className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium bg-secondary text-muted-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 justify-center mt-3 pt-3 border-t border-border/40">
                    <Button size="sm" variant="outline" onClick={() => openView(profile)} className="h-7 text-xs">
                      <Eye className="mr-1 h-3 w-3" /> View
                    </Button>
                    {canEdit && (
                      <Button size="sm" onClick={() => openEdit(profile)} className="h-7 text-xs">
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                    )}
                  </div>

                  {/* Role selector for admins */}
                  {hasEditRights && !isOwn && (
                    <div className="mt-2">
                      <Select
                        value={profile.role || "user"}
                        onValueChange={(val) => roleMutation.mutate({ profileId: profile.id, role: val })}
                      >
                        <SelectTrigger className="h-7 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value} className="text-xs">
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Profile Details</DialogTitle>
          </DialogHeader>
          {selectedProfile && (
            <ViewProfileContent profile={selectedProfile} initials={initials} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs">Title / Role</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Program Manager" />
            </div>
            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            {/* Phone */}
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            {/* Birthday - native date input */}
            <div className="space-y-1.5">
              <Label className="text-xs">Birthday</Label>
              <Input
                type="date"
                value={form.birthday || ""}
                onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value || null }))}
                className="h-9"
              />
            </div>
            {/* Date Joined */}
            <div className="space-y-1.5">
              <Label className="text-xs">Date Joined</Label>
              <Input
                type="date"
                value={form.date_joined || ""}
                onChange={(e) => setForm((f) => ({ ...f, date_joined: e.target.value || null }))}
                className="h-9"
              />
            </div>
            {/* CIN */}
            <div className="space-y-1.5">
              <Label className="text-xs">CIN Number</Label>
              <Input value={form.cin_number} onChange={(e) => setForm((f) => ({ ...f, cin_number: e.target.value }))} />
            </div>
            {/* Passport */}
            <div className="space-y-1.5">
              <Label className="text-xs">Passport Number</Label>
              <Input value={form.passport_number} onChange={(e) => setForm((f) => ({ ...f, passport_number: e.target.value }))} />
            </div>
            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(val) => setForm((f) => ({ ...f, status: val, status_until: val === "On leave" ? f.status_until : null }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Avatar URL */}
            <div className="space-y-1.5">
              <Label className="text-xs">Avatar URL</Label>
              <Input value={form.avatar_url} onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))} placeholder="https://..." />
            </div>

            {/* Conditional: Until date (only for "On leave") */}
            {form.status === "On leave" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Until</Label>
                <Input
                  type="date"
                  value={form.status_until || ""}
                  onChange={(e) => setForm((f) => ({ ...f, status_until: e.target.value || null }))}
                  className="h-9"
                />
              </div>
            )}

            {/* Status Note - always shown when status is set */}
            <div className={cn("space-y-1.5", form.status === "On leave" ? "" : "sm:col-span-1")}>
              <Label className="text-xs">Status Note</Label>
              <Textarea
                value={form.status_note}
                onChange={(e) => setForm((f) => ({ ...f, status_note: e.target.value }))}
                rows={2}
                placeholder="Details about status..."
                className="min-h-[60px]"
              />
            </div>

            {/* Nationalities - Country multi-select */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Nationalities</Label>
              <Popover open={natDropdownOpen} onOpenChange={setNatDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-sm">
                    <Search className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    {form.nationalities.length > 0
                      ? `${form.nationalities.length} selected`
                      : "Select countries..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0 pointer-events-auto" align="start">
                  <div className="p-2 border-b border-border">
                    <Input
                      value={natSearch}
                      onChange={(e) => setNatSearch(e.target.value)}
                      placeholder="Search countries..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <ScrollArea className="h-[250px]">
                    <div className="p-1">
                      {filteredCountries.map((country) => {
                        const selected = form.nationalities.includes(country);
                        return (
                          <button
                            key={country}
                            type="button"
                            onClick={() => toggleNationality(country)}
                            className={cn(
                              "flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm hover:bg-accent transition-colors text-left",
                              selected && "bg-accent"
                            )}
                          >
                            <span className="text-base leading-none">{getFlag(country)}</span>
                            <span className="flex-1 truncate">{country}</span>
                            {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              {form.nationalities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {form.nationalities.map((n) => (
                    <Badge key={n} variant="secondary" className="text-xs gap-1 pr-1">
                      {getFlag(n)} {n}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setForm((f) => ({ ...f, nationalities: f.nationalities.filter((x) => x !== n) }))} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Tags - full width */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Type and press Enter"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {form.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs gap-1 pr-1">
                      {t}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Description - full width */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Short bio..."
              />
            </div>

            {/* Dynamic Links - full width */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Links</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLink} className="h-6 text-[11px] gap-1">
                  <Plus className="h-3 w-3" /> Add Link
                </Button>
              </div>
              {form.links.map((link, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={link.title}
                    onChange={(e) => updateLink(idx, "title", e.target.value)}
                    placeholder="Title"
                    className="flex-1"
                  />
                  <Input
                    value={link.url}
                    onChange={(e) => updateLink(idx, "url", e.target.value)}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeLink(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── View Profile Sub-component ── */
function ViewProfileContent({ profile, initials }: { profile: Profile; initials: (n: string | null) => string }) {
  const links = parseLinks(profile.links);
  const nationalities = (profile.nationalities as string[]) || [];
  const tags = (profile.tags as string[]) || [];
  const roleBadge = getRoleBadgeStatic(profile.role);

  const statusColor = profile.status === "Active"
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
    : profile.status === "Inactive"
    ? "bg-muted text-muted-foreground border-border"
    : "bg-amber-500/10 text-amber-600 border-amber-500/20";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-border shadow-sm">
          <AvatarImage src={profile.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {initials(profile.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1.5">
          <p className="text-lg font-semibold leading-tight">{profile.full_name || "Unnamed"}</p>
          {profile.title && <p className="text-sm text-muted-foreground">{profile.title}</p>}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={cn("text-[10px] font-medium", roleBadge.className)}>
              {roleBadge.label}
            </Badge>
            {profile.status && (
              <Badge variant="outline" className={cn("text-[10px] font-medium", statusColor)}>
                {profile.status}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Status details */}
      {(profile.status === "On leave" && profile.status_until) && (
        <div className="rounded-lg bg-amber-50 border border-amber-200/50 px-3 py-2 text-sm text-amber-700">
          On leave until <span className="font-medium">{format(new Date(profile.status_until), "PPP")}</span>
        </div>
      )}
      {profile.status_note && (
        <div className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Note:</span> {profile.status_note}
        </div>
      )}

      {/* Contact Info */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contact</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <DetailRow label="Email" value={profile.email} icon={<Mail className="h-3 w-3" />} />
          <DetailRow label="Phone" value={profile.phone} icon={<Phone className="h-3 w-3" />} />
        </div>
      </div>

      {/* HR Data */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">HR Details</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <DetailRow label="CIN Number" value={profile.cin_number} />
          <DetailRow label="Passport" value={profile.passport_number} />
          <DetailRow label="Birthday" value={profile.birthday ? format(new Date(profile.birthday), "PPP") : null} />
          <DetailRow label="Date Joined" value={profile.date_joined ? format(new Date(profile.date_joined), "PPP") : null} />
        </div>
      </div>

      {/* Nationalities */}
      {nationalities.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Nationalities</p>
          <div className="flex flex-wrap gap-1.5">
            {nationalities.map((n) => (
              <Badge key={n} variant="secondary" className="text-xs gap-1">
                {getFlag(n)} {n}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-secondary text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bio */}
      {profile.description && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Bio</p>
          <p className="text-sm leading-relaxed">{profile.description}</p>
        </div>
      )}

      {/* Links */}
      {links.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Links</p>
          <div className="space-y-1.5">
            {links.map((l, i) => (
              <a
                key={i}
                href={formatUrl(l.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline transition-colors"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {l.title || l.url}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm truncate flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {value}
      </p>
    </div>
  );
}

function getRoleBadgeStatic(role: string | null) {
  switch (role) {
    case "super_admin":
      return { label: "Super Admin", className: "bg-destructive/10 text-destructive border-destructive/20" };
    case "admin":
      return { label: "Admin", className: "bg-primary/10 text-primary border-primary/20" };
    default:
      return { label: "User", className: "bg-muted text-muted-foreground border-border" };
  }
}
