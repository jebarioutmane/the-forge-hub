import { useNavigate } from "react-router-dom";
import { MyProfileDialog } from "@/components/MyProfileDialog";
const appIcon = "/pwa-512x512.png";

export function GlobalTopBar() {
  const navigate = useNavigate();

  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-6">
      <button onClick={() => navigate("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <img src={appIcon} alt="The Forge" className="h-8 w-8 object-contain rounded-md shadow-sm" />
        <span className="font-semibold text-foreground text-sm tracking-tight">The Forge</span>
      </button>

      <div className="flex items-center gap-2">
        <MyProfileDialog />
      </div>
    </header>
  );
}
