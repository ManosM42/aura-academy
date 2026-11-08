// src/components/aura/portfolio/NewPostModal.tsx
import { useEffect, useRef, useState, type DragEvent } from "react";
import { motion } from "motion/react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { CAPTION_MAX, publishPost, type PortfolioPost } from "@/lib/portfolio";

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export default function NewPostModal({
  userId,
  onClose,
  onPublished,
}: {
  userId: string;
  onClose: () => void;
  onPublished: (post: PortfolioPost) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  function pick(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Διάλεξε αρχείο εικόνας (JPG, PNG ή WebP).");
      return;
    }
    if (f.size > MAX_INPUT_BYTES) {
      setError("Η φωτογραφία είναι πολύ μεγάλη (έως 25 MB).");
      return;
    }
    setFile(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  async function publish() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const post = await publishPost(userId, file, caption);
      onPublished(post);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Το post δεν δημοσιεύτηκε.");
      setBusy(false);
    }
  }

  return (
    <div className="pf-modal-layer" onPointerDown={() => !busy && onClose()}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pf-newpost-title"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="pf-modal pf-modal-wide"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="pf-newpost-title" className="pf-title text-xl font-bold tracking-tight">
            Νέο post
          </h2>
          <button type="button" className="pf-iconbtn" style={{ width: 34, height: 34 }} onClick={onClose} disabled={busy} aria-label="Κλείσιμο">
            <X className="size-4" />
          </button>
        </div>

        <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0])} />

        <div className="mt-5">
          {preview ? (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
              <img src={preview} alt="Προεπισκόπηση" className="mx-auto max-h-[46vh] w-auto object-contain" />
              <button
                type="button"
                className="pf-btn absolute bottom-3 right-3"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                Αλλαγή
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              className={`pf-drop ${dragging ? "pf-drop-on" : ""}`}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div>
                <ImagePlus className="mx-auto size-9 text-white/70" />
                <p className="mt-3 text-sm text-white/80">Σύρε εδώ μια φωτογραφία ή πάτα για επιλογή</p>
                <p className="mt-1 text-xs text-white/40">JPG, PNG ή WebP · θα βελτιστοποιηθεί αυτόματα</p>
              </div>
            </div>
          )}
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/45">
            Περιγραφή
            <span className="normal-case tracking-normal">
              {caption.length}/{CAPTION_MAX}
            </span>
          </span>
          <textarea
            className="pf-input min-h-[96px] resize-y"
            placeholder="Πες λίγα λόγια: τεχνική, εργαλεία, ιστορία του κουρέματος…"
            value={caption}
            maxLength={CAPTION_MAX}
            onChange={(e) => setCaption(e.target.value)}
            disabled={busy}
          />
        </label>

        {error && (
          <p className="pf-toast mt-4" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button type="button" className="pf-btn pf-btn-solid flex-1 py-3" onClick={() => void publish()} disabled={!file || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Δημοσίευση…" : "ΔΗΜΟΣΙΕΥΣΗ"}
          </button>
          <button type="button" className="pf-btn" onClick={onClose} disabled={busy}>
            Άκυρο
          </button>
        </div>
      </motion.div>
    </div>
  );
}