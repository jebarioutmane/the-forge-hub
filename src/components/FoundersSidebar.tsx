import { Users, TrendingUp, BookOpen } from "lucide-react";
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
  { title: "Source", url: "/founders", icon: Users },
  { title: "Tracking", url: "/founders/tracking", icon: TrendingUp },
  { title: "Library", url: "/founders/library", icon: BookOpen },
];

export function FoundersSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-4 py-5">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Founders
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
                      end={item.url === "/founders"}
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
