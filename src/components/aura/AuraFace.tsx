import { useEffect, useRef, useState } from "react";
import type { Viseme } from "@/lib/visemes";

// ⚙️ Συντεταγμένες στόματος, μετρημένες πάνω στη νέα εικόνα (≈828×1462), κλίμακα 0..1
// Αν η εικόνα σου έχει άλλες διαστάσεις, βάλε debug={true} και ρύθμισε τις τιμές.
export const MOUTH = {
  x: 0.502,       // κέντρο στόματος
  y: 0.448,       // γραμμή ανάμεσα στα χείλη
  halfW: 0.095,   // μισό πλάτος χειλιών (από γωνία σε γωνία)
  jaw: 0.09,      // μέχρι πού φτάνει το σαγόνι
  lip: 0.018,     // ύψος πάνω χείλους
  maxOpen: 0.022, // μέγιστο άνοιγμα στόματος
};

const IMG_ASPECT = "aspect-[828/1462]";
const SIZE = "h-[44vh] md:h-[68vh] max-h-[780px]";

type Props = {
  src: string;
  getViseme: (now: number) => Viseme;
  debug?: boolean;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export default function AuraFace({ src, getViseme, debug = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const getRef = useRef(getViseme);
  getRef.current = getViseme;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    let raf = 0;
    let alive = true;
    setStatus("loading");

    img.onerror = () => alive && setStatus("error");
    img.onload = () => {
      if (!alive) return;
      const W = (canvas.width = img.naturalWidth);
      const H = (canvas.height = img.naturalHeight);
      ctx.drawImage(img, 0, 0);
      setStatus("ready");

      const mx = MOUTH.x * W;
      const my = Math.round(MOUTH.y * H);
      const hw0 = MOUTH.halfW * W;
      const jaw = MOUTH.jaw * H;
      const lip = MOUTH.lip * H;
      const maxOpen = MOUTH.maxOpen * H;

      const cw = Math.max(3, Math.round(W * 0.004));
      const ch = Math.max(3, Math.round(H * 0.003));
      const margin = hw0 * 1.5;
      const y0 = my - Math.ceil(lip / ch) * ch;
      const y1 = my + Math.ceil(jaw / ch) * ch;
      const x0 = Math.floor(mx - margin);
      const x1 = Math.ceil(mx + margin);

      let open = 0;
      let width = 1;
      let idle = true;

      const restore = () =>
        ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);

      // ── Δόντια: 6 μπροστινά δόντια με καμπύλη αψίδα, σκίαση και κενά ──────────
      const REL = [0.8, 0.9, 1, 1, 0.9, 0.8];
      const REL_SUM = REL.reduce((a, b) => a + b, 0);

      const drawTeeth = (
        yBase: number,
        h: number,
        dir: 1 | -1, // 1 = πάνω δόντια (μεγαλώνουν προς τα κάτω), -1 = κάτω δόντια
        totalW: number,
        alpha: number,
        tone: [string, string, string]
      ) => {
        if (h < 0.6 || alpha <= 0.01) return;
        ctx.save();
        ctx.globalAlpha = alpha;

        let x = mx - totalW / 2;
        for (let i = 0; i < REL.length; i++) {
          const w = (totalW * REL[i]) / REL_SUM;
          const arch = Math.abs(i - 2.5) / 2.5; // 0 στο κέντρο → 1 στα άκρα
          const hh = h * (1 - 0.3 * arch * arch);
          const tip = yBase + dir * hh;
          const r = Math.min(w * 0.3, hh * 0.5);

          ctx.beginPath();
          ctx.moveTo(x, yBase - dir * 3);
          ctx.lineTo(x + w, yBase - dir * 3);
          ctx.lineTo(x + w, tip - dir * r);
          ctx.quadraticCurveTo(x + w, tip, x + w - r, tip);
          ctx.lineTo(x + r, tip);
          ctx.quadraticCurveTo(x, tip, x, tip - dir * r);
          ctx.closePath();

          // κατακόρυφη διαβάθμιση (σκιά στη ρίζα, φως στη μέση, ζεστό στην άκρη)
          const gy = ctx.createLinearGradient(0, yBase, 0, yBase + dir * hh);
          gy.addColorStop(0, tone[0]);
          gy.addColorStop(0.35, tone[1]);
          gy.addColorStop(1, tone[2]);
          ctx.fillStyle = gy;
          ctx.fill();

          // οριζόντια καμπυλότητα (κάθε δόντι φαίνεται στρογγυλεμένο)
          const gx = ctx.createLinearGradient(x, 0, x + w, 0);
          gx.addColorStop(0, "rgba(40,24,26,0.38)");
          gx.addColorStop(0.28, "rgba(40,24,26,0)");
          gx.addColorStop(0.62, "rgba(255,255,255,0.10)");
          gx.addColorStop(1, "rgba(40,24,26,0.38)");
          ctx.fillStyle = gx;
          ctx.fill();

          // τα πλαϊνά δόντια χάνονται στη σκιά του στόματος
          if (arch > 0) {
            ctx.fillStyle = `rgba(20,10,12,${arch * 0.4})`;
            ctx.fill();
          }

          // λεπτό κενό ανάμεσα στα δόντια
          ctx.strokeStyle = "rgba(50,30,32,0.45)";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x, yBase);
          ctx.lineTo(x, tip - dir * r);
          ctx.stroke();

          x += w;
        }
        ctx.restore();
      };

      const frame = (now: number) => {
        if (!alive) return;
        const v = getRef.current(now);
        open += (v.open - open) * 0.35;
        width += (v.width - width) * 0.35;
        const D = open * maxOpen;

        if (D < 0.4) {
          if (!idle) {
            restore();
            idle = true;
          }
          raf = requestAnimationFrame(frame);
          return;
        }
        idle = false;

        const Ul = D * 0.28; // πόσο ανεβαίνει το πάνω χείλος
        const Dl = D - Ul; // πόσο κατεβαίνει το κάτω χείλος + σαγόνι
        const hw = hw0 * width;
        const c = clamp((1 - width) * 0.3, -0.04, 0.16); // «σούφρωμα» για Ο/ΟΥ

        const wx = (x: number) => {
          const t = Math.abs(x - mx) / hw;
          return t >= 1 ? 0 : Math.pow(Math.cos((t * Math.PI) / 2), 0.8);
        };
        const g = (x: number) => {
          const t = Math.abs(x - mx) / margin;
          return t >= 1 ? 0 : Math.pow(Math.cos((t * Math.PI) / 2), 2);
        };
        const px = (x: number) => -(x - mx) * c * g(x);
        const up = (y: number) => {
          const t = Math.min(1, Math.max(0, (my - y) / lip));
          return (1 - t) * (1 - t);
        };
        const dn = (y: number) => {
          const t = Math.min(1, Math.max(0, (y - my) / jaw));
          return (1 - t) * (1 - t);
        };

        // στήλες
        const cols: { sx: number; k: number; dx0: number; dx1: number; shift: number }[] = [];
        for (let sx = x0; sx < x1; sx += cw) {
          const dx0 = sx + px(sx);
          const dx1 = sx + cw + px(sx + cw);
          cols.push({ sx, k: wx(sx + cw / 2), dx0, dx1, shift: px(sx + cw / 2) });
        }

        restore();

        // ── Εσωτερικό στόματος ───────────────────────────────────────────────
        ctx.save();
        ctx.beginPath();
        let started = false;
        const bottoms: [number, number][] = [];
        for (const col of cols) {
          if (col.k < 0.02) continue;
          const xm = (col.dx0 + col.dx1) / 2;
          const yTop = my - Ul * col.k;
          if (!started) {
            ctx.moveTo(xm, yTop);
            started = true;
          } else {
            ctx.lineTo(xm, yTop);
          }
          bottoms.push([xm, my + Dl * col.k + 1]);
        }
        for (let i = bottoms.length - 1; i >= 0; i--) ctx.lineTo(bottoms[i][0], bottoms[i][1]);
        ctx.closePath();

        // βαθύ, ζεστό σκούρο εσωτερικό (ταιριάζει με το γκρι φως της φωτογραφίας)
        const grad = ctx.createLinearGradient(0, my - Ul, 0, my + Dl);
        grad.addColorStop(0, "#0e0708");
        grad.addColorStop(0.5, "#1c0f11");
        grad.addColorStop(1, "#33191c");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.clip();

        const openAmt = ctx.canvas ? open : 0;
        const topY = my - Ul;
        const botY = my + Dl;
        const totalH = Ul + Dl;

        // λαιμός / σκοτεινό βάθος στο κέντρο
        if (openAmt > 0.3) {
          const throat = ctx.createRadialGradient(mx, my + Dl * 0.2, 1, mx, my + Dl * 0.2, hw * 0.9);
          throat.addColorStop(0, "rgba(0,0,0,0.55)");
          throat.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = throat;
          ctx.fillRect(mx - hw, topY, hw * 2, totalH);
        }

        // γλώσσα: διαβάθμιση, κεντρική αύλακα και απαλή λάμψη
        if (openAmt > 0.4) {
          const tw = hw * 0.46;
          const th = Math.max(0.8, Dl * 0.34);
          const ty = botY - th * 0.55;
          const tg = ctx.createLinearGradient(0, ty - th, 0, ty + th);
          tg.addColorStop(0, "#6e4146");
          tg.addColorStop(0.55, "#4d2a2f");
          tg.addColorStop(1, "#2c1619");
          ctx.fillStyle = tg;
          ctx.beginPath();
          ctx.ellipse(mx, ty, tw, th, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "rgba(20,8,10,0.45)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(mx, ty - th * 0.7);
          ctx.lineTo(mx, ty + th * 0.2);
          ctx.stroke();

          ctx.fillStyle = "rgba(255,225,225,0.10)";
          ctx.beginPath();
          ctx.ellipse(mx - tw * 0.15, ty - th * 0.35, tw * 0.5, th * 0.25, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // δόντια
        const teethVis = clamp((width - 0.72) / 0.25, 0, 1); // κρύβονται στα Ο/ΟΥ
        if (openAmt > 0.18 && teethVis > 0) {
          const totalW = hw * 1.5;
          const upperH = Math.min(totalH * 0.55, H * 0.0125);
          // πάνω δόντια: φωτεινά, ελαφρώς ζεστά στην άκρη
          drawTeeth(topY, upperH, 1, totalW, teethVis, ["#a9a7a3", "#ecebe6", "#d6d2c8"]);

          // κάτω δόντια: πιο σκιασμένα, φαίνονται μόνο όταν ανοίγει αρκετά
          if (openAmt > 0.55) {
            const lowerH = Math.min(Dl * 0.4, H * 0.0075);
            drawTeeth(botY, lowerH, -1, totalW * 0.9, teethVis * clamp((openAmt - 0.55) / 0.25, 0, 1), [
              "#8f8c88",
              "#b9b6b0",
              "#a8a49c",
            ]);
          }
        }

        // σκιά που ρίχνει το πάνω χείλος μέσα στο στόμα (βάθος)
        const topShadow = ctx.createLinearGradient(0, topY, 0, topY + Math.max(3, totalH * 0.55));
        topShadow.addColorStop(0, "rgba(8,3,4,0.55)");
        topShadow.addColorStop(1, "rgba(8,3,4,0)");
        ctx.fillStyle = topShadow;
        ctx.fillRect(mx - hw * 1.1, topY, hw * 2.2, Math.max(3, totalH * 0.55));

        // σκιά από κάτω χείλος
        const botShadow = ctx.createLinearGradient(0, botY - 2, 0, botY - Math.max(3, totalH * 0.25));
        botShadow.addColorStop(0, "rgba(8,3,4,0.35)");
        botShadow.addColorStop(1, "rgba(8,3,4,0)");
        ctx.fillStyle = botShadow;
        ctx.fillRect(mx - hw * 1.1, botY - Math.max(3, totalH * 0.25), hw * 2.2, Math.max(3, totalH * 0.25));

        // σκοτεινιάζουν οι γωνίες του στόματος
        const side = ctx.createLinearGradient(mx - hw, 0, mx + hw, 0);
        side.addColorStop(0, "rgba(10,4,5,0.75)");
        side.addColorStop(0.22, "rgba(10,4,5,0)");
        side.addColorStop(0.78, "rgba(10,4,5,0)");
        side.addColorStop(1, "rgba(10,4,5,0.75)");
        ctx.fillStyle = side;
        ctx.fillRect(mx - hw, topY - 1, hw * 2, totalH + 3);

        ctx.restore();

        // ── Πάνω χείλος (ανεβαίνει) και κάτω χείλος + σαγόνι (κατεβαίνουν) ───
        for (const col of cols) {
          const k = col.k;
          if (D * k < 0.3 && Math.abs(col.shift) < 0.3) continue;
          const w = col.dx1 - col.dx0 + 1.5;
          for (let sy = y0; sy < my; sy += ch) {
            const u0 = Ul * k * up(sy);
            const u1 = Ul * k * up(sy + ch);
            ctx.drawImage(img, col.sx, sy, cw, ch, col.dx0, sy - u0, w, ch - u1 + u0 + 1);
          }
          for (let sy = my; sy < y1; sy += ch) {
            const d0 = Dl * k * dn(sy);
            const d1 = Dl * k * dn(sy + ch);
            ctx.drawImage(img, col.sx, sy, cw, ch, col.dx0, sy + d0, w, ch + d1 - d0 + 1);
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
    };
  }, [src]);

  return (
    <div className="relative inline-block max-w-full">
      <canvas
        ref={ref}
        className={status === "ready" ? `${SIZE} w-auto max-w-full rounded-[26px]` : "hidden"}
      />

      {status !== "ready" && (
        <div
          className={`${SIZE} ${IMG_ASPECT} max-w-full rounded-[26px] ${
            status === "loading"
              ? "aai-skeleton"
              : "flex items-center justify-center p-6 text-center text-sm text-slate-300"
          }`}
        >
          {status === "error" && (
            <span>
              Δεν βρέθηκε η εικόνα.
              <br />
              Βάλ' την στο <code className="text-white">public/aura-ai.png</code>
            </span>
          )}
        </div>
      )}

      {debug && status === "ready" && (
        <>
          <div
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500"
            style={{ left: `${MOUTH.x * 100}%`, top: `${MOUTH.y * 100}%` }}
          />
          <div
            className="absolute h-px -translate-x-1/2 bg-sky-400"
            style={{ left: `${MOUTH.x * 100}%`, top: `${MOUTH.y * 100}%`, width: `${MOUTH.halfW * 200}%` }}
          />
          <div
            className="absolute h-px -translate-x-1/2 bg-yellow-300"
            style={{ left: `${MOUTH.x * 100}%`, top: `${(MOUTH.y - MOUTH.lip) * 100}%`, width: `${MOUTH.halfW * 200}%` }}
          />
          <div
            className="absolute h-px -translate-x-1/2 bg-green-400"
            style={{ left: `${MOUTH.x * 100}%`, top: `${(MOUTH.y + MOUTH.jaw) * 100}%`, width: `${MOUTH.halfW * 200}%` }}
          />
        </>
      )}
    </div>
  );
}