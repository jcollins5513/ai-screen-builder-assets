// Re-encode staged candidates to the byte budgets the assets-repo ingester
// enforces, and emit small thumbnails for the caption pass.
//
//   MAX_BYTES_BY_SLOT: hero 500k / split 400k / everything else 300k
//   cutoutCapable:     1,000,000
//
// Encoding to <=290 KB means one file satisfies EVERY slot budget, so slot
// assignment stays a judgement about composition rather than a size constraint.
import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  "C:/Users/justi/ai-screen-builder/.claude/worktrees/reverent-hofstadter-46a7eb/package.json",
);
const sharp = require("sharp");

const STAGING = "C:/Users/justi/ai-screen-builder-assets/staging/flowgen-complete-2026-09-20";
const OUT = join(STAGING, "encoded");
const THUMBS = join(STAGING, "thumbs");

const PHOTO_BUDGET = 290_000;
const CUTOUT_BUDGET = 950_000;
const PHOTO_LONG_EDGE = 1920;
const CUTOUT_LONG_EDGE = 1536;
const THUMB_LONG_EDGE = 448;

const rows = JSON.parse(readFileSync(join(STAGING, "triage.json"), "utf8"));
const work = rows.filter((r) => r.bucket === "photo" || r.bucket === "cutout");

mkdirSync(OUT, { recursive: true });
mkdirSync(THUMBS, { recursive: true });

/** Shrink quality until the encode fits the budget; drop scale as a last resort. */
async function encodeToBudget(input, { budget, longEdge, alpha }) {
  for (const scale of [1, 0.85, 0.7, 0.55]) {
    const edge = Math.round(longEdge * scale);
    for (const quality of [82, 74, 66, 58, 50, 42]) {
      const buf = await sharp(input)
        .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
        .webp({ quality, alphaQuality: alpha ? 90 : undefined, effort: 5 })
        .toBuffer();
      if (buf.length <= budget) return { buf, quality, edge };
    }
  }
  return null;
}

let ok = 0;
let failed = 0;
const out = [];

for (const [index, row] of work.entries()) {
  const isCutout = row.bucket === "cutout";
  const input = readFileSync(row.raw);
  const result = await encodeToBudget(input, {
    budget: isCutout ? CUTOUT_BUDGET : PHOTO_BUDGET,
    longEdge: isCutout ? CUTOUT_LONG_EDGE : PHOTO_LONG_EDGE,
    alpha: isCutout,
  });

  if (!result) {
    failed++;
    out.push({ ...row, encodeError: "could not reach the byte budget" });
    continue;
  }

  // Stable short id from the content hash: the cutouts pack already uses opaque
  // provider ids as filenames, so this matches existing practice.
  const shortId = row.hash.slice(0, 12);
  const dest = join(OUT, row.folder, `${shortId}.webp`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, result.buf);

  const meta = await sharp(result.buf).metadata();

  const thumb = join(THUMBS, `${shortId}.webp`);
  await sharp(input)
    .resize({ width: THUMB_LONG_EDGE, height: THUMB_LONG_EDGE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: isCutout ? "#f2f2f2" : "#ffffff" })
    .webp({ quality: 72 })
    .toFile(thumb);

  out.push({
    ...row,
    shortId,
    encoded: dest,
    thumb,
    encodedBytes: result.buf.length,
    encodedWidth: meta.width,
    encodedHeight: meta.height,
    encodedQuality: result.quality,
    aspect: Number((meta.width / meta.height).toFixed(3)),
    orientation: meta.width === meta.height ? "square" : meta.width > meta.height ? "landscape" : "portrait",
  });
  ok++;
  if ((index + 1) % 100 === 0) console.log(`  ${index + 1}/${work.length}`);
}

writeFileSync(join(STAGING, "encoded.json"), JSON.stringify(out, null, 1));

const before = work.reduce((n, r) => n + r.bytes, 0);
const after = out.reduce((n, r) => n + (r.encodedBytes ?? 0), 0);
console.log("");
console.log(`encoded : ${ok}`);
console.log(`failed  : ${failed}`);
console.log(`bytes   : ${(before / 1048576).toFixed(0)} MB -> ${(after / 1048576).toFixed(0)} MB`);
console.log(`mean    : ${(after / Math.max(ok, 1) / 1024).toFixed(0)} KB per file (published packs average 318 KB)`);
const q = {};
for (const r of out) if (r.encodedQuality) q[r.encodedQuality] = (q[r.encodedQuality] ?? 0) + 1;
console.log(`quality : ${JSON.stringify(q)}`);
