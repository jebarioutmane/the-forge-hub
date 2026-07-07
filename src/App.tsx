import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/MainLayout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import OperationsDashboard from "./pages/operations/Dashboard";
import Expenses from "./pages/operations/Expenses";
import Stipends from "./pages/operations/Stipends";
import OperationsContracts from "./pages/operations/Contracts";
import BudgetLines from "./pages/operations/BudgetLines";
import OperationsTasks from "./pages/operations/Tasks";


import FoundersSource from "./pages/founders/Source";
import FoundersTracking from "./pages/founders/Tracking";
import PortfolioDashboard from "./pages/founders/Portfolio";
import FoundersEvaluations from "./pages/founders/Evaluations";
import EventsCalendar from "./pages/events/Calendar";
import EventsStakeholders from "./pages/events/Stakeholders";
import Settings from "./pages/Settings";
import Library from "./pages/Library";
import SystemProfiles from "./pages/system/Profiles";
import HistoryLog from "./pages/system/HistoryLog";
import SystemTags from "./pages/system/Tags";
import RolesPermissions from "./pages/system/RolesPermissions";
import ReportTemplates from "./pages/reporting/Templates";
import TemplateEditor from "./pages/reporting/TemplateEditor";
import Reports from "./pages/reporting/Reports";
import ReportEditor from "./pages/reporting/ReportEditor";
import NotFound from "./pages/NotFound";


import { InstallPrompt } from "./components/InstallPrompt";
import { CohortProvider } from "./contexts/CohortContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SectionGate } from "./components/permissions/SectionGate";
import type { PermissionSection } from "./hooks/usePermissions";

const queryClient = new QueryClient();

const gated = (section: PermissionSection, element: React.ReactNode) => (
  <MainLayout><SectionGate section={section}>{element}</SectionGate></MainLayout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <CohortProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<MainLayout><Home /></MainLayout>} />
          <Route path="/operations" element={gated("budget", <OperationsDashboard />)} />

          <Route path="/operations/budget-lines" element={gated("budget_lines", <BudgetLines />)} />
          <Route path="/operations/expenses" element={gated("expenses", <Expenses />)} />
          <Route path="/operations/stipends" element={gated("stipends", <Stipends />)} />
          <Route path="/operations/contracts" element={gated("contracts", <OperationsContracts />)} />
          <Route path="/operations/tasks" element={gated("tasks", <OperationsTasks />)} />

          <Route path="/events" element={gated("events", <EventsCalendar />)} />
          <Route path="/events/stakeholders" element={gated("stakeholders", <EventsStakeholders />)} />
          <Route path="/founders" element={gated("founders", <FoundersSource />)} />
          <Route path="/founders/tracking" element={gated("tracking", <FoundersTracking />)} />
          <Route path="/founders/portfolio" element={gated("portfolio", <PortfolioDashboard />)} />
          <Route path="/founders/evaluations" element={gated("evaluations", <FoundersEvaluations />)} />
          <Route path="/settings" element={gated("settings", <Settings />)} />
          <Route path="/library" element={gated("library", <Library moduleName="All" />)} />
          <Route path="/system/profiles" element={gated("team", <SystemProfiles />)} />
          <Route path="/system/history" element={gated("history", <HistoryLog />)} />
          <Route path="/system/tags" element={gated("settings", <SystemTags />)} />
          <Route path="/system/roles" element={<MainLayout><RolesPermissions /></MainLayout>} />
          <Route path="/reporting/templates" element={gated("reporting", <ReportTemplates />)} />
          <Route path="/reporting/templates/:id" element={gated("reporting", <TemplateEditor />)} />
          <Route path="/reporting/reports" element={gated("reporting", <Reports />)} />
          <Route path="/reporting/reports/:id" element={gated("reporting", <ReportEditor />)} />


        <Route path="*" element={<NotFound />} />

        </Routes>
        <InstallPrompt />
      </BrowserRouter>
      </TooltipProvider>
    </CohortProvider>
  </QueryClientProvider>
);

export default App;
