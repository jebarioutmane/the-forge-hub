import { useEffect, useRef } from "react";

/**
 * Soft radial glow that follows the cursor. Fixed, full-screen,
 * pointer-events-none. Removeable by unmounting this component.
 */
export function CursorSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    const apply = () => {
      raf = 0;
      el.style.background = `radial-gradient(circle 320px at ${x}px ${y}px, rgba(26,77,143,0.10), rgba(26,77,143,0) 70%)`;
    };

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9998]"
      style={{ mixBlendMode: "normal" }}
    />
  );
}

export default CursorSpotlight;
