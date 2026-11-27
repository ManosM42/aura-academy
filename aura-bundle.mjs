// aura-bundle.mjs
// Usage (from the project root): node aura-bundle.mjs [projectRoot]
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const OUT = path.join(ROOT, "aura-out");
const MAX_CHUNK_BYTES = 60 * 1024;
const MAX_FILE_BYTES = 40 * 1024;

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", ".temp",
  "coverage", ".vercel", "aura-out",
]);
const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".sql", ".json", ".toml", ".md",
]);
const SKIP_FILE = /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$|^\.env/;
const KEYWORDS = /viva|payment|checkout|invoice|receipt|fiscal|mydata|aade|refund|webhook|order|subscription|billing|vat|email|migration/gi;

const SECRET_ASSIGNMENT =
  /((?:secret|password|passwd|token|api[_-]?key|service[_-]?role|authorization)["']?\s*[:=]\s*)(["'`])[^"'`\n]{8,}\2/gi;
const JWT = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function redact(text) {
  return text
    .replace(SECRET_ASSIGNMENT, "$1$2[REDACTED]$2")
    .replace(JWT, "[REDACTED_JWT]");
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, files);
    } else if (
      entry.isFile() &&
      !SKIP_FILE.test(entry.name) &&
      TEXT_EXT.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(full);
    }
  }
  return files;
}

function score(relPath, content) {
  const pathHits = (relPath.match(KEYWORDS) || []).length;
  const contentHits = (content.match(KEYWORDS) || []).length;
  return pathHits * 20 + Math.min(contentHits, 50);
}

function main() {
  const records = walk(ROOT).map((full) => {
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    const raw = fs.readFileSync(full, "utf8");
    return {
      rel,
      bytes: Buffer.byteLength(raw),
      score: score(rel, raw),
      content: redact(raw),
    };
  });

  records.sort((a, b) => b.score - a.score || a.rel.localeCompare(b.rel));

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const mapLines = records.map(
    (r) => `${String(r.score).padStart(4)} | ${String(r.bytes).padStart(7)} B | ${r.rel}`
  );
  fs.writeFileSync(
    path.join(OUT, "aura-map.txt"),
    `score | size | path\n${mapLines.join("\n")}\n`
  );

  let chunkIndex = 1;
  let chunk = "";
  let chunkBytes = 0;
  const flush = () => {
    if (!chunk) return;
    const name = `bundle-${String(chunkIndex).padStart(2, "0")}.txt`;
    fs.writeFileSync(path.join(OUT, name), chunk);
    chunkIndex += 1;
    chunk = "";
    chunkBytes = 0;
  };

  for (const r of records) {
    let body = r.content;
    let note = "";
    if (Buffer.byteLength(body) > MAX_FILE_BYTES) {
      body = Buffer.from(body).subarray(0, MAX_FILE_BYTES).toString("utf8");
      note = `\n[TRUNCATED: file is ${r.bytes} bytes, first ${MAX_FILE_BYTES} included]`;
    }
    const block = `=== FILE: ${r.rel} ===\n${body}${note}\n=== END FILE ===\n\n`;
    const size = Buffer.byteLength(block);
    if (chunkBytes + size > MAX_CHUNK_BYTES) flush();
    chunk += block;
    chunkBytes += size;
  }
  flush();

  console.log(`Files: ${records.length}. Bundles: ${chunkIndex - 1}. Output: ${OUT}`);
}

main();