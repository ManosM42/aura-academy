// Usage:  npm i -D sharp   then   node scripts/optimize-gallery.mjs
// Reads src/assets/p1.jpg ... p31.jpg and writes small WebP copies:
//   src/assets/gallery/thumbs/pN.webp  (grid, 800px)
//   src/assets/gallery/full/pN.webp    (full-screen viewer, 1800px)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const dir = "src/assets";
const thumbs = path.join(dir, "gallery", "thumbs");
const full = path.join(dir, "gallery", "full");
fs.mkdirSync(thumbs, { recursive: true });
fs.mkdirSync(full, { recursive: true });

const files = fs.readdirSync(dir).filter((f) => /^p\d+\.(jpe?g|png|webp)$/i.test(f));
for (const f of files) {
  const name = f.replace(/\.[^.]+$/, "");
  const input = path.join(dir, f);
  await sharp(input).rotate().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(full, `${name}.webp`));
  await sharp(input).rotate().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 74 }).toFile(path.join(thumbs, `${name}.webp`));
  console.log("ok", f);
}
console.log(`Done: ${files.length} images. Now move the originals out of src/assets.`);
