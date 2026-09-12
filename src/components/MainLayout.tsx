import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { TopNav } from "@/components/TopNav";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="pt-12">{children}</main>
    </div>
  );
}
