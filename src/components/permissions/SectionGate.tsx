import { Lock } from "lucide-react";
import { usePermissions, type PermissionSection } from "@/hooks/usePermissions";

interface SectionGateProps {
  section: PermissionSection;
  children: React.ReactNode;
}

/** Wraps a page's content. Shows a clean 'no access' message when can_view is false. */
export function SectionGate({ section, children }: SectionGateProps) {
  const { canView, loading } = usePermissions();
  if (loading) return <>{children}</>;
  if (canView(section)) return <>{children}</>;
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border border-border bg-secondary flex items-center justify-center">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-xl text-ink mb-2">You don't have access to this page</h2>
        <p className="text-sm text-muted-foreground">
          Your role doesn't permit viewing this section. Contact a Super Admin if you believe this is a mistake.
        </p>
      </div>
    </div>
  );
}
