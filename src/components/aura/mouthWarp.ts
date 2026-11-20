// mouthWarp.ts
// Κίνηση στόματος ανά pixel (όχι λωρίδες): το πάνω χείλος ανεβαίνει, το κάτω χείλος και το σαγόνι
// κατεβαίνουν, και στο άνοιγμα ζωγραφίζεται ρεαλιστικό εσωτερικό (κοιλότητα, δόντια, γλώσσα).
// Δεν εξαρτάται από DOM/React, άρα δοκιμάζεται σε node.

export type MouthSpec = {
  /** Κέντρο στόματος και γραμμή ανάμεσα στα χείλη, κλίμακα 0..1 της εικόνας */
  readonly x: number;
  readonly y: number;
  /** μισό πλάτος χειλιών (γωνία–κέντρο) ως ποσοστό του πλάτους */
  readonly halfW: number;
  /** πόσο κάτω από τη γραμμή των χειλιών φτάνει το σαγόνι (ποσοστό ύψους) */
  readonly jaw: number;
  /** ύψος πάνω χείλους (ποσοστό ύψους) */
  readonly lip: number;
  /** μέγιστο άνοιγμα στόματος (ποσοστό ύψους) */
  readonly maxOpen: number;
};

export type MouthRuntime = {
  rx: number;
  ry: number;
  w: number;
  h: number;
  orig: Uint8ClampedArray;
  /** Όλα σε τοπικές συντεταγμένες της περιοχής (pixels) */
  mx: number;
  my: number;
  hw0: number;
  jaw: number;
  lip: number;
  maxOpen: number;
  margin: number;
  s: number;
};

const REF_HALF_W = 79; // μισό πλάτος χειλιών στη φωτογραφία όπου ρυθμίστηκαν τα μεγέθη των δοντιών

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);
const sstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function buildMouth(
  spec: MouthSpec,
  W: number,
  H: number,
  getRegion: (x: number, y: number, w: number, h: number) => Uint8ClampedArray,
): MouthRuntime {
  const mxA = spec.x * W;
  const myA = Math.round(spec.y * H);
  const hw0 = spec.halfW * W;
  const jaw = spec.jaw * H;
  const lip = spec.lip * H;
  const margin = hw0 * 1.5;

  const rx = Math.max(0, Math.floor(mxA - margin) - 2);
  const ry = Math.max(0, Math.floor(myA - lip) - 8);
  const w = Math.min(W, Math.ceil(mxA + margin) + 2) - rx;
  const h = Math.min(H, Math.ceil(myA + jaw) + 6) - ry;

  return {
    rx,
    ry,
    w,
    h,
    orig: new Uint8ClampedArray(getRegion(rx, ry, w, h)),
    mx: mxA - rx,
    my: myA - ry,
    hw0,
    jaw,
    lip,
    maxOpen: spec.maxOpen * H,
    margin,
    s: hw0 / REF_HALF_W,
  };
}

/* ------------------------------------------------------------------ */
/* Δόντια                                                               */
/* ------------------------------------------------------------------ */

const REL = [0.8, 0.9, 1, 1, 0.9, 0.8];
const REL_SUM = REL.reduce((a, b) => a + b, 0);
const BOUND: number[] = [0];
for (const r of REL) BOUND.push(BOUND[BOUND.length - 1] + r / REL_SUM);

type Tooth = { i: number; u: number; wpx: number; arch: number };

function toothAt(tx: number, totalW: number): Tooth | null {
  if (tx < 0 || tx >= 1) return null;
  let i = 0;
  while (i < REL.length - 1 && tx >= BOUND[i + 1]) i++;
  const span = BOUND[i + 1] - BOUND[i];
  return { i, u: (tx - BOUND[i]) / span, wpx: totalW * span, arch: Math.abs(i - 2.5) / 2.5 };
}

/** Κάλυψη (0..1) δοντιού στη θέση: ο μυς επάνω-κάτω «κρεμιέται» από τη βάση προς την άκρη */
function toothCoverage(t: Tooth, hh: number, dist: number): number {
  // dist = απόσταση από τη βάση του δοντιού προς την άκρη (pixels), hh = ύψος δοντιού
  const r = Math.min(t.wpx * 0.3, hh * 0.5);
  const a = Math.max(1e-3, r / t.wpx);
  const v = Math.abs(t.u - 0.5);
  const v0 = 0.5 - a;
  const dy = v > v0 ? r * (1 - Math.sqrt(Math.max(0, 1 - ((v - v0) / a) ** 2))) : 0;
  return clamp01(hh - dy - dist + 0.5);
}

/* ------------------------------------------------------------------ */
/* Render                                                               */
/* ------------------------------------------------------------------ */

/**
 * Ζωγραφίζει το στόμα στο `out` (RGBA περιοχής). Γυρίζει false αν το άνοιγμα είναι αμελητέο
 * (τότε ο καλών πρέπει να επαναφέρει την αρχική εικόνα).
 */
export function renderMouth(m: MouthRuntime, open: number, width: number, out: Uint8ClampedArray): boolean {
  const D = open * m.maxOpen;
  if (D < 0.4) return false;

  const { w, h, orig, mx, my, hw0, jaw, lip, margin, s } = m;
  const Ul = D * 0.28; // πόσο ανεβαίνει το πάνω χείλος
  const Dl = D - Ul; // πόσο κατεβαίνει το κάτω χείλος + σαγόνι
  const geoW = Math.min(width, 1.08); // πιο πλατύ από τα χείλη δεν ανοίγει φυσικά
  const hw = hw0 * geoW;
  const c = clamp((1 - geoW) * 0.3, -0.04, 0.16); // «σούφρωμα» για Ο/ΟΥ

  const gX = (x: number) => {
    const t = Math.abs(x - mx) / margin;
    return t >= 1 ? 0 : Math.cos((t * Math.PI) / 2) ** 2;
  };
  // το οριζόντιο σούφρωμα σβήνει κατακόρυφα προς τα όρια της περιοχής (χωρίς ραφή)
  const vTop = Math.max(1, my - lip * 0.8);
  const vBot0 = my + jaw * 0.4;
  const vBot1 = Math.max(vBot0 + 1, h - 1);
  const vw = (y: number) => sstep(y / vTop) * (1 - sstep((y - vBot0) / (vBot1 - vBot0)));
  const shiftAt = (x: number, y: number) => -(x - mx) * c * gX(x) * vw(y);
  const wX = (x: number) => {
    const t = Math.abs(x - mx) / hw;
    return t >= 1 ? 0 : Math.cos((t * Math.PI) / 2) ** 0.8;
  };
  const upW = (ys: number) => (1 - clamp01((my - ys) / lip)) ** 2;
  const dnW = (ys: number) => (1 - clamp01((ys - my) / jaw)) ** 2;

  const maxX = w - 1.001;
  const maxY = h - 1.001;
  // bilinear δείγμα από την αρχική περιοχή
  const sample = (sx: number, sy: number, dst: number[]) => {
    const x = clamp(sx - 0.5, 0, maxX);
    const y = clamp(sy - 0.5, 0, maxY);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const i00 = (y0 * w + x0) * 4;
    const i10 = i00 + 4;
    const i01 = i00 + w * 4;
    const i11 = i01 + 4;
    for (let k = 0; k < 3; k++) {
      dst[k] =
        (orig[i00 + k] * (1 - fx) + orig[i10 + k] * fx) * (1 - fy) +
        (orig[i01 + k] * (1 - fx) + orig[i11 + k] * fx) * fy;
    }
  };

  // Εσωτερικό: παράμετροι
  const teethVis = clamp((width - 0.72) / 0.25, 0, 1); // κρύβονται στα Ο/ΟΥ
  const showUpper = open > 0.18 && teethVis > 0;
  const showLower = open > 0.55 && teethVis > 0;
  const lowerVis = teethVis * clamp((open - 0.55) / 0.25, 0, 1);
  const totalW = hw * 1.5;
  const upperCap = 18 * s;
  const lowerCap = 11 * s;
  const showTongue = open > 0.4;

  const interior = (dst: number[], xd: number, yd: number, yTop: number, yBot: number, oh: number, q: number) => {
    const pv = clamp01((yd - yTop) / oh); // 0 πάνω, 1 κάτω
    // κοιλότητα: σκούρο, ζεστό, πιο βαθύ στο κέντρο
    let cr = mix(14, 40, pv);
    let cg = mix(7, 19, pv);
    let cb = mix(9, 23, pv);
    const throat = Math.exp(-(q * q) / 0.32);
    const deep = 1 - 0.6 * throat * (1 - 0.35 * pv);
    cr *= deep;
    cg *= deep;
    cb *= deep;

    // γλώσσα
    if (showTongue) {
      const rxT = hw * 0.46;
      const ryT = Math.max(0.8, Dl * 0.34);
      const cyT = yBot - ryT * 0.55;
      const dx = (xd - mx) / rxT;
      const dy = (yd - cyT) / ryT;
      const nd = Math.sqrt(dx * dx + dy * dy) - 1;
      const cov = clamp01(0.5 - nd * Math.min(rxT, ryT));
      if (cov > 0) {
        const v = clamp01((yd - (cyT - ryT)) / (2 * ryT));
        let tr = mix(118, 78, sstep(v / 0.6));
        let tg = mix(70, 44, sstep(v / 0.6));
        let tb = mix(74, 49, sstep(v / 0.6));
        tr = mix(tr, 44, sstep((v - 0.6) / 0.4));
        tg = mix(tg, 22, sstep((v - 0.6) / 0.4));
        tb = mix(tb, 26, sstep((v - 0.6) / 0.4));
        const groove = 1 - 0.3 * Math.exp(-((xd - mx) * (xd - mx)) / (2 * 1.4 * 1.4)) * (1 - v);
        tr *= groove;
        tg *= groove;
        tb *= groove;
        const hl =
          0.3 * Math.exp(-(((xd - (mx - rxT * 0.2)) / (rxT * 0.3)) ** 2 + ((yd - (cyT - ryT * 0.4)) / (ryT * 0.22)) ** 2));
        tr += (255 - tr) * hl;
        tg += (255 - tg) * hl;
        tb += (255 - tb) * hl;
        cr = mix(cr, tr, cov);
        cg = mix(cg, tg, cov);
        cb = mix(cb, tb, cov);
      }
    }

    // δόντια (κάτω πρώτα, ώστε τα πάνω να είναι μπροστά)
    if (showLower) {
      const tw = totalW * 0.9;
      const tooth = toothAt((xd - mx) / tw + 0.5, tw);
      if (tooth) {
        const hh = Math.max(0.6, Math.min(Dl * 0.4, lowerCap) * (1 - 0.3 * tooth.arch * tooth.arch));
        const cov = toothCoverage(tooth, hh, yBot - yd) * lowerVis;
        if (cov > 0 && yBot - yd >= -0.5) {
          const t = clamp01((yBot - yd) / hh);
          const base = t < 0.3 ? mix(120, 176, t / 0.3) : mix(176, 160, (t - 0.3) / 0.7);
          const edge = 1 - 0.34 * sstep((Math.abs(tooth.u - 0.5) * 2 - 0.45) / 0.55);
          const gap = 1 - 0.5 * (1 - sstep((Math.min(tooth.u, 1 - tooth.u) * tooth.wpx) / 0.9));
          const k2 = (edge * gap * (1 - 0.4 * tooth.arch * tooth.arch)) * 0.88;
          cr = mix(cr, base * k2, cov);
          cg = mix(cg, (base - 4) * k2, cov);
          cb = mix(cb, (base - 14) * k2, cov);
        }
      }
    }
    if (showUpper) {
      const tooth = toothAt((xd - mx) / totalW + 0.5, totalW);
      if (tooth) {
        const hh = Math.max(0.6, Math.min(oh * 0.55, upperCap) * (1 - 0.3 * tooth.arch * tooth.arch));
        const cov = toothCoverage(tooth, hh, yd - yTop) * teethVis;
        if (cov > 0) {
          const t = clamp01((yd - yTop) / hh);
          // βάση σκιασμένη (ούλα), φως στη μέση, ζεστή/ημιδιαφανής άκρη
          let tr = t < 0.35 ? mix(150, 238, t / 0.35) : mix(238, 214, (t - 0.35) / 0.65);
          let tg = t < 0.35 ? mix(142, 234, t / 0.35) : mix(234, 208, (t - 0.35) / 0.65);
          let tb = t < 0.35 ? mix(130, 224, t / 0.35) : mix(224, 192, (t - 0.35) / 0.65);
          const edge = 1 - 0.34 * sstep((Math.abs(tooth.u - 0.5) * 2 - 0.45) / 0.55);
          const gap = 1 - 0.5 * (1 - sstep((Math.min(tooth.u, 1 - tooth.u) * tooth.wpx) / 0.9));
          const dark = edge * gap * (1 - 0.4 * tooth.arch * tooth.arch);
          tr *= dark;
          tg *= dark;
          tb *= dark;
          // γυαλάδα
          const spec = 0.3 * Math.exp(-(((tooth.u - 0.34) / 0.14) ** 2 + ((t - 0.38) / 0.2) ** 2));
          tr += (255 - tr) * spec;
          tg += (255 - tg) * spec;
          tb += (255 - tb) * spec;
          // διαφάνεια του σμάλτου κοντά στην άκρη
          const tl = sstep((t - 0.72) / 0.28) * 0.28;
          tr = mix(tr, cr, tl);
          tg = mix(tg, cg, tl);
          tb = mix(tb, cb, tl);
          cr = mix(cr, tr, cov);
          cg = mix(cg, tg, cov);
          cb = mix(cb, tb, cov);
        }
      }
    }

    // σκιές: από το πάνω χείλος, κάτω χείλος και γωνίες του στόματος
    const ts = Math.exp(-(yd - yTop) / Math.max(2, 0.45 * oh)) * 0.55;
    const bs = Math.exp(-(yBot - yd) / Math.max(1.5, 0.2 * oh)) * 0.3;
    const cs = sstep((Math.abs(q) - 0.6) / 0.4) * 0.75;
    const shade = (1 - ts) * (1 - bs) * (1 - cs);
    dst[0] = cr * shade;
    dst[1] = cg * shade;
    dst[2] = cb * shade;
  };

  const lip3 = [0, 0, 0];
  const col = [0, 0, 0];
  out.set(orig);

  for (let X = 0; X < w; X++) {
    const xd = X + 0.5;
    // αντίστροφη οριζόντια μετατόπιση (σούφρωμα)
    let xs = xd;
    for (let it = 0; it < 3; it++) xs = xd - shiftAt(xs, my);
    const k = wX(xs);
    const moved = Math.abs(shiftAt(xs, my));
    if (k < 0.02 && moved < 0.3) continue; // αμετάβλητη στήλη

    const yTop = my - Ul * k;
    const yBot = my + Dl * k;
    const hasOpen = k >= 0.02 && D * k >= 0.3;
    const oh = Math.max(1e-3, yBot - yTop);
    const q = (xd - mx) / Math.max(1, hw);

    for (let y = 0; y < h; y++) {
      const yd = y + 0.5;

      // κάλυψη ανοίγματος (με anti-alias στα όρια)
      let cin = 0;
      if (hasOpen) cin = clamp01(yd - yTop + 0.5) * clamp01(yBot - yd + 0.5);

      // χείλη: αντίστροφη κατακόρυφη μετατόπιση
      if (cin < 1) {
        let ys: number;
        if (!hasOpen) {
          ys = yd;
        } else if (yd < (yTop + yBot) / 2) {
          const t = Math.min(yd, yTop);
          ys = t;
          for (let it = 0; it < 8; it++) ys = t + Ul * k * upW(ys);
        } else {
          const t = Math.max(yd, yBot);
          ys = t;
          for (let it = 0; it < 8; it++) ys = t - Dl * k * dnW(ys);
        }
        let xsy = xd;
        for (let it = 0; it < 2; it++) xsy = xd - shiftAt(xsy, yd);
        sample(xsy, ys, lip3);
        if (hasOpen) {
          // μικρή σκιά επαφής στα χείλη δίπλα στο άνοιγμα
          const d = yd < (yTop + yBot) / 2 ? yTop - yd : yd - yBot;
          const f = 1 - 0.22 * Math.exp(-Math.max(0, d) / (2.2 * s)) * k;
          lip3[0] *= f;
          lip3[1] *= f;
          lip3[2] *= f;
        }
      }

      let r: number;
      let g: number;
      let b: number;

      if (cin > 0) {
        interior(col, xd, yd, yTop, yBot, oh, q);
        r = lip3[0] * (1 - cin) + col[0] * cin;
        g = lip3[1] * (1 - cin) + col[1] * cin;
        b = lip3[2] * (1 - cin) + col[2] * cin;
        if (cin >= 1) {
          r = col[0];
          g = col[1];
          b = col[2];
        }
      } else {
        r = lip3[0];
        g = lip3[1];
        b = lip3[2];
      }

      const o = (y * w + X) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;

    }
  }
  return true;
}