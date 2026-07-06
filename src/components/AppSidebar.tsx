import { ChevronDown, LayoutDashboard } from "lucide-react";
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
import { NAV_SECTIONS, HOME_ITEM } from "@/config/navigation";
const appIcon = "/pwa-512x512.png";

const dashboardSection = {
  label: "Dashboard",
  colorClass: "text-primary",
  items: [HOME_ITEM],
};

const allSections = [dashboardSection, ...NAV_SECTIONS];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-5 py-5">
          <img src={appIcon} alt="The Forge" className="h-8 w-8 object-contain rounded-md shadow-sm" />
        </div>
        {allSections.map((section) => (
          <Collapsible key={section.label} defaultOpen>
            <SidebarGroup>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-1 group">
                <SidebarGroupLabel className={`text-[10px] font-bold tracking-[0.15em] uppercase ${section.colorClass}`}>
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
