import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { OperationsLayout } from "./components/OperationsLayout";
import { FoundersLayout } from "./components/FoundersLayout";
import { EventsLayout } from "./components/EventsLayout";
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
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
          <Route path="/events" element={<EventsLayout><EventsTimeline /></EventsLayout>} />
          <Route path="/events/planning" element={<EventsLayout><EventsPlanning /></EventsLayout>} />
          <Route path="/events/mentoring" element={<EventsLayout><EventsMentoring /></EventsLayout>} />
          <Route path="/operations" element={<OperationsLayout><OperationsDashboard /></OperationsLayout>} />
          <Route path="/operations/source" element={<OperationsLayout><Source /></OperationsLayout>} />
          <Route path="/operations/stipends" element={<OperationsLayout><Stipends /></OperationsLayout>} />
          <Route path="/operations/contracts" element={<OperationsLayout><OperationsContracts /></OperationsLayout>} />
          <Route path="/operations/tasks" element={<OperationsLayout><OperationsTasks /></OperationsLayout>} />
          <Route path="/founders" element={<FoundersLayout><FoundersSource /></FoundersLayout>} />
          <Route path="/founders/tracking" element={<FoundersLayout><FoundersTracking /></FoundersLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
