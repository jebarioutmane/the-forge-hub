import { GlobalTopBar } from "@/components/GlobalTopBar";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

export function Layout({ children }: { children: React.ReactNode }) {
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
      <main className="flex-1">{children}</main>
    </div>
  );
}
