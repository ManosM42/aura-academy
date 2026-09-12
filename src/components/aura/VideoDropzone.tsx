// src/components/aura/VideoDropzone.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  getStepVideoUrl,
  readVideoDuration,
  removeCourseVideo,
  uploadCourseVideo,
} from "@/lib/courses";

export interface VideoUploadMeta {
  sizeBytes: number | null;
  mimeType: string | null;
  originalFilename: string | null;
  uploadedAt: string | null;
  storageProvider: "backblaze_b2";
}

interface VideoDropzoneProps {
  courseId: string;
  /** Real course_steps.id if this step is already saved; omit for a new,
   *  not-yet-saved step — the upload still works, B2 just namespaces it
   *  under a server-minted id until the step itself gets saved. */
  lessonId?: string | null;
  videoPath: string | null;
  onUploaded: (path: string, durationSeconds: number | null, meta: VideoUploadMeta) => void;
  onCleared: () => void;
  disabled?: boolean;
  label?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function VideoDropzone({
  courseId,
  lessonId = null,
  videoPath,
  onUploaded,
  onCleared,
  disabled = false,
  label = "ΒΙΝΤΕΟ ΒΗΜΑΤΟΣ",
}: VideoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Signed URL για preview του ήδη ανεβασμένου βίντεο.
  useEffect(() => {
    let cancelled = false;
    if (!videoPath) {
      setPreviewUrl(null);
      return;
    }
    void getStepVideoUrl(videoPath, courseId)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [videoPath, courseId]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
        setError("Δεκτά μόνο mp4, mov ή webm.");
        return;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        setError(
          `Το αρχείο είναι ${formatBytes(file.size)} — το όριο είναι ${Math.round(
            MAX_VIDEO_BYTES / (1024 * 1024 * 1024),
          )}GB.`,
        );
        return;
      }
      const duration = await readVideoDuration(file);
      if (duration !== null && duration > MAX_VIDEO_DURATION_SECONDS) {
        setError(
          `Το βίντεο διαρκεί ${Math.round(duration / 60)} λεπτά — το όριο είναι ${
            MAX_VIDEO_DURATION_SECONDS / 60
          } λεπτά.`,
        );
        return;
      }

      setUploading(true);
      setRatio(0);
      try {
        const result = await uploadCourseVideo(courseId, file, setRatio, lessonId);
        onUploaded(result.path, result.durationSeconds, {
          sizeBytes: result.sizeBytes,
          mimeType: result.mimeType,
          originalFilename: result.originalFilename,
          uploadedAt: result.uploadedAt,
          storageProvider: result.storageProvider,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Το upload απέτυχε.");
      } finally {
        setUploading(false);
      }
    },
    [courseId, lessonId, onUploaded],
  );

  const handleRemove = useCallback(async () => {
    if (!videoPath) return;
    setError(null);
    try {
      await removeCourseVideo(videoPath, courseId);
    } catch (err) {
      // Αν το object έχει ήδη χαθεί, δεν κρατάμε τον χρήστη όμηρο.
      console.error("Αποτυχία διαγραφής βίντεο:", err);
    }
    onCleared();
  }, [videoPath, courseId, onCleared]);

  const busy = uploading || disabled;

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-500">{label}</p>

      <AnimatePresence mode="wait">
        {videoPath ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent"
          >
            {previewUrl ? (
              <video
                src={previewUrl}
                controls
                preload="metadata"
                className="aspect-video w-full bg-black"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-black text-xs uppercase tracking-[0.3em] text-neutral-500">
                ΦΟΡΤΩΣΗ PREVIEW…
              </div>
            )}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="truncate text-xs text-neutral-400">{videoPath}</span>
              <button
                type="button"
                onClick={() => void handleRemove()}
                disabled={busy}
                className="shrink-0 rounded-full border border-white/15 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-neutral-300 transition hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:opacity-40"
              >
                ΑΦΑΙΡΕΣΗ
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (busy) return;
                const file = event.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              className={[
                "group relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center transition",
                dragging
                  ? "border-white/60 bg-white/[0.08]"
                  : "border-white/15 bg-white/[0.02] hover:border-white/35 hover:bg-white/[0.05]",
                busy ? "cursor-wait opacity-60" : "cursor-pointer",
              ].join(" ")}
              aria-label="Ανέβασε βίντεο βήματος"
            >
              <span className="text-xs uppercase tracking-[0.4em] text-neutral-300">
                {uploading ? "ΑΝΕΒΑΙΝΕΙ…" : "DROP MP4 ΕΔΩ"}
              </span>
              <span className="text-[11px] text-neutral-500">
                ή κάνε κλικ για επιλογή — mp4 / mov / webm, έως{" "}
                {Math.round(MAX_VIDEO_BYTES / (1024 * 1024 * 1024))}GB, έως{" "}
                {MAX_VIDEO_DURATION_SECONDS / 60}′
              </span>

              {uploading ? (
                <span
                  className="mt-3 block h-px w-56 overflow-hidden bg-white/10"
                  role="progressbar"
                  aria-label="Πρόοδος ανεβάσματος"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(ratio * 100)}
                >
                  <span
                    className="block h-full bg-gradient-to-r from-neutral-500 via-white to-neutral-500 transition-all duration-200"
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </span>
              ) : null}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleFile(file);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}