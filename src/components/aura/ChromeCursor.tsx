import { useEffect, useRef } from "react";

/**
 * A barely-visible grayscale radial light that follows the pointer,
 * evoking reflected light on polished metal. Not an RGB gaming glow.
 * Disabled on touch devices and when reduced motion is preferred.
 */
export default function ChromeCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduced || coarse) return;

    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    const render = () => {
      el.style.transform = `translate3d(${x - 300}px, ${y - 300}px, 0)`;
      raf = requestAnimationFrame(render);
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[2] h-[600px] w-[600px] rounded-full"
      style={{
        background:
          "radial-gradient(circle, rgba(255,255,255,0.045) 0%, rgba(191,192,194,0.02) 35%, transparent 62%)",
      }}
    />
  );
}