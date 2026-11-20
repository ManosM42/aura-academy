import { useEffect, useRef, useState } from "react";
import type { Viseme } from "@/lib/visemes";
import { BlinkController, buildEye, renderEye, type EyeRuntime } from "./eyeBlink";
import { buildMouth, renderMouth, type MouthRuntime } from "./mouthWarp";
import { EYES, FACE_ASPECT, FACE_FOCUS, FACE_SRC, MOUTH } from "./faceSpec";

// Πολύ διακριτική «αναπνοή»: κινείται ολόκληρη η εικόνα, άρα στόμα και μάτια μένουν ευθυγραμμισμένα
const BREATHE_CSS = `
@keyframes aura-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-1px) scale(1.0035); }
}
.aura-breathe { transform-origin: 50% 88%; animation: aura-breathe 5.8s ease-in-out infinite; will-change: transform; }
@media (prefers-reduced-motion: reduce) { .aura-breathe { animation: none; } }
`;

type Props = {
  getViseme: (now: number) => Viseme;
  src?: string;
  /** Το στοιχείο γεμίζει τον γονέα του. Δώσε του μέγεθος από έξω (π.χ. h-full w-full). */
  className?: string;
  /** "contain": όλη η εικόνα. "cover": γεμίζει το κουτί και κόβεται γύρω από το πρόσωπο (κινητό). */
  fit?: "contain" | "cover";
  /** Μαλακό σβήσιμο στο κάτω μέρος (χρήσιμο όταν η εικόνα κόβεται στο cover) */
  fadeBottom?: boolean;
  /** Η εικόνα έχει μαύρο φόντο: το «screen» το κάνει διάφανο πάνω στη σελίδα (default: true) */
  blend?: boolean;
  debug?: boolean;
  /** Φυσικό ανοιγοκλείσιμο ματιών, συνεχώς όσο η σελίδα είναι ανοιχτή (default: true) */
  blink?: boolean;
  /** Διακριτική κίνηση «αναπνοής» (default: true) */
  breathe?: boolean;
};

export default function AuraFace({
  getViseme,
  src = FACE_SRC,
  className = "h-full w-full",
  fit = "contain",
  fadeBottom = false,
  blend = true,
  debug = false,
  blink = true,
  breathe = true,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dbgRef = useRef<HTMLCanvasElement>(null);
  const getRef = useRef(getViseme);
  getRef.current = getViseme;
  const debugRef = useRef(debug);
  debugRef.current = debug;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    let raf = 0;
    let alive = true;
    setStatus("loading");

    const blinkCtl = new BlinkController();
    // Debug: πάτα το «B» για να δεις αμέσως ένα βλεφάρισμα
    const onKey = (ev: KeyboardEvent) => {
      if (debugRef.current && ev.key.toLowerCase() === "b") blinkCtl.trigger(performance.now());
    };
    window.addEventListener("keydown", onKey);

    img.onerror = () => alive && setStatus("error");
    img.onload = () => {
      if (!alive) return;
      const W = (canvas.width = img.naturalWidth);
      const H = (canvas.height = img.naturalHeight);
      ctx.drawImage(img, 0, 0);
      setStatus("ready");

      const aspectOk = Math.abs(W / H - FACE_ASPECT) < 0.02;
      if (!aspectOk) {
        console.warn("AuraFace: η εικόνα δεν έχει την αναλογία που περιμένει το faceSpec.ts, οι κινήσεις απενεργοποιήθηκαν.");
      }

      // ── Προετοιμασία ματιών και στόματος ────────────────────────────────
      const getRegion = (x: number, y: number, w: number, h: number) => ctx.getImageData(x, y, w, h).data;
      let eyes: { e: EyeRuntime; buf: ImageData }[] = [];
      let mouth: { m: MouthRuntime; buf: ImageData } | null = null;
      if (aspectOk) {
        try {
          const m = buildMouth(MOUTH, W, H, getRegion);
          mouth = { m, buf: ctx.createImageData(m.w, m.h) };
          if (blink) {
            eyes = EYES.map((spec) => {
              const e = buildEye(spec, W, H, getRegion);
              return { e, buf: ctx.createImageData(e.w, e.h) };
            });
          }
        } catch (err) {
          console.warn("AuraFace: οι κινήσεις απενεργοποιήθηκαν", err);
          mouth = null;
          eyes = [];
        }
      }

      let eyesDirty = false;
      let mouthDirty = false;
      let wasTalking = false;
      let open = 0;
      let width = 1;

      // Προσαρμοστική απόδοση: σε αργές συσκευές το στόμα ανανεώνεται κάθε δεύτερο frame
      let avgMs = 0;
      let throttled = false;
      let tick = 0;

      const frame = (now: number) => {
        if (!alive) return;
        const v = getRef.current(now);
        open += (v.open - open) * 0.35;
        width += (v.width - width) * 0.35;

        // ── Μάτια: τρέχουν σε κάθε frame, ανεξάρτητα από το αν μιλά ─────────
        if (eyes.length) {
          const talking = open * (mouth ? mouth.m.maxOpen : 1) > 0.4;
          if (talking && !wasTalking) blinkCtl.nudge(now);
          wasTalking = talking;
          const c = blinkCtl.update(now, talking);
          if (c > 0.002) {
            for (const { e, buf } of eyes) {
              renderEye(e, c, buf.data);
              ctx.putImageData(buf, e.rx, e.ry);
            }
            eyesDirty = true;
          } else if (eyesDirty) {
            for (const { e, buf } of eyes) {
              buf.data.set(e.orig);
              ctx.putImageData(buf, e.rx, e.ry);
            }
            eyesDirty = false;
          }
        }

        // ── Στόμα ───────────────────────────────────────────────────────────
        if (mouth) {
          tick++;
          if (!(throttled && tick % 2 === 1)) {
            const t0 = performance.now();
            const drawn = renderMouth(mouth.m, open, width, mouth.buf.data);
            if (drawn) {
              ctx.putImageData(mouth.buf, mouth.m.rx, mouth.m.ry);
              mouthDirty = true;
              const dt = performance.now() - t0;
              avgMs = avgMs * 0.9 + dt * 0.1;
              if (avgMs > 9) throttled = true;
              else if (avgMs < 5.5) throttled = false;
            } else if (mouthDirty) {
              mouth.buf.data.set(mouth.m.orig);
              ctx.putImageData(mouth.buf, mouth.m.rx, mouth.m.ry);
              mouthDirty = false;
            }
          }
        }

        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };
    img.src = src;

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [src, blink]);

  // ── Debug: γραμμές βαθμονόμησης πάνω στο πρόσωπο (δεύτερος καμβάς, ίδια τοποθέτηση με την εικόνα) ──
  useEffect(() => {
    const main = ref.current;
    const dbg = dbgRef.current;
    if (!dbg || !main || status !== "ready") return;
    const W = (dbg.width = main.width);
    const H = (dbg.height = main.height);
    const d = dbg.getContext("2d")!;
    d.clearRect(0, 0, W, H);
    if (!debug) return;

    const line = (x0: number, y0: number, x1: number, y1: number, color: string) => {
      d.strokeStyle = color;
      d.lineWidth = Math.max(1, W / 900);
      d.beginPath();
      d.moveTo(x0, y0);
      d.lineTo(x1, y1);
      d.stroke();
    };
    const mx = MOUTH.x * W;
    const my = MOUTH.y * H;
    const hw = MOUTH.halfW * W;
    line(mx - hw, my, mx + hw, my, "#4da6ff");
    line(mx - hw, my - MOUTH.lip * H, mx + hw, my - MOUTH.lip * H, "#ffe04d");
    line(mx - hw, my + MOUTH.jaw * H, mx + hw, my + MOUTH.jaw * H, "#4dff9a");
    d.fillStyle = "#ff3b3b";
    d.beginPath();
    d.arc(mx, my, Math.max(2, W / 300), 0, Math.PI * 2);
    d.fill();
    for (const eye of EYES) {
      for (const [pts, color] of [[eye.up, "#ff4d4d"], [eye.lo, "#4da6ff"]] as const) {
        d.strokeStyle = color;
        d.lineWidth = Math.max(1, W / 900);
        d.beginPath();
        pts.forEach((p, i) => (i === 0 ? d.moveTo(p[0] * W, p[1] * H) : d.lineTo(p[0] * W, p[1] * H)));
        d.stroke();
      }
    }
  }, [debug, status]);

  const fitStyle = {
    objectFit: fit,
    objectPosition: `${FACE_FOCUS.x * 100}% ${FACE_FOCUS.y * 100}%`,
  } as const;
  const mask = fadeBottom
    ? {
        maskImage: "linear-gradient(to bottom, #000 70%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 70%, transparent 100%)",
      }
    : undefined;

  return (
    <div className={`relative ${className}`} style={{ mixBlendMode: blend ? "screen" : undefined }}>
      <style>{BREATHE_CSS}</style>

      <div className={`relative h-full w-full ${breathe && status === "ready" ? "aura-breathe" : ""}`} style={mask}>
        <canvas ref={ref} className={status === "ready" ? "block h-full w-full" : "hidden"} style={fitStyle} />
        <canvas
          ref={dbgRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ ...fitStyle, display: debug && status === "ready" ? "block" : "none" }}
        />
      </div>

      {status !== "ready" && (
        <div
          className={
            status === "loading"
              ? "aai-skeleton h-full w-full"
              : "flex h-full w-full items-center justify-center p-6 text-center text-sm text-slate-300"
          }
        >
          {status === "error" && (
            <span>
              Δεν βρέθηκε η εικόνα.
              <br />
              Βάλ' την στο <code className="text-white">public/aura-chrome.jpg</code>
            </span>
          )}
        </div>
      )}
    </div>
  );
}