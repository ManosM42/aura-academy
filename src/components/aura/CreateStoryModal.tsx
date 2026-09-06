import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera, Images, Loader2, X, Type, Pencil, Music2, Sparkles, Check, Trash2,
} from "lucide-react";
import { createStory } from "@/lib/queries";

type Tool = null | "text" | "draw" | "music" | "filters";

interface TextLayer {
  id: string;
  text: string;
  xPct: number; // 0-1, center point
  yPct: number;
  color: string;
  fontSize: number;
  background: boolean;
}

interface StrokePoint { x: number; y: number }
interface Stroke { color: string; width: number; points: StrokePoint[] }

const FILTERS: { name: string; css: string }[] = [
  { name: "Κανονικό", css: "none" },
  { name: "Clarendon", css: "contrast(1.2) saturate(1.35) brightness(1.05)" },
  { name: "Ζωηρό", css: "saturate(1.6) contrast(1.1)" },
  { name: "Θερμό", css: "sepia(0.25) saturate(1.3) brightness(1.05)" },
  { name: "Ψυχρό", css: "hue-rotate(-10deg) saturate(1.15) brightness(1.02)" },
  { name: "Noir", css: "grayscale(1) contrast(1.15)" },
  { name: "Ξεθωριασμένο", css: "contrast(0.9) brightness(1.1) saturate(0.75)" },
];

const TEXT_COLORS = ["#ffffff", "#000000", "#ef4444", "#eab308", "#22c55e", "#3b82f6", "#ec4899"];
const DRAW_COLORS = ["#ffffff", "#000000", "#ef4444", "#eab308", "#22c55e", "#3b82f6", "#ec4899"];

export default function CreateStoryModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [tool, setTool] = useState<Tool>(null);
  const [filter, setFilter] = useState(FILTERS[0]);

  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [draftText, setDraftText] = useState("");
  const [draftColor, setDraftColor] = useState(TEXT_COLORS[0]);
  const [draftBg, setDraftBg] = useState(false);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [brushSize, setBrushSize] = useState(6);
  const currentStroke = useRef<Stroke | null>(null);
  const drawingRef = useRef(false);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioTitle, setAudioTitle] = useState("");

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  const isVideo = file?.type.startsWith("video/") ?? false;

  function resetAll() {
    setFile(null);
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setMediaUrl(null);
    setTool(null);
    setFilter(FILTERS[0]);
    setTextLayers([]);
    setDraftText("");
    setDraftBg(false);
    setStrokes([]);
    setAudioFile(null);
    setAudioTitle("");
    setErr(null);
    setBusy(false);
  }

  function pick(f: File | null) {
    setErr(null);
    setFile(f);
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setMediaUrl(f ? URL.createObjectURL(f) : null);
  }

  // --- draw canvas sizing: keep pixel size in sync with displayed box ---
  useEffect(() => {
    if (!containerRef.current || !drawCanvasRef.current) return;
    const el = containerRef.current;
    const canvas = drawCanvasRef.current;
    const resize = () => {
      canvas.width = el.clientWidth;
      canvas.height = el.clientHeight;
      redrawCanvas();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaUrl]);

  function redrawCanvas() {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      drawStroke(ctx, stroke, canvas.width, canvas.height);
    }
  }

  function drawStroke(
    ctx: CanvasRenderingContext2D,
    stroke: Stroke,
    w: number,
    h: number,
  ) {
    if (stroke.points.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
    for (const p of stroke.points.slice(1)) {
      ctx.lineTo(p.x * w, p.y * h);
    }
    ctx.stroke();
  }

  useEffect(() => {
    redrawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  function relativePos(e: React.PointerEvent) {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function handleDrawStart(e: React.PointerEvent) {
    if (tool !== "draw") return;
    drawingRef.current = true;
    const p = relativePos(e);
    currentStroke.current = { color: drawColor, width: brushSize / 200, points: [p] };
  }
  function handleDrawMove(e: React.PointerEvent) {
    if (!drawingRef.current || !currentStroke.current) return;
    const p = relativePos(e);
    currentStroke.current.points.push(p);
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      redrawCanvas();
      drawStroke(ctx, currentStroke.current, canvas.width, canvas.height);
    }
  }
  function handleDrawEnd() {
    if (currentStroke.current && currentStroke.current.points.length > 1) {
      setStrokes((s) => [...s, currentStroke.current!]);
    }
    currentStroke.current = null;
    drawingRef.current = false;
  }

  // --- text layer dragging ---
  function startDragText(id: string, e: React.PointerEvent) {
    if (tool === "draw") return;
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const xPct = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const yPct = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
      setTextLayers((layers) =>
        layers.map((l) => (l.id === id ? { ...l, xPct, yPct } : l)),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function addTextLayer() {
    if (!draftText.trim()) {
      setTool(null);
      return;
    }
    setTextLayers((l) => [
      ...l,
      {
        id: crypto.randomUUID(),
        text: draftText.trim(),
        xPct: 0.5,
        yPct: 0.5,
        color: draftColor,
        fontSize: 32,
        background: draftBg,
      },
    ]);
    setDraftText("");
    setDraftBg(false);
    setTool(null);
  }

  function removeTextLayer(id: string) {
    setTextLayers((l) => l.filter((t) => t.id !== id));
  }

  // --- compositing (images only) ---
  async function compositeImage(): Promise<Blob> {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = mediaUrl!;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    const targetW = 1080;
    const targetH = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d")!;

    // black backdrop, object-contain style fit
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, targetW, targetH);

    const scale = Math.min(targetW / img.width, targetH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = (targetW - drawW) / 2;
    const dy = (targetH - drawH) / 2;

    ctx.filter = filter.css;
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.filter = "none";

    // drawing layer (scaled from the live preview canvas, which used relative 0-1 coords)
    for (const stroke of strokes) {
      drawStroke(ctx, { ...stroke, width: stroke.width * targetH }, targetW, targetH);
    }

    // text layers
    for (const t of textLayers) {
      const fontPx = (t.fontSize / 360) * targetH; // fontSize was tuned for ~360-wide preview box
      ctx.font = `700 ${fontPx}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const x = t.xPct * targetW;
      const y = t.yPct * targetH;

      if (t.background) {
        const metrics = ctx.measureText(t.text);
        const padX = fontPx * 0.4;
        const padY = fontPx * 0.3;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(
          x - metrics.width / 2 - padX,
          y - fontPx / 2 - padY,
          metrics.width + padX * 2,
          fontPx + padY * 2,
        );
      }

      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, y);
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Αποτυχία εξαγωγής εικόνας."))),
        "image/jpeg",
        0.92,
      );
    });
  }

  async function handleShare() {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      let finalFile: File;
      if (isVideo) {
        // Video: no client-side re-encoding here — text/draw/filter are disabled
        // for video (see the UI below), so the original file is uploaded as-is.
        finalFile = file;
      } else {
        const blob = await compositeImage();
        finalFile = new File([blob], "story.jpg", { type: "image/jpeg" });
      }

      const audio = audioFile ? { file: audioFile, title: audioTitle || audioFile.name } : null;
      await createStory(finalFile, audio);
      resetAll();
      onCreated();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black"
        >
          {!mediaUrl ? (
            // --- Step 1: pick source ---
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0a0a0a] p-6 shadow-2xl"
            >
              <button
                onClick={() => { resetAll(); onClose(); }}
                className="absolute right-4 top-4 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
              <h2 className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-white">
                Νέο Story
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] py-8 text-white/80 transition hover:border-white/40 hover:bg-white/[0.08] hover:text-white"
                >
                  <Camera size={22} />
                  <span className="text-xs font-medium">Κάμερα</span>
                </button>
                <button
                  onClick={() => libraryInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] py-8 text-white/80 transition hover:border-white/40 hover:bg-white/[0.08] hover:text-white"
                >
                  <Images size={22} />
                  <span className="text-xs font-medium">Βιβλιοθήκη</span>
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                <input ref={libraryInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
              </div>
            </motion.div>
          ) : (
            // --- Step 2: full-screen editor ---
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative flex h-full w-full max-w-md flex-col bg-black sm:h-[92vh] sm:rounded-2xl sm:overflow-hidden"
            >
              {/* top bar */}
              <div className="z-20 flex items-center justify-between px-3 pt-4">
                <button
                  onClick={() => { resetAll(); }}
                  className="rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
                >
                  <X size={20} />
                </button>
                <div className="flex gap-2">
                  <ToolButton icon={<Type size={18} />} active={tool === "text"} onClick={() => setTool(tool === "text" ? null : "text")} disabled={isVideo} />
                  <ToolButton icon={<Pencil size={18} />} active={tool === "draw"} onClick={() => setTool(tool === "draw" ? null : "draw")} disabled={isVideo} />
                  <ToolButton icon={<Music2 size={18} />} active={tool === "music"} onClick={() => setTool(tool === "music" ? null : "music")} />
                  <ToolButton icon={<Sparkles size={18} />} active={tool === "filters"} onClick={() => setTool(tool === "filters" ? null : "filters")} disabled={isVideo} />
                </div>
                <div className="w-9" />
              </div>

              {isVideo && (
                <p className="z-20 px-4 pt-2 text-center text-[11px] text-white/40">
                  Κείμενο, σχέδιο και φίλτρα είναι διαθέσιμα μόνο για φωτογραφίες.
                </p>
              )}

              {/* media stage */}
              <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                <div
                  ref={containerRef}
                  className="relative aspect-[9/16] max-h-full w-full max-w-sm overflow-hidden bg-black touch-none"
                  onPointerDown={handleDrawStart}
                  onPointerMove={handleDrawMove}
                  onPointerUp={handleDrawEnd}
                  onPointerLeave={handleDrawEnd}
                >
                  {isVideo ? (
                    <video src={mediaUrl} className="h-full w-full object-contain" style={{ filter: filter.css }} autoPlay loop muted playsInline />
                  ) : (
                    <img src={mediaUrl} className="h-full w-full object-contain" style={{ filter: filter.css }} alt="" />
                  )}

                  <canvas
                    ref={drawCanvasRef}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  />

                  {textLayers.map((t) => (
                    <div
                      key={t.id}
                      onPointerDown={(e) => startDragText(t.id, e)}
                      className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-move select-none px-1"
                      style={{ left: `${t.xPct * 100}%`, top: `${t.yPct * 100}%` }}
                    >
                      <span
                        className="whitespace-nowrap font-bold"
                        style={{
                          color: t.color,
                          fontSize: t.fontSize,
                          background: t.background ? "rgba(0,0,0,0.55)" : "transparent",
                          padding: t.background ? "4px 10px" : 0,
                          borderRadius: t.background ? 8 : 0,
                        }}
                      >
                        {t.text}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTextLayer(t.id); }}
                        className="absolute -right-2 -top-2 hidden rounded-full bg-white p-0.5 text-black group-hover:block"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}

                  {audioFile && tool !== "music" && (
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur">
                      <Music2 size={12} />
                      <span className="max-w-[140px] truncate">{audioTitle || audioFile.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* tool panels */}
              <div className="z-20 bg-gradient-to-t from-black via-black/95 to-transparent px-4 pb-6 pt-3">
                {tool === "text" && (
                  <div className="space-y-3">
                    <input
                      autoFocus
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder="Πρόσθεσε κείμενο…"
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center text-white outline-none placeholder:text-white/40"
                    />
                    <div className="flex items-center justify-center gap-2">
                      {TEXT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setDraftColor(c)}
                          className={`h-6 w-6 rounded-full ring-2 ${draftColor === c ? "ring-white" : "ring-transparent"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <button
                        onClick={() => setDraftBg((b) => !b)}
                        className={`ml-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${draftBg ? "border-white bg-white text-black" : "border-white/30 text-white/70"}`}
                      >
                        Aa
                      </button>
                    </div>
                    <button
                      onClick={addTextLayer}
                      className="mx-auto flex items-center gap-1 rounded-full bg-white px-5 py-2 text-xs font-bold uppercase text-black"
                    >
                      <Check size={14} /> Ολοκλήρωση
                    </button>
                  </div>
                )}

                {tool === "draw" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      {DRAW_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setDrawColor(c)}
                          className={`h-6 w-6 rounded-full ring-2 ${drawColor === c ? "ring-white" : "ring-transparent"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={24}
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full accent-white"
                    />
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => setStrokes((s) => s.slice(0, -1))}
                        disabled={strokes.length === 0}
                        className="flex items-center gap-1 rounded-full border border-white/25 px-4 py-1.5 text-[11px] text-white/80 disabled:opacity-30"
                      >
                        <Trash2 size={12} /> Αναίρεση
                      </button>
                      <button
                        onClick={() => setTool(null)}
                        className="flex items-center gap-1 rounded-full bg-white px-5 py-1.5 text-[11px] font-bold uppercase text-black"
                      >
                        <Check size={12} /> Έτοιμο
                      </button>
                    </div>
                  </div>
                )}

                {tool === "filters" && (
                  <div className="scrollbar-none flex gap-3 overflow-x-auto pb-1">
                    {FILTERS.map((f) => (
                      <button
                        key={f.name}
                        onClick={() => setFilter(f)}
                        className="flex shrink-0 flex-col items-center gap-1"
                      >
                        <div
                          className={`h-14 w-14 overflow-hidden rounded-lg border-2 ${filter.name === f.name ? "border-white" : "border-white/20"}`}
                          style={{ filter: f.css }}
                        >
                          {mediaUrl && !isVideo && (
                            <img src={mediaUrl} className="h-full w-full object-cover" alt="" />
                          )}
                        </div>
                        <span className="text-[10px] text-white/70">{f.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {tool === "music" && (
                  <div className="space-y-3">
                    <p className="text-center text-[11px] text-white/50">
                      Ανέβασε δικό σου κομμάτι — δεν υποστηρίζεται αναζήτηση σε κατάλογο τραγουδιών.
                    </p>
                    {!audioFile ? (
                      <button
                        onClick={() => audioInputRef.current?.click()}
                        className="mx-auto flex items-center gap-2 rounded-full border border-white/25 px-5 py-2 text-xs font-bold uppercase text-white/80 hover:border-white/50"
                      >
                        <Music2 size={14} /> Επιλογή αρχείου ήχου
                      </button>
                    ) : (
                      <div className="flex items-center justify-between rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2">
                        <input
                          value={audioTitle}
                          onChange={(e) => setAudioTitle(e.target.value)}
                          placeholder={audioFile.name}
                          className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
                        />
                        <button
                          onClick={() => { setAudioFile(null); setAudioTitle(""); }}
                          className="ml-2 text-white/50 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setAudioFile(f);
                        if (f) setAudioTitle(f.name.replace(/\.[^.]+$/, ""));
                      }}
                    />
                    <div className="flex justify-center">
                      <button
                        onClick={() => setTool(null)}
                        className="rounded-full bg-white px-5 py-1.5 text-[11px] font-bold uppercase text-black"
                      >
                        Έτοιμο
                      </button>
                    </div>
                  </div>
                )}

                {tool === null && (
                  <>
                    {err && <p className="mb-2 text-center text-xs text-rose-400">{err}</p>}
                    <button
                      onClick={handleShare}
                      disabled={busy}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-white/90 disabled:opacity-40"
                    >
                      {busy && <Loader2 size={14} className="animate-spin" />}
                      Το Story σου
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToolButton({
  icon, active, onClick, disabled,
}: { icon: React.ReactNode; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full p-2 transition ${
        active ? "bg-white text-black" : "bg-black/40 text-white hover:bg-black/60"
      } disabled:opacity-30`}
    >
      {icon}
    </button>
  );
}