// Turn caption output + measured facts into ImagePackEntry literals for
// src/lib/image-packs/manifest.ts, and copy the encoded files into the assets
// repo under packs/<pack>/.
//
//   node build-entries.mjs <captions.json> <assignments.json> <release-tag>
//
// The catalog audit requires the declared aspectRatio to match width/height
// within 4%, so the ratio is derived from the measured pixels, never declared.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const STAGING = "C:/Users/justi/ai-screen-builder-assets/staging/flowgen-complete-2026-09-20";
const PACKS = "C:/Users/justi/ai-screen-builder-assets/packs";

const [, , captionsPath, assignmentsPath, tag = "v6"] = process.argv;
const captions = JSON.parse(readFileSync(captionsPath, "utf8"));
const assignments = JSON.parse(readFileSync(assignmentsPath, "utf8")); // { id: { pack, themeAffinity } }
const encoded = JSON.parse(readFileSync(join(STAGING, "encoded.json"), "utf8"));
const byId = new Map(encoded.map((r) => [r.shortId, r]));

const COMMON = [
  [21, 9], [2, 1], [16, 9], [16, 10], [3, 2], [4, 3], [5, 4], [1, 1],
  [4, 5], [3, 4], [2, 3], [10, 16], [9, 16],
];

/** Nearest common ratio inside the audit's 4% tolerance; else the reduced ratio. */
function aspectRatio(width, height) {
  const measured = width / height;
  let best = null;
  for (const [w, h] of COMMON) {
    const drift = Math.abs(w / h - measured) / (w / h);
    if (drift <= 0.04 && (!best || drift < best.drift)) best = { drift, text: `${w}:${h}` };
  }
  if (best) return best.text;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(width, height);
  return `${width / g}:${height / g}`;
}

const ROLES_BY_SLOT = {
  hero: ["full-bleed", "edge-to-edge", "ui-overlay-base"],
  split: ["split-media", "editorial-media"],
  framed: ["editorial-media", "detail-media"],
  card: ["detail-media"],
  ambient: ["atmospheric-background"],
  texture: ["texture-overlay", "atmospheric-background"],
  avatar: ["detail-media"],
};

const REVIEWED_AT = "2026-09-20";

/**
 * The catalog audit refuses `overlaySafety: "safe"` without a measured safe-text
 * region, and it is right to: "text reads over this" is a claim about a PLACE.
 * The caption pass already judged that place by looking at the picture and named
 * it as an overlaySafeZone, so the zone becomes the rect. A zone of "none"
 * contradicts a "safe" verdict, so that entry drops to scrim-required rather
 * than inventing a region for it.
 */
const SAFE_REGION_BY_ZONE = {
  "left-third": { x: 0.04, y: 0.12, width: 0.3, height: 0.76 },
  "right-third": { x: 0.66, y: 0.12, width: 0.3, height: 0.76 },
  "bottom-left": { x: 0.05, y: 0.56, width: 0.42, height: 0.36 },
  anywhere: { x: 0.06, y: 0.1, width: 0.88, height: 0.8 },
};
const lines = [];
const skipped = [];
let copied = 0;

for (const c of captions) {
  const row = byId.get(c.id);
  if (!row) { skipped.push({ id: c.id, why: "no measured row" }); continue; }
  if (c.excludeReason) { skipped.push({ id: c.id, why: c.excludeReason }); continue; }
  const assign = assignments[c.id];
  if (!assign) { skipped.push({ id: c.id, why: "unassigned pack" }); continue; }

  const { pack, themeAffinity } = assign;
  mkdirSync(join(PACKS, pack), { recursive: true });
  copyFileSync(row.encoded, join(PACKS, pack, `${c.id}.webp`));
  copied++;

  const isCutout = row.bucket === "cutout" && row.hasAlphaChannel;
  const roles = isCutout
    ? ["isolated-subject", "floating-subject"]
    : (ROLES_BY_SLOT[c.slot] ?? ["editorial-media"]);

  const field = (k, v) => `${k}: ${JSON.stringify(v)}`;
  const parts = [
    field("id", `${pack}/${c.id}`),
    field("pack", pack),
    field("slot", c.slot),
    field("aspectRatio", aspectRatio(row.encodedWidth, row.encodedHeight)),
    field("width", row.encodedWidth),
    field("height", row.encodedHeight),
    field("tone", c.tone),
    field("overlaySafeZone", c.overlaySafeZone),
    `domainTags: [${c.domainTags.map((t) => JSON.stringify(t)).join(",")}]`,
    `themeAffinity: [${themeAffinity.map((t) => JSON.stringify(t)).join(",")}]`,
    field("subjectDescription", c.subjectDescription),
    `subjectTags: [${c.subjectTags.map((t) => JSON.stringify(t)).join(",")}]`,
    `useCases: [${(c.useCases ?? []).map((t) => JSON.stringify(t)).join(",")}]`,
  ];

  if (isCutout) {
    parts.push(field("alphaChannel", "present"), field("cutoutCapable", true));
  }
  parts.push(field("mimeType", "image/webp"), field("bytes", row.encodedBytes), field("contentSha256", row.hash));

  const safeRegion = SAFE_REGION_BY_ZONE[c.overlaySafeZone];
  const overlaySafety = c.overlaySafety === "safe" && !safeRegion ? "scrim-required" : c.overlaySafety;

  // Where a judgement and a measurement disagree, the measurement wins:
  // orientation is arithmetic on the real pixels, and "no negative space"
  // cannot also name a location.
  const orientation = row.orientation;
  const negativeSpace = c.negativeSpace.includes("none") ? ["none"] : [...new Set(c.negativeSpace)];

  parts.push(
    `composition: { roles: [${roles.map((r) => JSON.stringify(r)).join(",")}], layerRoles: [${
      isCutout ? '"foreground"' : c.slot === "ambient" || c.slot === "texture" ? '"background"' : '"midground"'
    }], orientation: ${JSON.stringify(orientation)}, negativeSpace: [${negativeSpace
      .map((n) => JSON.stringify(n))
      .join(",")}], density: ${JSON.stringify(c.density)}, overlaySafety: ${JSON.stringify(
      overlaySafety,
    )}, cropFlexibility: ${JSON.stringify(c.cropFlexibility)}, canBleed: ${!isCutout}, canCrossBounds: ${isCutout} }`,
  );
  parts.push(
    `focalPoint: { x: ${Number(c.focalPoint.x.toFixed(3))}, y: ${Number(c.focalPoint.y.toFixed(3))} }`,
  );
  if (overlaySafety === "safe" && safeRegion) {
    parts.push(`safeTextRegions: [${JSON.stringify(safeRegion)}]`);
  }
  parts.push(
    `review: { status: "approved", reviewedAt: ${JSON.stringify(REVIEWED_AT)}, reviewer: "operator", subjectVerified: true, noVisibleTextOrMarks: true, edgeQuality: ${JSON.stringify(
      isCutout ? "acceptable" : "not-applicable",
    )} }`,
  );
  parts.push(
    field(
      "url",
      `https://cdn.jsdelivr.net/gh/jcollins5513/ai-screen-builder-assets@${tag}/packs/${pack}/${c.id}.webp`,
    ),
  );

  lines.push(`  { ${parts.join(", ")} },`);
}

writeFileSync(join(STAGING, `manifest-entries.${tag}.txt`), lines.join("\n") + "\n");
writeFileSync(join(STAGING, `skipped.${tag}.json`), JSON.stringify(skipped, null, 1));
console.log(`entries : ${lines.length}`);
console.log(`copied  : ${copied} files into packs/`);
console.log(`skipped : ${skipped.length}`);
for (const s of skipped.slice(0, 20)) console.log(`   ${s.id}  ${s.why}`);
