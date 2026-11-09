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

export default function ChristmasSnow({ count = 110, zIndex = 40, onlyInWinter = false }: ChristmasSnowProps) {
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
      flake="mixed" // real crystal shapes, from tiny soft dots to detailed stars
      count={flakes}
      size={[3, 9]} // a bit bigger than before, still delicate
      speed={0.9}
      wind={0.35} // a light breeze
      sway={1.5} // natural side-to-side flutter
      spin={0.8}
      depth={1} // full depth of field: far flakes small, slow and blurry; near ones sharp
      opacity={[0.25, 0.95]}
      colors={["#ffffff", "#f4f8ff", "#e3eeff", "#d6e6ff"]}
      zIndex={zIndex}
    />
  );
}