import { usePermissions, type PermissionSection } from "@/hooks/usePermissions";

interface SensitiveProps {
  section: PermissionSection;
  value: React.ReactNode;
  /** Optional custom placeholder. */
  placeholder?: React.ReactNode;
  className?: string;
}

/**
 * Renders `value` when the current role can_see_sensitive for the section,
 * otherwise a subtle '•••• (restricted)' placeholder.
 */
export function Sensitive({ section, value, placeholder, className }: SensitiveProps) {
  const { canSeeSensitive } = usePermissions();
  if (canSeeSensitive(section)) return <>{value}</>;
  return (
    <span className={"text-muted-foreground italic " + (className ?? "")}>
      {placeholder ?? "•••• (restricted)"}
    </span>
  );
}

/** Boolean helper for cases where JSX substitution isn't possible. */
export function useCanSeeSensitive(section: PermissionSection) {
  return usePermissions().canSeeSensitive(section);
}
