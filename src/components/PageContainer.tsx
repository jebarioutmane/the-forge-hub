import { cn } from "@/lib/utils";

/**
 * The single page wrapper. Owns all horizontal rhythm for routed pages.
 * No page should set its own outer padding or max-width.
 */
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1600px] px-8 py-6", className)}>
      {children}
    </div>
  );
}

export default PageContainer;
