import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogOut, UserCog, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { MyProfileDialog } from "@/components/MyProfileDialog";
import { useTheme } from "@/contexts/ThemeContext";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { roleName } = usePermissions();
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);

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

  const fullName = profile?.full_name || user?.email?.split("@")[0] || "";
  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : (user?.email?.[0] || "?").toUpperCase();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={toggleTheme}
          className="h-9 w-9 rounded-full hover:bg-secondary flex items-center justify-center transition-colors text-foreground"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-9 w-9 rounded-full hover:opacity-90 transition-opacity flex items-center justify-center"
              title="Account"
              aria-label="Open account menu"
            >
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-secondary text-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-3 py-3">
              <p className="text-sm font-semibold text-foreground truncate">
                {fullName || "Signed in"}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {user?.email}
              </p>
              {roleName && (
                <p className="text-[11px] uppercase tracking-wide text-signal font-medium mt-1.5">
                  {roleName}
                </p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setProfileOpen(true); }}>
              <UserCog className="mr-2 h-4 w-4" />
              Edit profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); handleLogout(); }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <MyProfileDialog open={profileOpen} onOpenChange={setProfileOpen} hideTrigger />
    </>
  );
}
