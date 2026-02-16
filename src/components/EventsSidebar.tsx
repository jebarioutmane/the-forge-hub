import { CalendarDays, ClipboardList, Users, BookOpen } from "lucide-react";
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
  { title: "Timeline", url: "/events", icon: CalendarDays },
  { title: "Planning", url: "/events/planning", icon: ClipboardList },
  { title: "Mentoring", url: "/events/mentoring", icon: Users },
  { title: "Library", url: "/events/library", icon: BookOpen },
];

export function EventsSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-4 py-5">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Events & Programs
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
                      end={item.url === "/events"}
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
