import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { OperationsLayout } from "./components/OperationsLayout";
import { FoundersLayout } from "./components/FoundersLayout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import OperationsDashboard from "./pages/operations/Dashboard";
import Source from "./pages/operations/Source";
import Stipends from "./pages/operations/Stipends";
import OperationsContracts from "./pages/operations/Contracts";
import OperationsTasks from "./pages/operations/Tasks";
import FoundersSource from "./pages/founders/Source";
import FoundersTracking from "./pages/founders/Tracking";
import Events from "./pages/Events";
import Mentoring from "./pages/Mentoring";
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
          <Route path="/events" element={<Layout><Events /></Layout>} />
          <Route path="/mentoring" element={<Layout><Mentoring /></Layout>} />
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
