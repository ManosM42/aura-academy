// src/components/aura/AuraAvatar.tsx
interface AuraAvatarProps {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}

function initials(name?: string | null, email?: string | null) {
  const source = (name && name.trim()) || (email ? email.split("@")[0] : "");
  if (!source) return "A";
  const parts = source.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "A";
}

export default function AuraAvatar({
  name,
  email,
  src,
  size = 40,
  className = "",
}: AuraAvatarProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-aura-elevated ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: "0 0 18px -6px rgba(255,255,255,0.35)",
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name ?? email ?? "Avatar"}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className="chrome-text font-aura font-semibold leading-none"
          style={{ fontSize: size * 0.36 }}
        >
          {initials(name, email)}
        </span>
      )}
    </span>
  );
}