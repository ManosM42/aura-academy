export type Viseme = { open: number; width: number };

export const CLOSED: Viseme = { open: 0, width: 1 };
const SMALL: Viseme = { open: 0.22, width: 1 };
const A: Viseme = { open: 1, width: 1 };
const E: Viseme = { open: 0.62, width: 1.05 };
const I: Viseme = { open: 0.32, width: 1.08 };
const O: Viseme = { open: 0.72, width: 0.55 };
const U: Viseme = { open: 0.4, width: 0.45 };
const FV: Viseme = { open: 0.12, width: 1 };

const MAP: Record<string, Viseme> = {
  α: A, a: A,
  ε: E, e: E,
  η: I, ι: I, υ: I, i: I, y: I,
  ο: O, ω: O, o: O,
  u: U,
  μ: CLOSED, π: CLOSED, m: CLOSED, p: CLOSED, b: CLOSED,
  φ: FV, β: FV, f: FV, v: FV,
};

// πρώτο γράμμα χωρίς τόνο· το μήκος του κειμένου μένει ίδιο (σημαντικό για το charIndex)
const base = (ch: string) =>
  (ch.toLowerCase().normalize("NFD")[0] ?? ch).replace("ς", "σ");

/** Ένα viseme ανά χαρακτήρα του κειμένου (ίδια ευρετηρίαση με το charIndex). */
export function visemesForText(text: string): Viseme[] {
  const out: Viseme[] = new Array(text.length);
  for (let i = 0; i < text.length; i++) {
    if (out[i]) continue;
    const c = base(text[i]);
    const n = i + 1 < text.length ? base(text[i + 1]) : "";
    if (c === "ο" && n === "υ") {
      out[i] = U;
      out[i + 1] = U;
      continue;
    }
    out[i] = /\p{L}/u.test(c) ? (MAP[c] ?? SMALL) : CLOSED;
  }
  return out;
}