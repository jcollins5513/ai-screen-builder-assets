// Append the v6 entries to IMAGE_PACK_MANIFEST and refresh the header comment.
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST =
  "C:/Users/justi/ai-screen-builder/.claude/worktrees/reverent-hofstadter-46a7eb/src/lib/image-packs/manifest.ts";
const ENTRIES =
  "C:/Users/justi/ai-screen-builder-assets/staging/flowgen-complete-2026-09-20/manifest-entries.v6.txt";

const raw = readFileSync(MANIFEST, "utf8");
const nl = raw.includes("\r\n") ? "\r\n" : "\n";
let src = raw.split("\r\n").join("\n");
const entries = readFileSync(ENTRIES, "utf8").split("\r\n").join("\n").trimEnd();

const start = src.indexOf("export const IMAGE_PACK_MANIFEST: ImagePackEntry[] = [");
if (start < 0) throw new Error("IMAGE_PACK_MANIFEST not found");
const end = src.indexOf("\n];", start);
if (end < 0) throw new Error("end of IMAGE_PACK_MANIFEST not found");

const before = src.slice(0, end);
const after = src.slice(end);
if (/\bd3b2dc41cd87\b/.test(before)) throw new Error("v6 entries already present — refusing to double-insert");

const banner = `
  // --- v6 (2026-09-20): 583 images from the Flow-GenComplete drop ---------------
  // Captions, subject tags and composition were judged from the PIXELS of every
  // file, never from its filename or folder: deriving subjects from generation
  // metadata is what misattributed 15 of 18 subjects and forced tag v4 to be
  // deleted. Routing to packs did use the operator's own folder taxonomy
  // (Indoor / Outside / Animals / Underwater / Abstract / Cut-outs /
  // Transportation), which is a statement of intent rather than a guess about
  // content. 163 candidates were rejected outright for real brand marks,
  // currency, readable signage or malformed output; FlowGen's own mascot and
  // logo artwork was pulled out entirely so it can never ship into a customer's
  // generated page.
  //
  // Three packs are new because the catalog had no home for this material:
  //   terrain  - landscape, nature, wildlife, water  (nothing covered nature)
  //   hearth   - interiors, rooms, surfaces          (alpine-modern held 2)
  //   foundry  - industry, logistics, infrastructure (nothing covered it)
`;

src = `${before}${banner}${entries}${after}`;

// Keep the count in the file header honest.
src = src.replace(
  /\/\/ GENERATED from the ai-screen-builder-assets repo \(tags v1\/v2\/v3\/v5\) — 396/,
  "// GENERATED from the ai-screen-builder-assets repo (tags v1/v2/v3/v5/v6) — 979",
);
src = src.replace(
  /owned images across 18 packs covering end-user domains equally: 253/,
  "owned images across 21 packs covering end-user domains equally: 253",
);

writeFileSync(MANIFEST, src.split("\n").join(nl));
console.log(`inserted ${entries.split("\n").length} entries`);
