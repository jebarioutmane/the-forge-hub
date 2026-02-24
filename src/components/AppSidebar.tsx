import {
  LayoutDashboard, DollarSign, FileText, CalendarDays, Users,
  ClipboardCheck, GraduationCap, TrendingUp, BookOpen,
  Settings, ChevronDown, Wallet, PiggyBank, ListTodo,
  ClipboardList, BarChart3, Users2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import logoWhite from "@/assets/Logo-THEFORGE_white.png";

const sections = [
  {
    label: "Dashboard",
    color: "text-primary",
    items: [
      { title: "Home", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    color: "text-module-operations",
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
    color: "text-module-events",
    items: [
      { title: "Events Calendar", url: "/events", icon: CalendarDays },
      { title: "Planning", url: "/events/planning", icon: ClipboardCheck },
      { title: "Mentoring", url: "/events/mentoring", icon: Users },
      { title: "Stakeholders", url: "/events/stakeholders", icon: Users2 },
    ],
  },
  {
    label: "Founders",
    color: "text-module-founders",
    items: [
      { title: "Directory", url: "/founders", icon: GraduationCap },
      { title: "Progress Tracker", url: "/founders/tracking", icon: TrendingUp },
      { title: "Evaluations", url: "/founders/evaluation", icon: ClipboardList },
      { title: "Portfolio Dashboard", url: "/founders/portfolio", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    color: "text-muted-foreground",
    items: [
      { title: "Library", url: "/library", icon: BookOpen },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-5 py-5">
          <img src={logoWhite} alt="The Forge" className="h-8" />
        </div>
        {sections.map((section) => (
          <Collapsible key={section.label} defaultOpen>
            <SidebarGroup>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-1 group">
                <SidebarGroupLabel className={`text-[10px] font-bold tracking-[0.15em] uppercase ${section.color}`}>
                  {section.label}
                </SidebarGroupLabel>
                <ChevronDown className="h-3 w-3 text-sidebar-foreground/50 transition-transform group-data-[state=closed]:-rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.title + item.url}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end={item.url === "/"}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-4">
        <p className="text-[10px] text-sidebar-foreground/40 tracking-wider uppercase">The Forge Hub v2.0</p>
      </SidebarFooter>
    </Sidebar>
  );
}
