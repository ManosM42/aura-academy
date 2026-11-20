// faceSpec.ts
// Όλη η βαθμονόμηση για τη συγκεκριμένη εικόνα (aura-chrome.jpg, 1120×1260) σε ένα σημείο.
// Αν αλλάξεις εικόνα, αλλάζεις μόνο αυτό το αρχείο. Με debug={true} βλέπεις τις γραμμές πάνω στο πρόσωπο.
import type { EyeSpec, Pt } from "./eyeBlink";
import type { MouthSpec } from "./mouthWarp";

export const FACE_SRC = "/aura-chrome.jpg";
export const FACE_W = 1120;
export const FACE_H = 1260;
export const FACE_ASPECT = FACE_W / FACE_H;

/** Σημείο εστίασης όταν η εικόνα κόβεται (object-fit: cover), π.χ. στο κινητό. */
export const FACE_FOCUS = { x: 0.5, y: 0.27 };

const n = (pts: [number, number][]): Pt[] => pts.map(([x, y]) => [x / FACE_W, y / FACE_H] as const);

/** Στόμα: κέντρο στη γραμμή ανάμεσα στα χείλη (x=560.5, y=484), γωνίες στο ±70px. */
export const MOUTH: MouthSpec = {
  x: 560.5 / FACE_W,
  y: 484 / FACE_H,
  halfW: 70 / FACE_W,
  jaw: 120 / FACE_H,
  lip: 29 / FACE_H,
  maxOpen: 29 / FACE_H,
};

/** Μάτια: `up` = άκρη πάνω βλεφάρου, `lo` = άκρη κάτω βλεφάρου. Πρώτο = αριστερό της εικόνας. */
export const EYES: EyeSpec[] = [
  {
    up: n([[436, 309], [444, 301.5], [454, 297.5], [469, 295.5], [484, 296], [499, 300], [511, 307], [523, 317]]),
    lo: n([[436, 309], [441, 314.5], [449, 320], [459, 323], [474, 324.5], [489, 323.5], [504, 322.5], [517, 323], [523, 317]]),
  },
  {
    up: n([[604, 318], [614, 306], [624, 300], [634, 297], [649, 295.5], [664, 296], [674, 299], [681, 304], [687, 311]]),
    lo: n([[604, 318], [611, 322], [619, 321], [629, 322.5], [639, 324], [654, 324.8], [666, 323.5], [674, 320.5], [681, 316.5], [687, 311]]),
  },
];