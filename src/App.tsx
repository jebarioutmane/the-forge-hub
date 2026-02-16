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
import Stipends from "./pages/operations/Stipends";
import OperationsContracts from "./pages/operations/Contracts";
import OperationsTasks from "./pages/operations/Tasks";
import FoundersSource from "./pages/founders/Source";
import FoundersTracking from "./pages/founders/Tracking";
import EventsTimeline from "./pages/events/Timeline";
import EventsPlanning from "./pages/events/Planning";
import EventsMentoring from "./pages/events/Mentoring";
import Settings from "./pages/Settings";
import Library from "./pages/Library";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<MainLayout><Home /></MainLayout>} />
          <Route path="/operations" element={<MainLayout><OperationsDashboard /></MainLayout>} />
          <Route path="/operations/source" element={<MainLayout><Source /></MainLayout>} />
          <Route path="/operations/stipends" element={<MainLayout><Stipends /></MainLayout>} />
          <Route path="/operations/contracts" element={<MainLayout><OperationsContracts /></MainLayout>} />
          <Route path="/operations/tasks" element={<MainLayout><OperationsTasks /></MainLayout>} />
          <Route path="/events" element={<MainLayout><EventsTimeline /></MainLayout>} />
          <Route path="/events/planning" element={<MainLayout><EventsPlanning /></MainLayout>} />
          <Route path="/events/mentoring" element={<MainLayout><EventsMentoring /></MainLayout>} />
          <Route path="/founders" element={<MainLayout><FoundersSource /></MainLayout>} />
          <Route path="/founders/tracking" element={<MainLayout><FoundersTracking /></MainLayout>} />
          <Route path="/settings" element={<MainLayout><Settings /></MainLayout>} />
          <Route path="/library" element={<MainLayout><Library moduleName="All" /></MainLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
