import {
  LayoutDashboard, DollarSign, FileText, CalendarDays,
  ClipboardCheck, GraduationCap, TrendingUp, BookOpen,
  Settings, Wallet, PiggyBank, ListTodo,
  ClipboardList, BarChart3, Users2, Truck,
  LogOut, ChevronDown, Menu,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MyProfileDialog } from "@/components/MyProfileDialog";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import TeamPresence from "@/components/TeamPresence";
import logoWhite from "@/assets/Logo-THEFORGE_white.png";
import logoColored from "@/assets/Logo-THEFORGE_colored.png";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const sections = [
  {
    label: "Dashboard",
    items: [
      { title: "Home", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Budget Dashboard", url: "/operations", icon: PiggyBank },
      { title: "Expenses", url: "/operations/source", icon: DollarSign },
      { title: "Stipends", url: "/operations/stipends", icon: Wallet },
      { title: "Contracts", url: "/operations/contracts", icon: FileText },
      { title: "Tasks", url: "/operations/tasks", icon: ListTodo },
    ],
  },
  {
    label: "Program",
    items: [
      { title: "Events Calendar", url: "/events", icon: CalendarDays },
      { title: "Planning", url: "/events/planning", icon: ClipboardCheck },
      { title: "Logistics", url: "/events/logistics", icon: Truck },
      { title: "Stakeholders", url: "/events/stakeholders", icon: Users2 },
    ],
  },
  {
    label: "Founders",
    items: [
      { title: "Directory", url: "/founders", icon: GraduationCap },
      { title: "Progress Tracker", url: "/founders/tracking", icon: TrendingUp },
      { title: "Evaluations", url: "/founders/evaluation", icon: ClipboardList },
      { title: "Portfolio Dashboard", url: "/founders/portfolio", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Library", url: "/library", icon: BookOpen },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function TopNav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <img
            src={isDark ? logoWhite : logoColored}
            alt="The Forge"
            className="h-7"
          />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
              <Menu className="h-4 w-4" />
              <span className="hidden sm:inline">Navigate</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {sections.map((section, sIdx) => (
              <div key={section.label}>
                {sIdx > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </DropdownMenuLabel>
                {section.items.map((item) => {
                  const isActive =
                    item.url === "/"
                      ? location.pathname === "/"
                      : location.pathname.startsWith(item.url);
                  return (
                    <DropdownMenuItem
                      key={item.url}
                      onClick={() => navigate(item.url)}
                      className={cn(
                        "gap-2 cursor-pointer",
                        isActive && "bg-accent text-accent-foreground font-medium"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.title}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: Team Presence + Theme + Profile + Sign Out */}
      <div className="flex items-center gap-3">
        <TeamPresence />
        <ThemeToggle />
        <MyProfileDialog />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-destructive"
          title="Sign Out"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
