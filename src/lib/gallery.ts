// Loads src/assets/p1..p6 (any common image extension) and src/assets/p.mp4.
// Missing files are simply skipped, so the page never breaks.
const imgModules = import.meta.glob("../assets/p[1-6].{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const vidModules = import.meta.glob("../assets/p.{mp4,MP4,mov,webm}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export type GalleryItem = {
  id: string;
  type: "image" | "video";
  src: string;
  title: string;
  tag: string;
  /** grid span classes (2 cols on mobile, 4 on desktop) */
  span: string;
};

const images: Record<number, string> = {};
for (const [path, src] of Object.entries(imgModules)) {
  const n = Number(path.match(/p([1-6])\./)?.[1]);
  if (n) images[n] = src;
}
const video = Object.values(vidModules)[0];

// Edit titles / tags freely.
const META: Record<number, { title: string; tag: string; span: string }> = {
  1: { title: "Signature Fade", tag: "Precision", span: "col-span-2 row-span-2" },
  2: { title: "Clean Lines", tag: "Finish", span: "col-span-1 row-span-1" },
  3: { title: "Texture & Flow", tag: "Styling", span: "col-span-1 row-span-2" },
  4: { title: "The Details", tag: "Craft", span: "col-span-1 row-span-1" },
  5: { title: "Sharp Contrast", tag: "Cutting", span: "col-span-2 row-span-1" },
  6: { title: "Fresh Out Of The Chair", tag: "Result", span: "col-span-1 row-span-2" },
};

const order: (number | "video")[] = [1, 2, 3, "video", 4, 5, 6];

export const GALLERY: GalleryItem[] = order.flatMap((k): GalleryItem[] => {
  if (k === "video") {
    return video
      ? [{ id: "video", type: "video", src: video, title: "In Motion", tag: "Live work", span: "col-span-2 row-span-2" }]
      : [];
  }
  const src = images[k];
  return src ? [{ id: `p${k}`, type: "image", src, ...META[k] }] : [];
});

export const GALLERY_IMAGES = GALLERY.filter((g) => g.type === "image");