import {
  LayoutDashboard, DollarSign, FileText, CalendarDays,
  ClipboardCheck, GraduationCap, TrendingUp, BookOpen,
  Settings, Wallet, PiggyBank, ClipboardList,
  BarChart3, Users2, Layers, Tag, UserCircle, ListTodo,
  FileBarChart, FileSpreadsheet, ShieldCheck,

  type LucideIcon,
} from "lucide-react";


export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  description: string;
};

export type NavSection = {
  label: string;
  headline: string;
  description: string;
  colorClass: string;
  items: NavItem[];
};

/**
 * Single source of truth for the app's navigation.
 * The top mega-menu, mobile drawer, and any sidebar all render from this list.
 * Add/remove a page here and every menu updates automatically.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Founders",
    headline: "Explore Founders",
    description: "Manage portfolio founders, track progress, and run evaluations.",
    colorClass: "text-module-founders",
    items: [
      { title: "Directory", url: "/founders", icon: GraduationCap, description: "Browse and manage all founders" },
      { title: "Tracking", url: "/founders/tracking", icon: TrendingUp, description: "Weekly check-ins and 1:1 progress" },
      { title: "Evaluations", url: "/founders/evaluations", icon: ClipboardCheck, description: "Formal block-end founder evaluations" },
      { title: "Portfolio Dashboard", url: "/founders/portfolio", icon: BarChart3, description: "High-level portfolio view" },
    ],
  },
  {
    label: "Events",
    headline: "Program Events",
    description: "Plan, coordinate, and execute program events seamlessly.",
    colorClass: "text-module-events",
    items: [
      { title: "Events Calendar", url: "/events", icon: CalendarDays, description: "Unified event workspace" },
      { title: "Stakeholders", url: "/events/stakeholders", icon: Users2, description: "Mentors, speakers, and guests" },
    ],
  },
  {
    label: "Operations",
    headline: "Operations Hub",
    description: "Budget tracking, expenses, contracts, and stipends.",
    colorClass: "text-module-operations",
    items: [
      { title: "Budget Dashboard", url: "/operations", icon: PiggyBank, description: "Financial overview" },
      { title: "Expenses", url: "/operations/expenses", icon: DollarSign, description: "Cohort-based expense tracking" },
      { title: "Stipends", url: "/operations/stipends", icon: Wallet, description: "Founder stipend payouts" },
      { title: "Contracts", url: "/operations/contracts", icon: FileText, description: "Manage agreements" },
      { title: "Tasks", url: "/operations/tasks", icon: ListTodo, description: "Team task hub — manual and automated" },
    ],
  },
  {
    label: "Reporting",
    headline: "Reporting",
    description: "Design report templates and generate program reports.",
    colorClass: "text-primary",
    items: [
      { title: "Report Templates", url: "/reporting/templates", icon: FileBarChart, description: "Reusable report templates and questions" },
      { title: "Reports", url: "/reporting/reports", icon: FileSpreadsheet, description: "Launch, fill, and export reports" },
    ],

  },
  {

    label: "System",
    headline: "System & Settings",
    description: "Application configuration and shared resources.",
    colorClass: "text-muted-foreground",
    items: [
      { title: "Budget Lines", url: "/operations/budget-lines", icon: Layers, description: "Sponsor budget lines and allocations" },
      { title: "Team Profiles", url: "/system/profiles", icon: UserCircle, description: "Team member directory" },
      { title: "Tags & Labels", url: "/system/tags", icon: Tag, description: "Shared tags used across the platform" },
      { title: "History Log", url: "/system/history", icon: ClipboardList, description: "Audit trail and restore" },
      { title: "Library", url: "/library", icon: BookOpen, description: "Shared resource library" },
      { title: "Settings", url: "/settings", icon: Settings, description: "App preferences" },
    ],
  },
];

export const HOME_ITEM: NavItem = {
  title: "Home",
  url: "/",
  icon: LayoutDashboard,
  description: "Command center overview",
};

/** Flat list of every navigable page (useful for search, breadcrumbs, sitemaps). */
export const ALL_NAV_ITEMS: NavItem[] = [
  HOME_ITEM,
  ...NAV_SECTIONS.flatMap((s) => s.items),
];
