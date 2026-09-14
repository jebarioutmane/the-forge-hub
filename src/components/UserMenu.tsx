import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { MyProfileDialog } from "@/components/MyProfileDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Quiet avatar trigger in the top bar with account actions. */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const { roleName } = usePermissions();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, title")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  if (!user) return null;

  const fullName = profile?.full_name || user.email?.split("@")[0] || "";
  const initials = fullName
    ? fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : (user.email?.[0] || "?").toUpperCase();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="h-7 w-7 shrink-0 rounded-full border border-border bg-muted text-[11px] font-medium text-muted-foreground flex items-center justify-center transition-colors hover:text-foreground"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-2">
          <p className="text-sm font-medium text-foreground truncate">{fullName || "Signed in"}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          {roleName && (
            <p className="mt-1 text-xs text-muted-foreground truncate">{roleName}</p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/system/profiles")}>
          <User className="mr-2 h-4 w-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/settings")}>
          <SettingsIcon className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
