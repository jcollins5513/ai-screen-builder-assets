// Tighten domain tags the caption pass reached for.
//
// The owned gate matches a prompt against these tags as a bag of words, so a tag
// that is merely ASSOCIATED with a subject — rather than describing what the
// subject IS — sends the wrong photo. The 2026-08-18 live defect was exactly
// this: a landscaping site shipped a car cutout in its hero.
//
// Each family below says what a tag CLAIMS, and what has to be visible in the
// frame for the claim to hold. A tag is dropped when the subject contradicts it
// or offers no support at all.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "C:/Users/justi/ai-screen-builder-assets/staging/flowgen-complete-2026-09-20/captions-all.json";
const captions = JSON.parse(readFileSync(FILE, "utf8"));

const FAMILIES = [
  {
    name: "outdoor planting",
    // "we design outdoor planted space"
    claim: /^(landscaping|gardening|horticulture|home-garden)$/,
    requires: /^(garden|desert-garden|greenhouse|agave|cactus|succulent|shrub|hedge|lawn|turf|flower-bed|raised-bed|planting|paving|stone-path|gravel-path|pergola|meadow|wildflower|nursery)$/,
    contradicts: /^(plaster-wall|polished-floor|marble-floor|concrete-floor|wood-floor|tile-floor|ceiling|skylight|beam-ceiling|timber-beam|indoor|interior|lobby|hallway|walkway|atrium|sofa|armchair|staircase|tractor|combine-harvester|truck|car|sedan|suv)$/,
  },
  {
    name: "commerce",
    // "there is something here to sell"
    claim: /^(retail|e-commerce|ecommerce|marketplace|home-goods|homeware|luxury-goods|luxury-retail|shop|store|product)$/,
    requires: /^(product|packaging|box|cardboard-box|shelf|shelving|rack|display|storefront|shopfront|counter|checkout|price-tag|basket|cart|mannequin|garment|clothing|apparel|shoes|sneakers|handbag|jewellery|jewelry|watch|furniture|sofa|armchair|lounge-chair|chair|table|lamp|vase|ceramic|textile|knitwear|fabric|cosmetics|bottle|jar|tin|headphones|device|tool|terminal|card-reader|tire|tyre)$/,
    contradicts: /^(beach|ocean|sea|coastline|greenhouse|meadow|forest|mountain|mountains|valley|cat|dog|bird|wildlife|horse|marble|stone-slab|plaster-wall|gradient|bokeh|blur|sky|cloud|clouds|water|sand|waterfall|cliff)$/,
  },
  {
    name: "food service",
    // "food is prepared or served here"
    claim: /^(restaurant|dining|cafe|culinary|bakery|catering|food|food-and-drink|food-and-beverage)$/,
    requires: /^(dining-table|restaurant-table|dining-room|table-setting|place-setting|plate|plates|bowl|cutlery|glassware|wine-glass|wineglass|coffee-cup|coffee-mug|espresso|cocktail|tumbler-glass|bar|bar-counter|counter|kitchen|chef|food|dish|bread|pastry|produce|cafe-chair|banquette|menu|coffee-beans|carafe)$/,
    contradicts: /^(marble|slate|stone-slab|texture|surface|wood-panel|wall|plaster-wall|gradient|bokeh|blur)$/,
  },
];

let stripped = 0;
const changes = [];

for (const c of captions) {
  if (c.excludeReason) continue;
  const subject = c.subjectTags ?? [];

  for (const family of FAMILIES) {
    const claimed = c.domainTags.filter((t) => family.claim.test(t));
    if (!claimed.length) continue;

    const supported = subject.some((t) => family.requires.test(t));
    const contradicted = subject.some((t) => family.contradicts.test(t));
    if (supported && !contradicted) continue;

    c.domainTags = c.domainTags.filter((t) => !family.claim.test(t));
    stripped += claimed.length;
    changes.push({
      id: c.id,
      family: family.name,
      removed: claimed,
      why: contradicted ? "subject contradicts the claim" : "no supporting evidence in the frame",
      subject: c.subjectDescription.slice(0, 72),
    });
  }

  // Never strip an entry down to nothing; the audit requires at least one tag.
  if (!c.domainTags.length) c.domainTags = ["editorial"];
}

writeFileSync(FILE, JSON.stringify(captions, null, 1));
console.log(`stripped ${stripped} over-reaching tags across ${changes.length} entries`);
const byFamily = new Map();
for (const ch of changes) byFamily.set(ch.family, (byFamily.get(ch.family) ?? 0) + 1);
for (const [f, n] of byFamily) console.log(`  ${String(n).padStart(3)}  ${f}`);
console.log("\nsamples:");
for (const ch of changes.slice(0, 10)) console.log(`  -${ch.removed.join(",")}  (${ch.why})  ${ch.subject}`);
