import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { EventsSidebar } from "@/components/EventsSidebar";
import { GlobalTopBar } from "@/components/GlobalTopBar";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

export function EventsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <GlobalTopBar />
      <SidebarProvider>
        <div className="flex-1 flex w-full">
          <EventsSidebar />
          <div className="flex-1 flex flex-col">
            <div className="h-10 flex items-center border-b border-border px-4">
              <SidebarTrigger />
            </div>
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}
