// Route captioned images to packs.
//
// TWO KINDS OF EVIDENCE, kept apart on purpose:
//
//   What is IN the picture  -> pixels only. The folder name is not evidence of
//     subject; deriving subjects from metadata is what misattributed 15 of 18
//     cutouts and forced the v4 tag to be deleted. Captions stay pixel-derived.
//
//   Where it BELONGS        -> the operator's own folders. They sorted this drop
//     by hand into Indoor / Outside / Animals / Underwater / Abstract / Cut-outs
//     / Transportation, and that is a statement of intent, not a guess. Measured
//     against subject-only routing it agreed 86-100% everywhere it was explicit,
//     and where it differed it was right: 31 images filed under Abstract had
//     been re-judged into subject packs, and 9 under Transportation had drifted
//     to terrain/solstice.
//
// So a folder that expresses a category is authoritative. Only the grab-bags —
// the loose root files and "Approved Flow Images" — fall through to subject
// rules, and only then to a domain-tag score.
//
// Three packs are new; the catalog had no home for this material:
//   terrain  - landscape, nature, wildlife, water
//   hearth   - interiors, rooms, surfaces, furnishings
//
// A third, `foundry` (industry/logistics), was built and then DROPPED: it drew
// only 12 images, all of them heroes, and the catalog requires >=2 heroes AND
// >=2 ambients per domain pack so the per-app chrome lock can vary. Container
// ships and cranes are subjects, not backgrounds, and relabelling them as
// ambient to satisfy the rule would be a lie about what they are. Logistics
// stays an honest coverage gap until there is enough material for a real pack.
import { readFileSync, writeFileSync } from "node:fs";

import { IMAGE_PACK_MANIFEST } from "./src/lib/image-packs/manifest";

type Caption = {
  id: string;
  excludeReason: string;
  domainTags: string[];
  subjectTags: string[];
  subjectDescription: string;
  slot: string;
  tone: "dark" | "light";
};

const [, , captionsPath, encodedPath, outPath] = process.argv;
const captions: Caption[] = JSON.parse(readFileSync(captionsPath, "utf8"));
const encoded = JSON.parse(readFileSync(encodedPath, "utf8"));
const rowById = new Map<string, { folder: string; bucket: string; hasAlphaChannel?: boolean }>(
  encoded.map((r: { shortId: string; folder: string; bucket: string; hasAlphaChannel?: boolean }) => [r.shortId, r]),
);

const NEW_PACKS: Record<string, { domainTags: string[]; themeAffinity: string[] }> = {
  terrain: {
    domainTags: [
      "nature", "landscape", "outdoor", "environment", "conservation", "wildlife",
      "hiking", "adventure", "national-park", "sustainability", "ecology", "expedition",
    ],
    themeAffinity: ["editorial", "clarity", "soft"],
  },
  hearth: {
    domainTags: [
      "interior-design", "furniture", "home-decor", "homeware", "renovation",
      "home-services", "staging", "joinery", "lighting-design",
    ],
    themeAffinity: ["soft", "clarity", "editorial"],
  },
};

const has = (tags: string[], words: RegExp) => tags.some((t) => words.test(t));

const NATURE = /^(mountain|mountains|peak|ridge|ridgeline|valley|canyon|glacier|forest|pine-trees|conifers|woodland|jungle|desert|dune|ocean|sea|coastline|coast|shoreline|beach|cove|lagoon|reef|coral|river|waterfall|lake|stream|waves|underwater|seabed|wildlife|bird|eagle|deer|bear|whale|dolphin|octopus|manta-ray|fox|wolf|meadow|prairie|tundra|iceberg|volcano|cliff|cliffs|moss|fern|wetland|marsh|aurora|milky-way)$/;
const INTERIOR = /^(living-room|bedroom|kitchen|bathroom|dining-room|lobby|hallway|staircase|sofa|armchair|couch|bed|nightstand|bookshelf|shelf|desk|dining-table|coffee-table|rug|carpet|curtain|sheer-curtain|plaster-wall|polished-floor|concrete-floor|wood-floor|tile-floor|pendant-lamp|floor-lamp|vase|ceramic|cushion|upholstery|wardrobe|cabinetry|countertop|backsplash|fireplace|home-office|reception-desk)$/;
const EXTERIOR = /^(house|modern-house|concrete-house|glass-house|building|villa|cabin|facade|glass-facade|skyscraper|skyline|city-skyline|roofline|flat-roof|cantilever|courtyard|terrace|balcony|driveway|exterior|apartment-block|tower|bridge|pavilion)$/;
const INDUSTRY = /^(container-ship|cargo-ship|container|shipping-container|gantry-crane|crane|port|harbor|harbour|dock|quay|warehouse|factory|foundry|refinery|pipeline|truck|lorry|semi-truck|freight|train|freight-train|railway|locomotive|forklift|pallet|machinery|assembly-line|robot-arm|conveyor|data-center|server-rack|solar-panel|wind-turbine|power-line|substation|excavator|scaffolding)$/;
const VEHICLE = /^(car|sedan|coupe|suv|sports-car|hatchback|motorcycle|scooter|van|pickup|convertible|wheels|alloy-wheels|headlight|taillight|bicycle|bike|e-bike|yacht|motor-yacht|sailboat|boat|aeroplane|airplane|aircraft)$/;

/** Folders that state a category. The value decides, or narrows the choice. */
const FOLDER_RULES: Record<string, (c: Caption) => string> = {
  "Abstract": () => "theme-ambient",
  "Environment/Indoor Environments": () => "hearth",
  "Environment/Animals in Environment": () => "terrain",
  "Environment/Underwater Environment": () => "terrain",
  // Outdoors splits meaningfully: a house in a forest still serves real-estate.
  "Environment/Outside Environment": (c) => (has(c.subjectTags, EXTERIOR) ? "alpine-modern" : "terrain"),
  // Transport splits between consumer vehicles and freight/industry.
  "Transportation": () => "meridian",
};

/** Fallback for the grab-bags, by subject evidence. */
function routeBySubject(c: Caption): string | null {
  const s = c.subjectTags;
  if (has(s, VEHICLE)) return "meridian";
  if (has(s, INTERIOR)) return "hearth";
  if (has(s, NATURE) && !has(s, EXTERIOR)) return "terrain";
  if (has(s, EXTERIOR)) return "alpine-modern";
  if (has(s, NATURE)) return "terrain";
  return null;
}

const packs = new Map<string, { tags: Set<string>; themes: string[]; styleOnly?: boolean }>();
for (const e of IMAGE_PACK_MANIFEST) {
  if (!packs.has(e.pack)) packs.set(e.pack, { tags: new Set(), themes: [], styleOnly: e.styleOnly });
  const p = packs.get(e.pack)!;
  e.domainTags.forEach((t) => p.tags.add(t.toLowerCase()));
  for (const t of e.themeAffinity) if (!p.themes.includes(t)) p.themes.push(t);
}
for (const [name, def] of Object.entries(NEW_PACKS)) {
  packs.set(name, { tags: new Set(def.domainTags), themes: def.themeAffinity });
}

const stems = (tag: string) => tag.split("-").map((w) => w.replace(/(ies|es|s)$/, "")).filter((w) => w.length > 2);
function score(domainTags: string[], packTags: Set<string>): number {
  const packStems = new Set([...packTags].flatMap(stems));
  let hits = 0;
  for (const tag of domainTags) {
    const t = tag.toLowerCase();
    if (packTags.has(t)) hits += 2;
    else if (stems(t).some((x) => packStems.has(x))) hits += 1;
  }
  return hits;
}

const assignments: Record<string, { pack: string; themeAffinity: string[]; via: string }> = {};
const unassigned: Caption[] = [];

for (const c of captions) {
  if (c.excludeReason) continue;
  const row = rowById.get(c.id);
  if (!row) continue;

  let pack: string | null = null;
  let via = "";

  if (row.bucket === "cutout" && row.hasAlphaChannel) {
    pack = "cutouts";
    via = "alpha";
  } else if (FOLDER_RULES[row.folder]) {
    pack = FOLDER_RULES[row.folder](c);
    via = "operator folder";
  } else {
    pack = routeBySubject(c);
    via = "subject";
    if (!pack) {
      via = "domain-score";
      let best: { pack: string; score: number } | null = null;
      for (const [name, p] of packs) {
        if (p.styleOnly || name === "cutouts") continue;
        const s = score(c.domainTags, p.tags);
        if (s > (best?.score ?? 0)) best = { pack: name, score: s };
      }
      if (best && best.score >= 2) pack = best.pack;
    }
  }

  if (!pack) {
    unassigned.push(c);
    continue;
  }
  assignments[c.id] = { pack, themeAffinity: packs.get(pack)!.themes, via };
}

const perPack = new Map<string, number>();
for (const a of Object.values(assignments)) perPack.set(a.pack, (perPack.get(a.pack) ?? 0) + 1);
const existing = new Map<string, number>();
for (const e of IMAGE_PACK_MANIFEST) existing.set(e.pack, (existing.get(e.pack) ?? 0) + 1);

console.log(`assigned   : ${Object.keys(assignments).length}`);
console.log(`unassigned : ${unassigned.length}`);
console.log("");
console.log("pack                 now    +new   =total");
for (const [p, n] of [...perPack].sort((a, b) => b[1] - a[1])) {
  const before = existing.get(p) ?? 0;
  console.log(
    `  ${p.padEnd(18)} ${String(before).padStart(4)}  ${String(n).padStart(5)}  ${String(before + n).padStart(6)}${existing.has(p) ? "" : "  (NEW)"}`,
  );
}
const routes = new Map<string, number>();
for (const a of Object.values(assignments)) routes.set(a.via, (routes.get(a.via) ?? 0) + 1);
console.log(`\nrouted by: ${[...routes].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);

if (unassigned.length) {
  console.log("\nunassigned:");
  for (const c of unassigned.slice(0, 10)) console.log(`  ${c.id}  ${c.domainTags.join(",")} :: ${c.subjectDescription.slice(0, 70)}`);
}

writeFileSync(outPath, JSON.stringify(assignments, null, 1));
writeFileSync(outPath.replace(/\.json$/, ".new-packs.json"), JSON.stringify(NEW_PACKS, null, 1));
console.log(`\nwrote ${outPath}`);
