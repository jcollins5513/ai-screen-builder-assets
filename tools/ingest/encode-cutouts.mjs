// Encode the background-removed renders to the cutout byte budget (1 MB) and
// append them to encoded.json so they flow through the same caption/assign/build
// path as everything else.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  "C:/Users/justi/ai-screen-builder/.claude/worktrees/reverent-hofstadter-46a7eb/package.json",
);
const sharp = require("sharp");

const STAGING = "C:/Users/justi/ai-screen-builder-assets/staging/flowgen-complete-2026-09-20";
const OUT = join(STAGING, "encoded", "Cut-outs-bg-removed");
const THUMBS = join(STAGING, "thumbs");
mkdirSync(OUT, { recursive: true });

const BUDGET = 950_000;
const removed = JSON.parse(readFileSync(`${STAGING}/bg-removed.json`, "utf8"));
const encoded = JSON.parse(readFileSync(`${STAGING}/encoded.json`, "utf8"));
const known = new Set(encoded.map((r) => r.shortId));

const added = [];
for (const item of removed) {
  if (!item.transparent) {
    console.error(`  skip ${item.base}: no real transparency`);
    continue;
  }
  const shortId = item.sourceHash.slice(0, 12);
  if (known.has(shortId)) {
    console.error(`  skip ${shortId}: already encoded`);
    continue;
  }
  const input = readFileSync(item.file);
  let chosen = null;
  for (const quality of [88, 80, 72, 64]) {
    const buf = await sharp(input)
      .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
      .webp({ quality, alphaQuality: 92, effort: 5 })
      .toBuffer();
    if (buf.length <= BUDGET) {
      chosen = { buf, quality };
      break;
    }
  }
  if (!chosen) {
    console.error(`  FAIL ${item.base}: over budget`);
    continue;
  }

  const dest = join(OUT, `${shortId}.webp`);
  writeFileSync(dest, chosen.buf);
  const meta = await sharp(chosen.buf).metadata();

  await sharp(input)
    .resize({ width: 448, height: 448, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#f2f2f2" })
    .webp({ quality: 72 })
    .toFile(join(THUMBS, `${shortId}.webp`));

  added.push({
    hash: item.sourceHash,
    source: item.base,
    folder: "Cut-outs-bg-removed",
    base: item.base,
    ext: ".webp",
    bytes: item.bytes,
    bucket: "cutout",
    why: "background removed with Magnific on 2026-09-20; transparency verified",
    raw: item.file,
    hasAlphaChannel: true,
    shortId,
    encoded: dest,
    thumb: join(THUMBS, `${shortId}.webp`),
    encodedBytes: chosen.buf.length,
    encodedWidth: meta.width,
    encodedHeight: meta.height,
    encodedQuality: chosen.quality,
    aspect: Number((meta.width / meta.height).toFixed(3)),
    orientation: meta.width === meta.height ? "square" : meta.width > meta.height ? "landscape" : "portrait",
    tone: "light",
  });
  console.log(`  ${shortId}  ${meta.width}x${meta.height}  ${(chosen.buf.length / 1024).toFixed(0).padStart(4)} KB  q${chosen.quality}`);
}

writeFileSync(`${STAGING}/encoded.json`, JSON.stringify([...encoded, ...added], null, 1));
console.log(`\nadded ${added.length} cutouts; encoded.json now holds ${encoded.length + added.length}`);
console.log(JSON.stringify({ dir: THUMBS, images: added.map((a) => `${a.shortId} ${a.encodedWidth}x${a.encodedHeight} light alpha`) }));
