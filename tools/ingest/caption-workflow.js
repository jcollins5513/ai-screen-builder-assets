export const meta = {
  name: 'caption-pack-images',
  description: 'Caption owned image-pack candidates from pixels for the FlowGen catalog',
  phases: [{ title: 'Caption', detail: 'vision pass over thumbnails, 8 per agent' }],
}

const CAPTION_SCHEMA = {
  type: 'object',
  properties: {
    captions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'the exact id given for this image' },
          excludeReason: {
            type: 'string',
            description: 'Non-empty ONLY if this image must not ship: a real brand name/logo/badge, a watermark, readable text, recognisable trade dress, a real identifiable person, or anything distorted/garbled enough to look broken. Empty string otherwise.',
          },
          subjectDescription: {
            type: 'string',
            description: 'One plain literal sentence, max 140 chars, naming what is ACTUALLY visible. No marketing adjectives, no invented brand, no guessing from the folder name.',
          },
          subjectTags: {
            type: 'array',
            items: { type: 'string' },
            description: '4-8 lowercase-slug literal nouns/attributes visible in the frame (e.g. "concrete", "fog", "kayak"). Hyphenate multi-word.',
          },
          domainTags: {
            type: 'array',
            items: { type: 'string' },
            description: '2-6 lowercase-slug END-USER industries a page using this image would belong to (e.g. "travel", "healthcare", "real-estate"). Judge from what is depicted, not from style.',
          },
          slot: { type: 'string', enum: ['hero', 'split', 'framed', 'card', 'ambient', 'avatar', 'texture'] },
          tone: { type: 'string', enum: ['dark', 'light'] },
          overlaySafeZone: { type: 'string', enum: ['left-third', 'right-third', 'bottom-left', 'anywhere', 'none'] },
          orientation: { type: 'string', enum: ['landscape', 'portrait', 'square'] },
          negativeSpace: {
            type: 'array',
            items: { type: 'string', enum: ['left', 'right', 'top', 'bottom', 'center', 'distributed', 'none'] },
          },
          density: { type: 'string', enum: ['sparse', 'balanced', 'dense'] },
          overlaySafety: { type: 'string', enum: ['safe', 'scrim-required', 'unsafe'] },
          cropFlexibility: { type: 'string', enum: ['low', 'medium', 'high'] },
          isolatedSubject: { type: 'boolean', description: 'true only if the subject sits on a plain/transparent ground with no environment' },
          focalPoint: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            required: ['x', 'y'],
          },
          useCases: { type: 'array', items: { type: 'string' }, description: '1-3 short phrases for how a page would use it' },
        },
        required: ['id', 'excludeReason', 'subjectDescription', 'subjectTags', 'domainTags', 'slot', 'tone', 'overlaySafeZone', 'orientation', 'negativeSpace', 'density', 'overlaySafety', 'cropFlexibility', 'isolatedSubject', 'focalPoint', 'useCases'],
      },
    },
  },
  required: ['captions'],
}

const BRIEF = `You are cataloguing owned image assets for FlowGen, a general-purpose AI screen generator. These captions become the retrieval index: a caption that does not match the pixels sends the wrong photo to a customer's page.

THE ONE RULE THAT MATTERS: **describe only what you can see.** A previous pass on this catalog derived captions from generation-prompt metadata and misattributed 15 of 18 subjects — a "luxury coupe" turned out to be a backpack. That tag had to be deleted and republished. The folder name and the id are NOT evidence. Open each image and look at it.

Work efficiently: read each image file exactly ONCE with the Read tool, write its entry, move to the next. Do not re-open images you have already described.

For every image you are given:
1. Read the image file with the Read tool. Actually look at it.
2. Write subjectDescription as a literal sentence: the objects, setting, light and colour you can see. "Modern concrete house with floor-to-ceiling glass in dense fog" — not "stunning architectural masterpiece".
3. subjectTags: literal visible nouns, lowercase slugs. These are matched word-by-word against user prompts, so put in what someone would actually type.
4. domainTags: which end-user INDUSTRIES this image legitimately serves. Be generous but honest — a mountain lake serves travel, tourism, wellness, outdoor. A stethoscope serves healthcare only. Do NOT tag by visual style.
5. EXCLUSION — set excludeReason and stop if you see: any real brand name, logo, badge or wordmark (car badges, card networks, sportswear marks, the FlowGen logo itself); a watermark; any readable text that would ship into a customer page; recognisable trade dress; a real identifiable public figure; or anatomy/objects mangled badly enough to read as broken AI output. Be strict: 11 files were pulled from the last batch for exactly this, and the pilot for this batch rejected 4 of 20.
6. overlaySafeZone / negativeSpace: where could a headline sit without fighting the picture? Judge the actual empty area.
7. overlaySafety: "safe" = white text reads anywhere over it; "scrim-required" = needs a dark wash first; "unsafe" = too busy or too light for text.
8. slot: hero = wide, headline over it. split = portrait beside copy. framed = a contained 4:3 picture. card = small tile. ambient/texture = background with no real subject. avatar = a face at 1:1.
9. focalPoint: normalized 0..1 coordinates of the true visual subject.

Return one entry per image, ids exactly as given.`

// args: { dir, images: ["<id> <w>x<h> <tone>[ alpha]", ...] } — the thumbnails all
// live in one directory named by id, so the paths are rebuilt here rather than
// shipped through the tool call.
const { dir, images } = args
const parsed = images.map((line) => {
  const [id, size, tone, alpha] = line.split(' ')
  const [w, h] = size.split('x')
  return { id, w: Number(w), h: Number(h), tone, alpha: alpha === 'alpha', thumb: `${dir}/${id}.webp` }
})

const BATCH = 8
const batches = []
for (let i = 0; i < parsed.length; i += BATCH) batches.push(parsed.slice(i, i + BATCH))
log(`${parsed.length} images in ${batches.length} batches of ${BATCH}`)

const results = await parallel(
  batches.map((batch, n) => () =>
    agent(
      `${BRIEF}\n\nImages in this batch (${batch.length}):\n\n${batch
        .map((b) => `id: ${b.id}\n  file: ${b.thumb}\n  measured: ${b.w}x${b.h}, aspect ${(b.w / b.h).toFixed(3)}, mean-luminance tone "${b.tone}"${b.alpha ? ', HAS TRANSPARENCY (background already removed)' : ''}`)
        .join('\n\n')}`,
      { label: `caption:${n + 1}/${batches.length}`, phase: 'Caption', schema: CAPTION_SCHEMA, model: 'opus' },
    ),
  ),
)

const captions = results.filter(Boolean).flatMap((r) => r.captions ?? [])
const missing = parsed.map((a) => a.id).filter((id) => !captions.some((c) => c.id === id))
if (missing.length) log(`MISSING ${missing.length} ids: ${missing.slice(0, 20).join(', ')}`)
return {
  requested: parsed.length,
  returned: captions.length,
  excluded: captions.filter((c) => c.excludeReason).length,
  missing,
  captions,
}
