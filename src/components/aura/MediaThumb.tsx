import { useEffect, useState } from "react";
import { signedMediaUrl } from "@/lib/queries";

const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i;

export function MediaThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setError(false);
    signedMediaUrl(path)
      .then((u) => active && setUrl(u))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [path]);

  if (error) {
    return (
      <div className="flex h-28 w-full items-center justify-center rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-300">
        Αποτυχία φόρτωσης
      </div>
    );
  }

  if (!url) {
    return <div className="h-28 w-full animate-pulse rounded-lg bg-white/5" />;
  }

  if (VIDEO_RE.test(path)) {
    return (
      <video
        src={url}
        controls
        className="h-28 w-full rounded-lg bg-black object-cover"
      />
    );
  }

  return (
    <img
      src={url}
      alt="Submission media"
      className="h-28 w-full rounded-lg object-cover"
      loading="lazy"
    />
  );
}