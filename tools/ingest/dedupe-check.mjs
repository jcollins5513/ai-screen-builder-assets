// Exact-byte overlap: Flow-GenComplete.zip entries vs the published asset packs
// and vs the already-extracted Downloads\Flow-Gen folder.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  "C:/Users/justi/ai-screen-builder/.claude/worktrees/reverent-hofstadter-46a7eb/package.json",
);
const yauzl = (() => {
  try {
    return require("yauzl");
  } catch {
    return null;
  }
})();

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// 1. Hash the published packs.
const packsRoot = "C:/Users/justi/ai-screen-builder-assets/packs";
const packHashes = new Map();
for (const file of walk(packsRoot)) {
  packHashes.set(sha(readFileSync(file)), file.slice(packsRoot.length + 1));
}
console.log(`published pack files: ${packHashes.size} unique hashes`);

// 2. Hash the already-extracted Flow-Gen folder (the older drop).
const oldRoot = "C:/Users/justi/Downloads/Flow-Gen";
const oldHashes = new Map();
for (const file of walk(oldRoot)) {
  oldHashes.set(sha(readFileSync(file)), file.slice(oldRoot.length + 1));
}
console.log(`older Flow-Gen drop: ${oldHashes.size} unique hashes`);

// 3. Hash every zip entry via PowerShell-extracted temp? No - use yauzl if present.
if (!yauzl) {
  console.log("yauzl not installed; run the PowerShell variant instead");
  process.exit(2);
}

const zipPath = "C:/Users/justi/Downloads/Flow-GenComplete.zip";
const rows = [];
await new Promise((resolve, reject) => {
  yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
    if (err) return reject(err);
    zip.readEntry();
    zip.on("entry", (entry) => {
      if (/\/$/.test(entry.fileName)) return zip.readEntry();
      zip.openReadStream(entry, (e2, stream) => {
        if (e2) return reject(e2);
        const chunks = [];
        stream.on("data", (c) => chunks.push(c));
        stream.on("end", () => {
          const buf = Buffer.concat(chunks);
          const h = sha(buf);
          rows.push({
            name: entry.fileName,
            bytes: buf.length,
            hash: h,
            inPacks: packHashes.get(h) ?? "",
            inOldDrop: oldHashes.get(h) ?? "",
          });
          zip.readEntry();
        });
        stream.on("error", reject);
      });
    });
    zip.on("end", resolve);
    zip.on("error", reject);
  });
});

// 4. Internal duplicates inside the zip itself.
const byHash = new Map();
for (const r of rows) {
  if (!byHash.has(r.hash)) byHash.set(r.hash, []);
  byHash.get(r.hash).push(r.name);
}
const internalDupGroups = [...byHash.values()].filter((g) => g.length > 1);

const alreadyPublished = rows.filter((r) => r.inPacks);
const inOldDrop = rows.filter((r) => r.inOldDrop);

console.log("");
console.log(`zip files hashed          : ${rows.length}`);
console.log(`unique by content         : ${byHash.size}`);
console.log(`internal duplicate groups : ${internalDupGroups.length} (${rows.length - byHash.size} redundant files)`);
console.log(`ALREADY in published packs: ${alreadyPublished.length}`);
console.log(`also in older Flow-Gen.zip: ${inOldDrop.length}`);
console.log(`=> genuinely new, unique  : ${byHash.size - alreadyPublished.length}`);

console.log("");
console.log("new-and-unique by folder:");
const seen = new Set();
const byFolder = new Map();
for (const r of rows) {
  if (r.inPacks) continue;
  if (seen.has(r.hash)) continue;
  seen.add(r.hash);
  const folder = r.name.includes("/") ? r.name.split("/").slice(0, -1).join("/") : "(root)";
  byFolder.set(folder, (byFolder.get(folder) ?? 0) + 1);
}
for (const [folder, n] of [...byFolder.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${folder}`);
}

writeFileSync(
  "C:/Users/justi/AppData/Local/Temp/claude/C--Users-justi-ai-screen-builder--claude-worktrees-reverent-hofstadter-46a7eb/e2a9c533-ca2c-4e25-b747-6eeff65f2d33/scratchpad/zip-hashes.json",
  JSON.stringify(rows, null, 1),
);
console.log("\nwrote zip-hashes.json");
