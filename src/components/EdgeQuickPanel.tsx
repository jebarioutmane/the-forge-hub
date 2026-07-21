import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogOut, UserCog, ChevronLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { MyProfileDialog } from "@/components/MyProfileDialog";
import TeamPresence from "@/components/TeamPresence";
import { cn } from "@/lib/utils";

/**
 * Slim quick-access panel that reveals when the cursor approaches the right
 * edge of the viewport. On touch devices a small handle is always visible
 * for tap-to-open. Contains: user identity, theme toggle, log out.
 */
export function EdgeQuickPanel() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { roleName } = usePermissions();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

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

  // Edge-hover trigger (desktop / mouse pointers only).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const threshold = 24;
      if (window.innerWidth - e.clientX <= threshold) {
        if (closeTimer.current) window.clearTimeout(closeTimer.current);
        setOpen(true);
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 350);
  };
  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };

  const fullName = profile?.full_name || user?.email?.split("@")[0] || "";
  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : (user?.email?.[0] || "?").toUpperCase();

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
    navigate("/auth");
  };

  if (!user) return null;

  return (
    <>
      {/* Small centered handle — compact blue arrow tab */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open quick panel"
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-[60]",
          "h-8 w-6 rounded-l-full",
          "bg-signal/90 hover:bg-signal text-white shadow-md",
          "flex items-center justify-center transition-all",
          open && "opacity-0 pointer-events-none"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Panel */}
      <div
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        className={cn(
          "fixed right-0 top-0 z-[70] h-[100dvh] w-72",
          "bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl",
          "transition-transform duration-300 ease-out",
          "flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-label="Quick account panel"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Account
          </span>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground text-xs"
            aria-label="Close panel"
          >
            Close
          </button>
        </div>

        <div className="p-5 flex items-center gap-3 border-b border-border">
          <Avatar className="h-11 w-11 border border-border">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-secondary text-foreground text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {fullName || "Signed in"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
            {roleName && (
              <p className="text-[11px] uppercase tracking-wide text-signal font-medium mt-1">
                {roleName}
              </p>
            )}
          </div>
        </div>

        <div className="p-3 flex flex-col gap-1">
          <button
            onClick={() => { setProfileOpen(true); setOpen(false); }}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
          >
            <UserCog className="h-4 w-4" /> Edit profile
          </button>

        </div>

        <div className="mt-auto p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </div>

      <MyProfileDialog open={profileOpen} onOpenChange={setProfileOpen} hideTrigger />
    </>
  );
}
