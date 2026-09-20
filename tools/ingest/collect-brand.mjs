// Collect the FlowGen brand work into its own folder, at ORIGINAL resolution —
// these are for shell building, not for the generator, so the pack byte budget
// does not apply. Sorted by what each image actually is.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const STAGING = "C:/Users/justi/ai-screen-builder-assets/staging/flowgen-complete-2026-09-20";
const DEST = "C:/Users/justi/Downloads/FlowGen-Brand-Assets";

const brand = JSON.parse(readFileSync(`${STAGING}/flowgen-brand.json`, "utf8"));
const triage = JSON.parse(readFileSync(`${STAGING}/triage.json`, "utf8"));
const encoded = JSON.parse(readFileSync(`${STAGING}/encoded.json`, "utf8"));
const rawByHash = new Map(triage.map((r) => [r.hash, r]));
const hashById = new Map(encoded.map((r) => [r.shortId, r.hash]));

function kind(caption) {
  const tags = new Set(caption.subjectTags);
  if (tags.has("mascot") || tags.has("cartoon-character")) return "mascot";
  if (tags.has("brand-sheet") || /brand sheet|style sheet|colour swatch|color swatch/i.test(caption.subjectDescription)) {
    return "brand-sheets";
  }
  if (tags.has("wordmark") || tags.has("logo") || /lockup|wordmark/i.test(caption.subjectDescription)) return "logo";
  return "other";
}

const index = [];
let copied = 0;

for (const caption of brand) {
  const hash = hashById.get(caption.id);
  const row = hash ? rawByHash.get(hash) : null;
  if (!row) {
    console.error(`  no source for ${caption.id}`);
    continue;
  }
  const bucket = kind(caption);
  mkdirSync(join(DEST, bucket), { recursive: true });
  const dest = join(DEST, bucket, row.base);
  copyFileSync(row.raw, dest);
  copied++;
  index.push({
    file: `${bucket}/${row.base}`,
    description: caption.subjectDescription,
    tags: caption.subjectTags,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    hasTransparency: Boolean(row.hasAlphaChannel),
  });
}

// The two folders that were already labelled as brand in the zip.
for (const row of triage.filter((r) => r.bucket === "brand")) {
  const bucket = row.folder.startsWith("Mascots") ? "mascot" : "logo";
  mkdirSync(join(DEST, bucket), { recursive: true });
  copyFileSync(row.raw, join(DEST, bucket, row.base));
  copied++;
  index.push({
    file: `${bucket}/${row.base}`,
    description: `From the zip's "${row.folder}" folder.`,
    tags: [],
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    hasTransparency: Boolean(row.hasAlphaChannel),
  });
}

// The three motion files, which the image catalog cannot hold either.
mkdirSync(join(DEST, "video"), { recursive: true });
for (const row of triage.filter((r) => r.bucket === "excluded" && r.ext === ".mp4")) {
  copyFileSync(row.raw, join(DEST, "video", row.base));
  copied++;
  index.push({ file: `video/${row.base}`, description: "Motion clip from the drop.", tags: [], bytes: row.bytes });
}

index.sort((a, b) => a.file.localeCompare(b.file));
const counts = index.reduce((m, r) => ((m[r.file.split("/")[0]] = (m[r.file.split("/")[0]] ?? 0) + 1), m), {});

const readme = `# FlowGen brand assets

Set aside from \`Flow-GenComplete.zip\` on 2026-09-20. These are FlowGen's own
brand and mascot artwork plus the motion clips — for shell building, NOT for the
generator's image packs. They are kept at ORIGINAL resolution.

They were identified by looking at every image in the drop: anything carrying the
FlowGen mascot, wordmark or lockup was pulled out here rather than published,
because an owned-image pack that contains your own branding would stamp it onto
customers' generated pages.

${Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .map(([k, n]) => `- \`${k}/\` — ${n} file${n === 1 ? "" : "s"}`)
  .join("\n")}

\`index.json\` lists every file with a description of what is actually in it.
`;

mkdirSync(DEST, { recursive: true });
writeFileSync(join(DEST, "index.json"), JSON.stringify(index, null, 1));
writeFileSync(join(DEST, "README.md"), readme);

console.log(`copied ${copied} files to ${DEST}`);
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k}/`);
