// Extract Flow-GenComplete.zip to staging, skipping exact duplicates of what is
// already published, and record binary facts for every candidate.
//
// Writes:  <staging>/raw/<folder>/<original-name>
//          <staging>/triage.json
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  "C:/Users/justi/ai-screen-builder/.claude/worktrees/reverent-hofstadter-46a7eb/package.json",
);
const yauzl = require("yauzl");
const sharp = require("sharp");

const STAGING = "C:/Users/justi/ai-screen-builder-assets/staging/flowgen-complete-2026-09-20";
const RAW = join(STAGING, "raw");
const ZIP = "C:/Users/justi/Downloads/Flow-GenComplete.zip";
const PACKS = "C:/Users/justi/ai-screen-builder-assets/packs";

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const published = new Set();
for (const file of walk(PACKS)) published.add(sha(readFileSync(file)));
console.log(`published hashes: ${published.size}`);

mkdirSync(RAW, { recursive: true });

/** Route each source folder to a disposition. */
function disposition(folder, ext) {
  if (ext === ".mp4") return { bucket: "excluded", why: "video - the catalog is images only" };
  if (folder.startsWith("Flow-Gen Logos")) return { bucket: "brand", why: "FlowGen lockup - app brand asset, not generation imagery" };
  if (folder.startsWith("Mascots")) return { bucket: "brand", why: "FlowGen mascot - app brand asset, not generation imagery" };
  if (folder.startsWith("Needs B/G Removed")) return { bucket: "not-ready", why: "background removal pending" };
  if (folder.startsWith("Cut-outs")) return { bucket: "cutout", why: "candidate for the cutouts overlay pack - needs alpha proof" };
  return { bucket: "photo", why: "" };
}

const rows = [];
const seen = new Set();
let skippedPublished = 0;
let skippedDup = 0;

await new Promise((resolve, reject) => {
  yauzl.open(ZIP, { lazyEntries: true }, (err, zip) => {
    if (err) return reject(err);
    zip.readEntry();
    zip.on("entry", (entry) => {
      if (/\/$/.test(entry.fileName)) return zip.readEntry();
      zip.openReadStream(entry, async (e2, stream) => {
        if (e2) return reject(e2);
        const chunks = [];
        stream.on("data", (c) => chunks.push(c));
        stream.on("error", reject);
        stream.on("end", async () => {
          const buf = Buffer.concat(chunks);
          const hash = sha(buf);
          const name = entry.fileName;
          const folder = name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : "(root)";
          const base = name.slice(name.lastIndexOf("/") + 1);
          const ext = base.slice(base.lastIndexOf(".")).toLowerCase();

          if (published.has(hash)) { skippedPublished++; return zip.readEntry(); }
          if (seen.has(hash)) { skippedDup++; return zip.readEntry(); }
          seen.add(hash);

          const dest = join(RAW, folder, base);
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, buf);

          const d = disposition(folder, ext);
          const row = {
            hash,
            source: name,
            folder,
            base,
            ext,
            bytes: buf.length,
            bucket: d.bucket,
            why: d.why,
            raw: dest,
          };

          if (d.bucket !== "excluded") {
            try {
              const meta = await sharp(buf).metadata();
              row.width = meta.width;
              row.height = meta.height;
              row.format = meta.format;
              row.hasAlphaChannel = Boolean(meta.hasAlpha);
              row.orientation =
                meta.width === meta.height ? "square" : meta.width > meta.height ? "landscape" : "portrait";
              row.aspect = Number((meta.width / meta.height).toFixed(3));
              // Mean luminance over a tiny greyscale thumbnail -> tone evidence.
              const stats = await sharp(buf).removeAlpha().greyscale().resize(32, 32, { fit: "inside" }).stats();
              row.meanLuma = Number(stats.channels[0].mean.toFixed(1));
              row.tone = stats.channels[0].mean < 110 ? "dark" : "light";
            } catch (err3) {
              row.bucket = "excluded";
              row.why = `unreadable image: ${err3.message}`;
            }
          }
          rows.push(row);
          zip.readEntry();
        });
      });
    });
    zip.on("end", resolve);
    zip.on("error", reject);
  });
});

writeFileSync(join(STAGING, "triage.json"), JSON.stringify(rows, null, 1));

const byBucket = new Map();
for (const r of rows) byBucket.set(r.bucket, (byBucket.get(r.bucket) ?? 0) + 1);

console.log("");
console.log(`skipped (already published): ${skippedPublished}`);
console.log(`skipped (duplicate in zip) : ${skippedDup}`);
console.log(`staged                     : ${rows.length}`);
console.log("");
for (const [b, n] of [...byBucket].sort((a, b2) => b2[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${b}`);

const photos = rows.filter((r) => r.bucket === "photo");
console.log("");
console.log("photo bucket:");
console.log(`  orientation: ${JSON.stringify(count(photos, (r) => r.orientation))}`);
console.log(`  tone       : ${JSON.stringify(count(photos, (r) => r.tone))}`);
console.log(`  format     : ${JSON.stringify(count(photos, (r) => r.format))}`);
const cut = rows.filter((r) => r.bucket === "cutout");
console.log(`cutout bucket alpha present: ${cut.filter((r) => r.hasAlphaChannel).length} / ${cut.length}`);

function count(list, fn) {
  const m = {};
  for (const r of list) m[fn(r)] = (m[fn(r)] ?? 0) + 1;
  return m;
}
console.log(`\nstaged to ${RAW}`);
