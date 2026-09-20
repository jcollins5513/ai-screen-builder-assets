# Ingesting a drop of owned images

How the 2026-09-20 `Flow-GenComplete` drop became assets tag `v6` — 581 new
images across 20 packs — and how to repeat it for the next one.

## The short version

Hand over the whole folder every time, old images and new together. Nothing
needs tracking on your side: every published image's SHA-256 is already in the
manifest, so anything already shipped is skipped. The 2026-09-20 drop had 754
files, 2 of which were already published and 1 an internal duplicate; all three
were dropped without being looked at twice.

Adding is always safe. Published jsDelivr tags are immutable, so a new batch
becomes a NEW tag (`v7`, `v8`, …) and never rewrites an old one. Existing
entries cannot move or break.

## Two kinds of evidence, kept apart

This is the rule the whole pipeline is built around, and it is not negotiable.

**What is IN a picture comes from the pixels.** Never from a filename, never
from a folder name, never from generation-prompt metadata. That shortcut
misattributed 15 of 18 subjects in an earlier pass — a "luxury coupe" was a
backpack — and tag `v4` had to be deleted and republished as `v5`.

**Where a picture BELONGS comes from your folders.** Sorting a drop by hand is
a statement of intent, not a guess about content, and it is good signal.
Measured on the 2026-09-20 drop against subject-only routing, the folder
taxonomy agreed 86–100% wherever it was explicit, and where the two differed the
folders were right: 31 images filed under `Abstract` had been re-judged into
subject packs, and 9 under `Transportation` had drifted into landscape packs.

## Folder names that route automatically

| Folder | Pack |
| --- | --- |
| `Abstract` | `theme-ambient` |
| `Animals — Domestic` | `companion` |
| `Animals — Wildlife` | `terrain` |
| `Environment — Landscapes` | `terrain` |
| `Environment — Architecture` | `alpine-modern` |
| `Environment/Indoor Environments` | `hearth` |
| `Environment/Underwater Environment` | `terrain` |
| `Cut-outs` | `cutouts` (confirmed by real alpha, not by the folder) |
| `Transportation — Air / Land / Sea` | `meridian` |

Anything in a folder not listed here falls back to subject rules, then to a
domain-tag score. Nothing is ever left unassigned — but a named folder gives a
sharper answer than inference, so loose files at the root cost the most. The
2026-09-20 drop had 125 of them.

A folder that describes QUALITY rather than SUBJECT ("Approved") gives no
routing signal at all: its 54 images scattered across six packs, because
"approved" says nothing about what is in the frame.

## The steps

1. **`extract-and-triage.mjs`** — unpacks the drop, hashes every file, drops
   anything already published or duplicated inside the drop, and records
   dimensions, format, real alpha and mean luminance.
2. **`encode.mjs`** — re-encodes to WebP inside the per-slot byte budgets the
   catalog enforces (`hero` 500 KB, `split` 400 KB, the rest 300 KB, cutouts
   1 MB). Encoding everything to ≤290 KB means one file satisfies every budget,
   so slot choice stays a judgement about composition rather than about size.
   The 2026-09-20 drop went from 1,133 MB to 72 MB with 694 of 715 files still
   at full quality.
3. **`caption-workflow.js`** — the one step that needs Claude. Vision agents
   read each thumbnail and write the subject description, subject tags, domain
   tags, slot, tone and composition, and reject anything carrying a real brand
   mark, currency, readable text, recognisable trade dress or malformed output.
   163 of 746 were rejected on 2026-09-20.
4. **`tighten-tags.mjs`** — strips domain tags that say what a subject is NEAR
   rather than what it IS. The gate matches tags as a bag of words, so
   "landscaping" on an indoor atrium, "restaurant" on a bare marble slab or
   "retail" on a beach sends the wrong photo. 100 tags across 79 entries were
   stripped on 2026-09-20, and four separate test suites had caught the damage
   before this step existed.
5. **`assign-packs.mts`** — routes by folder first, then subject, then score.
6. **`build-entries.mjs`** — copies files into `packs/<pack>/` and emits
   `ImagePackEntry` literals. Where a caption and a measurement disagree the
   measurement wins: orientation is arithmetic on real pixels, and a claim of
   "text reads over this" must name the region it is true of.
7. **`caption-sheet.mjs`** — renders every thumbnail beside its caption so the
   captions can be CHECKED rather than trusted. Look at this before publishing.
8. **`insert-entries.mjs`** — appends to `src/lib/image-packs/manifest.ts` in
   the app repo. Then `npm run audit:image-packs` and `npm run test:gen`.
9. Commit `packs/`, tag the new version, push, and only then merge the app-repo
   change — the URLs 404 until the tag exists.

`collect-brand.mjs` pulls FlowGen's own mascot and logo artwork out to a
separate folder. It must never reach a pack: an owned-image catalog containing
your branding would stamp it onto a customer's generated page. 110 of those
were found in the 2026-09-20 drop, most of them loose in the root rather than in
its logo folder.

`download-cutouts.mjs` and `encode-cutouts.mjs` handle images that still need
their background removed: upload, run Magnific's background remover (3 credits
each), download, and PROVE transparency by measuring the alpha channel rather
than assuming the tool worked.

## Things that will bite

- **Exact-byte dedup only.** Re-exporting the same photo at a different size or
  quality produces a different hash and will come through as new. Perceptual
  hashing is in `tools/lib/catalog-v2.mjs` but is not wired into this path.
- **A new pack needs ≥2 heroes and ≥2 ambients**, so the per-app chrome lock can
  vary. A `foundry` pack for logistics was built and dropped on 2026-09-20 for
  exactly this: 12 images, all heroes. Container ships are subjects, not
  backgrounds, and relabelling them to pass would be a lie about what they are.
  Logistics is still an uncovered domain.
- **Keep channel tags out of `cutouts`.** All 143 published v5 cutouts are
  tagged by what the object IS, never by where it might be sold. That is what
  stops a 215-entry grab-bag outscoring a specialist pack, because pack score
  counts distinct pack-level tags.
