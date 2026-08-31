// src/components/aura/AuraMark.tsx
import auraLogo from "@/assets/aura.JPG";

interface AuraMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<AuraMarkProps["size"]>, string> = {
  sm: "aura-mark-sm",
  md: "",
  lg: "aura-mark-lg",
};

/**
 * The AURA emblem: the brand image (aura.JPG) framed in a chrome disc with a
 * slow metallic light sweep. Used everywhere the mark appears EXCEPT the
 * navbars, which use logo.jpg directly.
 */
export default function AuraMark({ size = "md", className = "" }: AuraMarkProps) {
  return (
    <span
      className={`aura-mark ${SIZE_CLASS[size]} ${className}`}
      role="img"
      aria-label="AURA"
    >
      <img src={auraLogo} alt="" className="aura-mark-img" draggable={false} />
      <span className="aura-mark-sweep" aria-hidden />
    </span>
  );
}