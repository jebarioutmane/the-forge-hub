import { useState } from "react";
import {
  LayoutDashboard, DollarSign, FileText, CalendarDays,
  ClipboardCheck, GraduationCap, TrendingUp, BookOpen,
  Settings, Wallet, PiggyBank, ListTodo,
  ClipboardList, BarChart3, Users2, Truck,
  LogOut, Menu, ChevronRight, Search,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MyProfileDialog } from "@/components/MyProfileDialog";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import TeamPresence from "@/components/TeamPresence";
const appIcon = "/pwa-512x512.png";
import { usePresence } from "@/hooks/usePresence";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/GlobalSearch";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AnimatePresence, motion } from "framer-motion";

const sections = [
  {
    label: "Founders",
    headline: "Explore Founders",
    description: "Manage your portfolio founders, track progress, and run evaluations.",
    items: [
      { title: "Directory", url: "/founders", icon: GraduationCap, desc: "Browse and manage all founders" },
      { title: "Progress Tracker", url: "/founders/tracking", icon: TrendingUp, desc: "Weekly progress updates" },
      { title: "Evaluations", url: "/founders/evaluation", icon: ClipboardList, desc: "Structured evaluation blocks" },
      { title: "Portfolio Dashboard", url: "/founders/portfolio", icon: BarChart3, desc: "High-level portfolio view" },
    ],
  },
  {
    label: "Events",
    headline: "Program Events",
    description: "Plan, coordinate, and execute program events seamlessly.",
    items: [
      { title: "Events Calendar", url: "/events", icon: CalendarDays, desc: "View upcoming events" },
      { title: "Planning", url: "/events/planning", icon: ClipboardCheck, desc: "Event checklists and prep" },
      { title: "Logistics", url: "/events/logistics", icon: Truck, desc: "Transport, catering, venues" },
      { title: "Stakeholders", url: "/events/stakeholders", icon: Users2, desc: "Manage external contacts" },
    ],
  },
  {
    label: "Operations",
    headline: "Operations Hub",
    description: "Budget tracking, expenses, contracts, and team tasks.",
    items: [
      { title: "Budget Dashboard", url: "/operations", icon: PiggyBank, desc: "Financial overview" },
      { title: "Expenses", url: "/operations/source", icon: DollarSign, desc: "Track and categorize spend" },
      { title: "Stipends", url: "/operations/stipends", icon: Wallet, desc: "Founder stipend payouts" },
      { title: "Contracts", url: "/operations/contracts", icon: FileText, desc: "Manage agreements" },
      { title: "Tasks", url: "/operations/tasks", icon: ListTodo, desc: "Team task management" },
    ],
  },
  {
    label: "System",
    headline: "System & Settings",
    description: "Application configuration and shared resources.",
    items: [
      { title: "Team Profiles", url: "/system/profiles", icon: Users2, desc: "Team member directory" },
      { title: "History Log", url: "/system/history", icon: ClipboardList, desc: "Audit trail & restore" },
      { title: "Library", url: "/library", icon: BookOpen, desc: "Shared resource links" },
      { title: "Settings", url: "/settings", icon: Settings, desc: "App preferences" },
    ],
  },
];

function MegaMenuContent({
  section,
  navigate,
  location,
}: {
  section: (typeof sections)[0];
  navigate: ReturnType<typeof useNavigate>;
  location: ReturnType<typeof useLocation>;
}) {
  return (
    <div className="grid w-[520px] gap-0 p-5 md:grid-cols-[180px_1fr]">
      <div className="flex flex-col justify-center pr-5 border-r border-border">
        <p className="text-base font-semibold text-foreground tracking-tight">{section.headline}</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{section.description}</p>
      </div>
      <ul className="flex flex-col gap-0.5 pl-5">
        {section.items.map((item) => {
          const isActive =
            item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
          return (
            <li key={item.url}>
              <button
                onClick={() => navigate(item.url)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200 hover:bg-accent",
                  isActive && "bg-accent"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className={cn("text-sm font-medium", isActive ? "text-primary" : "text-foreground")}>
                    {item.title}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{item.desc}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TopNav() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { onlineUserIds } = usePresence();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isHome = location.pathname === "/";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 h-12 border-b border-border bg-card/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        {/* Left: Logo */}
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
          >
            <img
              src={appIcon}
              alt="The Forge"
              className="h-8 w-8 object-contain rounded-md shadow-sm"
            />
          </button>

          {/* Desktop: Mega Menu */}
          {!isMobile && (
            <NavigationMenu
              onValueChange={(val) => setIsMenuOpen(!!val)}
            >
              <NavigationMenuList className="gap-0">
                {sections.map((section) => (
                  <NavigationMenuItem key={section.label}>
                    <NavigationMenuTrigger className="h-auto px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground bg-transparent hover:bg-transparent data-[state=open]:bg-transparent data-[active]:bg-transparent">
                      {section.label}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <MegaMenuContent
                        section={section}
                        navigate={navigate}
                        location={location}
                      />
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          )}

          {/* Home: prominent search bar */}
          {!isMobile && isHome && (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full max-w-md h-10 bg-secondary rounded-xl flex items-center px-4 text-muted-foreground cursor-text hover:bg-accent transition-colors gap-2"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="text-sm">Search anything...</span>
            </button>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Mobile: always show search icon */}
          {isMobile && (
            <button
              onClick={() => setSearchOpen(true)}
              className="h-9 w-9 rounded-full hover:bg-secondary flex items-center justify-center transition-colors text-foreground active:scale-95"
              title="Search"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
          )}
          {/* Desktop non-home: subtle search icon */}
          {!isMobile && !isHome && (
            <button
              onClick={() => setSearchOpen(true)}
              className="h-9 w-9 rounded-full hover:bg-secondary flex items-center justify-center transition-colors text-foreground"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
          {!isMobile && !isHome && <TeamPresence onlineUserIds={onlineUserIds} />}
          {!isMobile && <MyProfileDialog />}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-destructive h-8 w-8"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}

          {/* Mobile hamburger */}
          {isMobile && (
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="top" className="h-[100dvh] w-full p-0 border-0 bg-background">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex items-center justify-between px-5 h-12 border-b border-border">
                  <img
                    src={appIcon}
                    alt="The Forge"
                    className="h-8 w-8 object-contain rounded-md shadow-sm"
                  />
                  <span className="font-semibold text-foreground text-sm tracking-tight">The Forge</span>
                </div>

                <div className="px-5 py-5 overflow-y-auto max-h-[calc(100dvh-48px)]">
                  <button
                    onClick={() => { navigate("/"); setMobileOpen(false); }}
                    className={cn(
                      "flex items-center gap-3 w-full py-3 text-xl font-semibold tracking-tight transition-colors duration-200",
                      location.pathname === "/" ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    Home
                  </button>

                  <Accordion type="single" collapsible className="w-full">
                    {sections.map((section) => (
                      <AccordionItem key={section.label} value={section.label} className="border-border">
                        <AccordionTrigger className="py-3 text-xl font-semibold tracking-tight text-muted-foreground hover:text-foreground hover:no-underline">
                          {section.label}
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="flex flex-col gap-0.5 pl-1 pb-2">
                            {section.items.map((item) => {
                              const isActive =
                                item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
                              return (
                                <button
                                  key={item.url}
                                  onClick={() => { navigate(item.url); setMobileOpen(false); }}
                                  className={cn(
                                    "flex items-center justify-between w-full rounded-lg px-3 py-2.5 text-left transition-colors duration-200",
                                    isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    <span className="text-[15px] font-medium">{item.title}</span>
                                  </div>
                                  <ChevronRight className="h-4 w-4 opacity-30" />
                                </button>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  <div className="mt-6 pt-5 border-t border-border flex flex-col gap-3">
                    <TeamPresence onlineUserIds={onlineUserIds} />
                    <div className="flex items-center gap-2 pt-2">
                      <MyProfileDialog />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { handleSignOut(); setMobileOpen(false); }}
                        className="text-muted-foreground hover:text-destructive gap-2"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>

      {/* Desktop blur overlay */}
      <AnimatePresence>
        {isMenuOpen && !isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 top-12 z-40 bg-background/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
