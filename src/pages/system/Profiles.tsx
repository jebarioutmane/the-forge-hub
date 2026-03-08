import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Eye, Mail, Phone, User } from "lucide-react";
import { logAction } from "@/lib/logAction";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export default function SystemProfiles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ full_name: "", title: "", avatar_url: "" });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const payload = {
        full_name: form.full_name || null,
        title: form.title || null,
        avatar_url: form.avatar_url || null,
      };
      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;
      return payload;
    },
    onSuccess: async (payload) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setEditOpen(false);
      toast.success("Profile updated");
      await logAction("System-Profiles", "UPDATE", user!.id, selectedProfile as any, payload, form.full_name || user!.email || "Unknown");
    },
    onError: (e) => toast.error(e.message),
  });

  function openEdit(profile: Profile) {
    setSelectedProfile(profile);
    setForm({
      full_name: profile.full_name || "",
      title: profile.title || "",
      avatar_url: profile.avatar_url || "",
    });
    setEditOpen(true);
  }

  function openView(profile: Profile) {
    setSelectedProfile(profile);
    setViewOpen(true);
  }

  const initials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Team Profiles</h1>
        <p className="text-sm text-muted-foreground">Directory of team members with accounts</p>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No team members found. Profiles are created automatically when users sign up.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => {
            const isOwn = user?.id === profile.id;
            return (
              <Card key={profile.id} className="relative group">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {initials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{profile.full_name || "Unnamed"}</CardTitle>
                    {profile.title && (
                      <p className="text-sm text-muted-foreground truncate">{profile.title}</p>
                    )}
                    {isOwn && <Badge variant="outline" className="mt-1 text-[10px]">You</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => openView(profile)}>
                      <Eye className="mr-1 h-3 w-3" /> View
                    </Button>
                    {isOwn && (
                      <Button size="sm" onClick={() => openEdit(profile)}>
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Profile Details</DialogTitle>
          </DialogHeader>
          {selectedProfile && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedProfile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                    {initials(selectedProfile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">{selectedProfile.full_name || "Unnamed"}</p>
                  {selectedProfile.title && <p className="text-sm text-muted-foreground">{selectedProfile.title}</p>}
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><User className="inline h-3 w-3 mr-1" />ID: {selectedProfile.id.slice(0, 8)}...</p>
                {selectedProfile.updated_at && (
                  <p>Last updated: {new Date(selectedProfile.updated_at).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Your Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Title / Role</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Program Manager" />
            </div>
            <div className="space-y-2">
              <Label>Avatar URL</Label>
              <Input value={form.avatar_url} onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
