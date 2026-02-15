import { Home, LayoutDashboard, DollarSign, ListTodo, FileText, Settings, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
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
import { Button } from "@/components/ui/button";

const items = [
  { title: "Home", url: "/", icon: Home },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Finance", url: "/finance", icon: DollarSign },
  { title: "Tasks", url: "/tasks", icon: ListTodo },
  { title: "Contracts", url: "/contracts", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();

  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-4 py-6">
          <h2 className="text-lg font-bold tracking-widest text-primary">THE FORGE</h2>
          <p className="text-xs text-muted-foreground tracking-wider">HUB</p>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs tracking-widest text-muted-foreground">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-primary font-medium">
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
      <SidebarFooter className="p-4">
        {user && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
