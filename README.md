# ai-screen-builder-assets

Owned, AI-generated image asset packs for [AI Screen Builder] generations —
art-directed sets covering end-user domains equally (SaaS, e-commerce, food,
fashion, fintech, travel, wellness, automotive, architecture, portraits, and
per-theme ambient backgrounds). See `LICENSE.md` for provenance.

## Layout

```
packs/<pack-id>/<slot>-<nn>.<ext>
```

Slots: `hero` (wide, headline-safe zone) · `split` (portrait) · `framed` (4:3)
· `card` · `ambient` / `texture` (no focal point) · `avatar` (1:1 portraits).

## Serving

Consumed via jsDelivr with **versioned tags** — the app's manifest
(`src/lib/image-packs/manifest.ts` in the main repo) pins URLs like:

```
https://cdn.jsdelivr.net/gh/jcollins5513/ai-screen-builder-assets@v1/packs/<pack>/<file>
```

Tags are immutable once published: add images → new tag (`v2`, …) → update the
manifest. Never rewrite a published tag (jsDelivr caches permanently).
