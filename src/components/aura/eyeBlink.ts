// eyeBlink.ts
// Ρεαλιστικό ανοιγοκλείσιμο ματιών πάνω σε φωτογραφία. Δεν εξαρτάται από DOM/React.
//
// Πώς δουλεύει: το πάνω βλέφαρο «κατεβαίνει» και το κάτω «ανεβαίνει» με αντικατάσταση
// pixels (όχι σχεδιασμένο βλέφαρο). Η άκρη του βλεφάρου κινείται άκαμπτα, το δέρμα
// ανάμεσα στην πτυχή και την άκρη τεντώνεται από θολωμένη πηγή (χωρίς «ραβδώσεις»),
// και στο κλείσιμο φαίνεται λεπτή γραμμή βλεφαρίδων. Το βλέφαρο ρίχνει και μικρή σκιά
// πάνω στον βολβό.

export type Pt = readonly [number, number];
/** Άκρες βλεφάρων σε κλίμακα 0..1 της εικόνας. `up` = γραμμή πάνω βλεφάρου, `lo` = κάτω βλεφάρου. */
export type EyeSpec = { readonly up: readonly Pt[]; readonly lo: readonly Pt[] };

// Διαστάσεις σε pixels για μάτι πλάτους 98px (κλιμακώνονται με το πραγματικό πλάτος του ματιού)
const REF_EYE_W = 98;
const LID_H = 17; // ύψος δέρματος βλεφάρου από την πτυχή ως την άκρη
const LOWER_H = 9; // δέρμα κάτω βλεφάρου που συμμετέχει
const EDGE_UP = 4; // πόσο της άκρης του πάνω βλεφάρου κινείται άκαμπτα
const EDGE_LO = 2;
const SHADOW_DEPTH = 5;
const SHADOW = 0.32; // σκιά του βλεφάρου πάνω στον βολβό
const SHEEN = 0.22; // μεταλλική λάμψη στο κλειστό βλέφαρο
const CLOSE_AT = 0.86; // το πάνω βλέφαρο διανύει το 86% του ανοίγματος, το κάτω το υπόλοιπο

export type EyeRuntime = {
  /** Ορθογώνιο του καμβά που ξαναζωγραφίζεται */
  rx: number;
  ry: number;
  w: number;
  h: number;
  /** Αρχικά pixels της περιοχής (RGBA) */
  orig: Uint8ClampedArray;
  soft: Uint8ClampedArray;
  fine: Uint8ClampedArray;
  /** Άκρες βλεφάρων ανά στήλη, σε τοπικές συντεταγμένες περιοχής */
  yT: Float32Array;
  yB: Float32Array;
  lx0: number;
  cols: number;
  s: number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

function curveY(pts: readonly Pt[], x: number, W: number, H: number): number {
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (x <= first[0] * W) return first[1] * H;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ax = a[0] * W;
    const bx = b[0] * W;
    if (x <= bx) {
      const t = (x - ax) / (bx - ax);
      return (a[1] + (b[1] - a[1]) * t) * H;
    }
  }
  return last[1] * H;
}

function smooth(a: Float32Array, radius: number, passes: number): Float32Array {
  let src = a;
  const n = a.length;
  for (let p = 0; p < passes; p++) {
    const dst = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = -radius; j <= radius; j++) sum += src[Math.min(n - 1, Math.max(0, i + j))];
      dst[i] = sum / (2 * radius + 1);
    }
    src = dst;
  }
  return src;
}

function boxBlur(src: Uint8ClampedArray, w: number, h: number, r: number, passes = 2): Uint8ClampedArray {
  let cur = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) cur[i] = src[i];
  const tmp = new Float32Array(src.length);
  const win = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let k = 0; k < 3; k++) {
          let sum = 0;
          for (let j = -r; j <= r; j++) sum += cur[(y * w + Math.min(w - 1, Math.max(0, x + j))) * 4 + k];
          tmp[(y * w + x) * 4 + k] = sum / win;
        }
        tmp[(y * w + x) * 4 + 3] = 255;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let k = 0; k < 3; k++) {
          let sum = 0;
          for (let j = -r; j <= r; j++) sum += tmp[(Math.min(h - 1, Math.max(0, y + j)) * w + x) * 4 + k];
          cur[(y * w + x) * 4 + k] = sum / win;
        }
        cur[(y * w + x) * 4 + 3] = 255;
      }
    }
  }
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < out.length; i++) out[i] = cur[i];
  return out;
}

/** Προετοιμάζει ένα μάτι. `getRegion` γυρίζει τα RGBA pixels ενός ορθογωνίου της εικόνας. */
export function buildEye(
  spec: EyeSpec,
  W: number,
  H: number,
  getRegion: (x: number, y: number, w: number, h: number) => Uint8ClampedArray,
): EyeRuntime {
  const all = [...spec.up, ...spec.lo];
  const x0 = Math.floor(Math.min(...all.map((p) => p[0])) * W);
  const x1 = Math.ceil(Math.max(...all.map((p) => p[0])) * W);
  const cols = x1 - x0 + 1;
  const s = (x1 - x0) / REF_EYE_W;

  let top: Float32Array = new Float32Array(cols);
  let bot: Float32Array = new Float32Array(cols);
  for (let i = 0; i < cols; i++) {
    top[i] = curveY(spec.up, x0 + i, W, H);
    bot[i] = curveY(spec.lo, x0 + i, W, H);
  }
  const rad = Math.max(1, Math.round(3 * s));
  top = smooth(top, rad, 3);
  bot = smooth(bot, rad, 3);

  let minTop = Infinity;
  let maxBot = -Infinity;
  for (let i = 0; i < cols; i++) {
    minTop = Math.min(minTop, top[i]);
    maxBot = Math.max(maxBot, bot[i]);
  }
  const lidH = LID_H * s;
  const lowH = LOWER_H * s;
  const rx = Math.max(0, x0 - 2);
  const ry = Math.max(0, Math.floor(minTop - lidH) - 3);
  const w = Math.min(W, x1 + 3) - rx;
  const h = Math.min(H, Math.ceil(maxBot + lowH) + 3) - ry;

  const orig = new Uint8ClampedArray(getRegion(rx, ry, w, h));
  const soft = boxBlur(orig, w, h, Math.max(1, Math.round(2 * s)), 2);
  const fine = boxBlur(orig, w, h, 1, 1);

  for (let i = 0; i < cols; i++) {
    top[i] -= ry;
    bot[i] -= ry;
  }
  return { rx, ry, w, h, orig, soft, fine, yT: top, yB: bot, lx0: x0 - rx, cols, s };
}

/** Ζωγραφίζει το μάτι με κλείσιμο c (0 = ανοιχτό, 1 = κλειστό) μέσα στο `out` (RGBA περιοχής). */
export function renderEye(e: EyeRuntime, c: number, out: Uint8ClampedArray): void {
  const { w, h, orig, soft, fine, yT, yB, lx0, cols, s } = e;
  out.set(orig);
  if (c <= 0.002) return;

  const lidH = LID_H * s;
  const lowH = LOWER_H * s;
  const mUp = EDGE_UP * s;
  const mLo = EDGE_LO * s;
  const shDepth = SHADOW_DEPTH * s;
  const ramp = 8 * s;
  const wBlend = Math.min(1, c * 2.5);
  const shadowK = SHADOW * Math.min(1, c * 3);
  const sheenK = SHEEN * Math.pow(c, 1.5);
  const lashK = c > 0.6 ? Math.pow(sstep((c - 0.6) / 0.4), 1.3) : 0;
  const maxY = h - 1.001;
  const cxMid = lx0 + (cols - 1) / 2;
  const halfW = Math.max(1, (cols - 1) / 2);

  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const sample = (arr: Uint8ClampedArray, lx: number, sy: number, dst: number[]) => {
    const yy = sy < 0 ? 0 : sy > maxY ? maxY : sy;
    const y0 = Math.floor(yy);
    const f = yy - y0;
    const i0 = (y0 * w + lx) * 4;
    const i1 = ((y0 + 1) * w + lx) * 4;
    dst[0] = arr[i0] * (1 - f) + arr[i1] * f;
    dst[1] = arr[i0 + 1] * (1 - f) + arr[i1 + 1] * f;
    dst[2] = arr[i0 + 2] * (1 - f) + arr[i1 + 2] * f;
  };

  for (let i = 0; i < cols; i++) {
    const lx = lx0 + i;
    if (lx < 0 || lx >= w) continue;
    const top = yT[i];
    const bot = yB[i];
    const gap = bot - top;
    if (gap < 1.5 * s) continue; // στις γωνίες του ματιού δεν υπάρχει άνοιγμα

    const yC = top + CLOSE_AT * gap; // γραμμή κλεισίματος
    const yU = top + c * (yC - top); // άκρη πάνω βλεφάρου τώρα
    const yL = bot - c * (bot - yC); // άκρη κάτω βλεφάρου τώρα
    const yCr = top - lidH; // πτυχή βλεφάρου (σταθερή)
    const yEnd = bot + lowH;
    const move = sstep((yU - top) / (3 * s)); // στήλες που σχεδόν δεν κινούνται κρατούν τα αρχικά pixels
    const lat = sstep(i / (10 * s)) * sstep((cols - 1 - i) / (10 * s)); // σβήσιμο προς τις γωνίες
    const u = (lx - cxMid) / halfW;
    const sheenX = Math.pow(Math.max(0, 1 - u * u), 1.4);

    const y0 = Math.max(0, Math.floor(yCr));
    const y1 = Math.min(h - 1, Math.ceil(yEnd));
    for (let y = y0; y <= y1; y++) {
      if (y < yCr || y > yEnd) continue;
      const o = (y * w + lx) * 4;

      const sh = clamp01(1 - (y + 0.5 - yU) / shDepth) * shadowK;
      let r = orig[o] * (1 - sh);
      let g = orig[o + 1] * (1 - sh);
      let bl = orig[o + 2] * (1 - sh);

      const covU = clamp01(yU - y);
      if (covU > 0) {
        const rigid = y >= yU - mUp;
        let sy: number;
        let amt: number;
        if (rigid) {
          sy = top - (yU - y); // άκρη βλεφάρου: μετακινείται άκαμπτα
          amt = 0.55 * wBlend * move;
        } else {
          const t = clamp01((y - yCr) / Math.max(1e-3, yU - mUp - yCr));
          sy = yCr + t * (top - mUp - yCr); // δέρμα βλεφάρου: τεντώνεται
          amt = wBlend * move * sstep((y - yCr) / ramp);
        }
        sample(orig, lx, sy, a);
        if (amt > 0) {
          sample(rigid ? fine : soft, lx, sy, b);
          a[0] = a[0] * (1 - amt) + b[0] * amt;
          a[1] = a[1] * (1 - amt) + b[1] * amt;
          a[2] = a[2] * (1 - amt) + b[2] * amt;
        }
        if (!rigid && sheenK > 0) {
          const tt = clamp01((y - yCr) / Math.max(1e-3, yU - yCr));
          const amp = sheenK * Math.exp(-Math.pow((tt - 0.42) / 0.17, 2)) * sheenX;
          a[0] += (255 - a[0]) * amp;
          a[1] += (255 - a[1]) * amp;
          a[2] += (255 - a[2]) * amp;
        }
        r = r * (1 - covU) + a[0] * covU;
        g = g * (1 - covU) + a[1] * covU;
        bl = bl * (1 - covU) + a[2] * covU;
      }

      const covL = clamp01(y + 1 - yL);
      if (covL > 0) {
        const rigid = y <= yL + mLo;
        let sy: number;
        let amt: number;
        if (rigid) {
          sy = bot + (y - yL);
          amt = 0.55 * wBlend * move;
        } else {
          const t = clamp01((y - (yL + mLo)) / Math.max(1e-3, bot + lowH - (yL + mLo)));
          sy = bot + mLo + t * (lowH - mLo);
          amt = wBlend * move;
        }
        sample(orig, lx, sy, a);
        if (amt > 0) {
          sample(rigid ? fine : soft, lx, sy, b);
          a[0] = a[0] * (1 - amt) + b[0] * amt;
          a[1] = a[1] * (1 - amt) + b[1] * amt;
          a[2] = a[2] * (1 - amt) + b[2] * amt;
        }
        r = r * (1 - covL) + a[0] * covL;
        g = g * (1 - covL) + a[1] * covL;
        bl = bl * (1 - covL) + a[2] * covL;
      }

      // στις γωνίες του ματιού το αποτέλεσμα σβήνει προς την αρχική εικόνα
      out[o] = orig[o] * (1 - lat) + r * lat;
      out[o + 1] = orig[o + 1] * (1 - lat) + g * lat;
      out[o + 2] = orig[o + 2] * (1 - lat) + bl * lat;
      out[o + 3] = 255;
    }

    // γραμμή βλεφαρίδων: λεία (gaussian), με ακρίβεια κάτω του pixel
    if (lashK > 0) {
      const base = Math.floor(yC);
      for (let yy = base - 3; yy <= base + 3; yy++) {
        if (yy < 0 || yy >= h) continue;
        const dy = yy + 0.5 - yC;
        const k = Math.exp(-(dy * dy) / (2 * 0.85 * 0.85)) * 0.6 * lashK * lat;
        const o = (yy * w + lx) * 4;
        out[o] = out[o] * (1 - k) + 22 * k;
        out[o + 1] = out[o + 1] * (1 - k) + 20 * k;
        out[o + 2] = out[o + 2] * (1 - k) + 22 * k;
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Χρονισμός: πότε και πώς ανοιγοκλείνουν τα μάτια                      */
/* ------------------------------------------------------------------ */

type Blink = { start: number; amp: number; close: number; hold: number; open: number; double: boolean };

/** Καμπύλη κλεισίματος: γρήγορη κάθοδος, μικρή παύση, πιο αργή άνοδος (~280ms συνολικά). */
export function closureAt(b: Pick<Blink, "amp" | "close" | "hold" | "open">, t: number): number {
  if (t < 0) return 0;
  if (t < b.close) {
    const x = t / b.close;
    return b.amp * (x * x * (3 - 2 * x));
  }
  if (t < b.close + b.hold) return b.amp;
  const x = (t - b.close - b.hold) / b.open;
  if (x >= 1) return 0;
  return b.amp * Math.pow(1 - x, 1.7);
}

export class BlinkController {
  private nextAt = 0;
  private cur: Blink | null = null;
  private lastNow = 0;
  private pendingDouble = false;

  constructor(private readonly rand: () => number = Math.random) {}

  /** Αναγκάζει ένα βλεφάρισμα τώρα (π.χ. για δοκιμή). */
  trigger(now: number, amp = 1): void {
    this.cur = this.make(now, amp, false);
    this.lastNow = now;
  }

  /** Όταν αρχίζει να μιλά, συχνά ακολουθεί ένα φυσικό βλεφάρισμα. */
  nudge(now: number): void {
    if (this.cur) return;
    if (this.nextAt - now > 700 && this.rand() < 0.55) this.nextAt = now + 150 + this.rand() * 300;
  }

  /** Καλείται σε κάθε frame. Γυρίζει το κλείσιμο 0..1. */
  update(now: number, speaking: boolean): number {
    // πρώτη φορά ή επιστροφή από κρυμμένο tab: ξεκίνα ήρεμα
    if (this.lastNow === 0 || now - this.lastNow > 1000) {
      this.cur = null;
      this.nextAt = now + 700 + this.rand() * 900;
    }
    this.lastNow = now;

    if (!this.cur && now >= this.nextAt) {
      const amp = this.pendingDouble ? 0.85 + this.rand() * 0.15 : this.rand() < 0.12 ? 0.55 + this.rand() * 0.25 : 1;
      this.cur = this.make(now, amp, !this.pendingDouble && amp === 1 && this.rand() < 0.14);
      this.pendingDouble = false;
    }
    const cur = this.cur;
    if (!cur) return 0;

    const t = now - cur.start;
    if (t >= cur.close + cur.hold + cur.open) {
      this.cur = null;
      if (cur.double) {
        this.pendingDouble = true;
        this.nextAt = now + 110 + this.rand() * 120; // διπλό βλεφάρισμα
      } else {
        const base = 1900 + this.rand() * 3800; // ~3.8s κατά μέσο όρο (≈15 βλεφαρίσματα/λεπτό)
        const stare = this.rand() < 0.06 ? 2500 : 0; // πού και πού «κοιτάζει» χωρίς να βλεφαρίζει
        this.nextAt = now + (base + stare) * (speaking ? 0.8 : 1);
      }
      return 0;
    }
    return closureAt(cur, t);
  }

  private make(now: number, amp: number, dbl: boolean): Blink {
    const full = amp >= 0.99;
    return {
      start: now,
      amp,
      close: 70 + this.rand() * 30,
      hold: full ? 20 + this.rand() * 30 : 0,
      open: (full ? 140 : 110) + this.rand() * 70,
      double: dbl,
    };
  }
}