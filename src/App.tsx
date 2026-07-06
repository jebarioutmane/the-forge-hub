import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/MainLayout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import OperationsDashboard from "./pages/operations/Dashboard";
import Source from "./pages/operations/Source";
import Expenses from "./pages/operations/Expenses";
import Stipends from "./pages/operations/Stipends";
import OperationsContracts from "./pages/operations/Contracts";
import BudgetLines from "./pages/operations/BudgetLines";


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
import NotFound from "./pages/NotFound";
import { InstallPrompt } from "./components/InstallPrompt";
import { CohortProvider } from "./contexts/CohortContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CohortProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<MainLayout><Home /></MainLayout>} />
          <Route path="/operations" element={<MainLayout><OperationsDashboard /></MainLayout>} />
          
          <Route path="/operations/source" element={<MainLayout><Source /></MainLayout>} />
          <Route path="/operations/expenses" element={<MainLayout><Expenses /></MainLayout>} />
          <Route path="/operations/stipends" element={<MainLayout><Stipends /></MainLayout>} />
          <Route path="/operations/contracts" element={<MainLayout><OperationsContracts /></MainLayout>} />
          
          <Route path="/events" element={<MainLayout><EventsCalendar /></MainLayout>} />
          <Route path="/events/stakeholders" element={<MainLayout><EventsStakeholders /></MainLayout>} />
          <Route path="/founders" element={<MainLayout><FoundersSource /></MainLayout>} />
          <Route path="/founders/tracking" element={<MainLayout><FoundersTracking /></MainLayout>} />
          <Route path="/founders/portfolio" element={<MainLayout><PortfolioDashboard /></MainLayout>} />
          <Route path="/founders/evaluations" element={<MainLayout><FoundersEvaluations /></MainLayout>} />
          <Route path="/settings" element={<MainLayout><Settings /></MainLayout>} />
          <Route path="/library" element={<MainLayout><Library moduleName="All" /></MainLayout>} />
          <Route path="/system/profiles" element={<MainLayout><SystemProfiles /></MainLayout>} />
          <Route path="/system/history" element={<MainLayout><HistoryLog /></MainLayout>} />
        <Route path="*" element={<NotFound />} />
        </Routes>
        <InstallPrompt />
      </BrowserRouter>
      </TooltipProvider>
    </CohortProvider>
  </QueryClientProvider>
);

export default App;
