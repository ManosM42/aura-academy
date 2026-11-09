// src/components/aura/ChristmasSnow.tsx
//
// Gentle, small snowflakes for the Christmas vibe. Uses the `falling-snow` package
// (npm i falling-snow). The snow never blocks clicks and respects "reduce motion".
import { useEffect, useState } from "react";
import { Snowfall } from "falling-snow/react";
import { isWinter } from "falling-snow";

interface ChristmasSnowProps {
  /** Number of flakes on desktop (phones get ~60% of this). */
  count?: number;
  /**
   * Layer of the snow. 40 keeps it above the page but under the intro video and dialogs.
   * Use 9999 if you also want snow over the navbar.
   */
  zIndex?: number;
  /** Only snow in December, January and February (hides itself the rest of the year). */
  onlyInWinter?: boolean;
}

export default function ChristmasSnow({ count = 90, zIndex = 40, onlyInWinter = false }: ChristmasSnowProps) {
  const [flakes, setFlakes] = useState<number | null>(null);

  // Client only: decide the amount after mount (no server/client mismatch).
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 640px)");
    const apply = () => setFlakes(phone.matches ? Math.round(count * 0.6) : count);
    apply();
    phone.addEventListener("change", apply);
    return () => phone.removeEventListener("change", apply);
  }, [count]);

  if (flakes === null) return null;
  if (onlyInWinter && !isWinter()) return null;

  return (
    <Snowfall
      fullScreen
      flake="mixed"
      count={flakes}
      size={[2, 6]} // small flakes: the default goes up to 20px
      speed={0.75} // slow and calm
      wind={0.25}
      sway={1.1}
      spin={0.6}
      depth={0.7}
      opacity={[0.3, 0.85]}
      colors={["#ffffff", "#eaf4ff", "#dbe7ff"]}
      zIndex={zIndex}
    />
  );
}