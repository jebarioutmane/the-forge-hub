import { LayoutDashboard, Wallet, FileText, ListTodo, PiggyBank, BookOpen, Settings, BarChart3, Layers } from "lucide-react";
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
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/operations", icon: LayoutDashboard },
  { title: "Budget Dashboard", url: "/operations/budget", icon: BarChart3 },
  { title: "Budget Lines", url: "/operations/budget-lines", icon: Layers },
  { title: "Budget Source", url: "/operations/source", icon: PiggyBank },
  { title: "Expenses", url: "/operations/expenses", icon: Wallet },
  { title: "Stipends", url: "/operations/stipends", icon: PiggyBank },
  { title: "Contracts", url: "/operations/contracts", icon: FileText },
  { title: "Library", url: "/operations/library", icon: BookOpen },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function OperationsSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-4 py-5">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Operations
          </p>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs tracking-widest text-muted-foreground">
            Module
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/operations"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
