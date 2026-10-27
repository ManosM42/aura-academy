// Loads src/assets/p1..p31 (jpg) and p.mp4, p2.mp4 ... p8.mp4.
// If you ran scripts/optimize-gallery.mjs, the small WebP versions in
// src/assets/gallery/{thumbs,full} are used automatically (much faster).
const orig = import.meta.glob("../assets/p*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}", { eager: true, import: "default" }) as Record<string, string>;
const fulls = import.meta.glob("../assets/gallery/full/p*.webp", { eager: true, import: "default" }) as Record<string, string>;
const thumbs = import.meta.glob("../assets/gallery/thumbs/p*.webp", { eager: true, import: "default" }) as Record<string, string>;
const vids = import.meta.glob("../assets/p*.{mp4,MP4,mov,webm}", { eager: true, import: "default" }) as Record<string, string>;

export type GalleryItem = {
  id: string;
  type: "image" | "video";
  /** full quality (viewer) */
  src: string;
  /** light version (grid) */
  thumb: string;
  /** general AURA tagline */
  title: string;
  no: string;
};

const TAGLINES = [
  "Where barbers are made.",
  "Craft first, always.",
  "Precision, patience, pride.",
  "Barbering is an art.",
  "Built in the chair.",
  "The AURA standard.",
  "Sharp. Clean. Confident.",
  "Passion you can see.",
];

type Src = { orig?: string; full?: string; thumb?: string };
const byN = new Map<number, Src>();
function put(mods: Record<string, string>, key: keyof Src) {
  for (const [path, src] of Object.entries(mods)) {
    const m = path.match(/\/p(\d+)\.[^./]+$/);
    if (!m) continue;
    const n = Number(m[1]);
    byN.set(n, { ...byN.get(n), [key]: src });
  }
}
put(orig, "orig");
put(fulls, "full");
put(thumbs, "thumb");

const photos: GalleryItem[] = [...byN.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([n, s]) => ({
    id: `p${n}`,
    type: "image" as const,
    src: (s.full ?? s.orig ?? s.thumb)!,
    thumb: (s.thumb ?? s.full ?? s.orig)!,
    title: "",
    no: "",
  }));

const videos: GalleryItem[] = Object.entries(vids)
  .map(([path, src]) => {
    const m = path.match(/\/p(\d*)\.[^./]+$/);
    return m ? { n: m[1] ? Number(m[1]) : 1, src } : null;
  })
  .filter((x): x is { n: number; src: string } => !!x)
  .sort((a, b) => a.n - b.n)
  .map(({ n, src }) => ({ id: `v${n}`, type: "video" as const, src, thumb: src, title: "", no: "" }));

export type GalleryBlock = { feature: GalleryItem; side: "left" | "right"; smalls: GalleryItem[] };

// Symmetric layout: a 2x2 feature tile + a 2x2 group of four tiles, alternating sides.
const p = [...photos];
const v = [...videos];
export const GALLERY_BLOCKS: GalleryBlock[] = [];
while (p.length >= 4 && (v.length > 0 || p.length >= 5)) {
  const feature = (v.shift() ?? p.shift())!;
  GALLERY_BLOCKS.push({ feature, side: GALLERY_BLOCKS.length % 2 === 0 ? "left" : "right", smalls: p.splice(0, 4) });
}
export const GALLERY_FINALE: GalleryItem[] =
  v.length && p.length ? [p[0], v[0], ...p.slice(1), ...v.slice(1)] : [...p, ...v];

export const GALLERY: GalleryItem[] = [
  ...GALLERY_BLOCKS.flatMap((b) => [b.feature, ...b.smalls]),
  ...GALLERY_FINALE,
];
GALLERY.forEach((g, i) => {
  g.title = TAGLINES[i % TAGLINES.length];
  g.no = String(i + 1).padStart(2, "0");
});

export const PHOTO_COUNT = photos.length;
export const VIDEO_COUNT = videos.length;