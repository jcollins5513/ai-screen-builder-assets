// Download the 31 background-removed renders, verify each really carries an
// alpha channel, and stage them as cutout candidates.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(
  "C:/Users/justi/ai-screen-builder/.claude/worktrees/reverent-hofstadter-46a7eb/package.json",
);
const sharp = require("sharp");

const STAGING = "C:/Users/justi/ai-screen-builder-assets/staging/flowgen-complete-2026-09-20";
const OUT = join(STAGING, "bg-removed");
mkdirSync(OUT, { recursive: true });

const T = "token=exp=1790294400~hmac=";
const R = (id, hmac) => `https://pikaso.cdnpk.net/private/production/${id}/render.png?${T}${hmac}`;

// Result renders, in the same order as the not-ready source rows.
const RENDERS = [
  R("5502564972", "5bf19a2800728539e62975f5d5ab0947895d45d822d890e86a0cbf4099784d9a"),
  R("5502565242", "1d3c2e535e65bd68ce07f4a46cc132b789dd9362509306ade08ff4197a042660"),
  R("5502565544", "f2d3a0c8a765b70db8cbcaa0a9a9a7b86a184d65f3ff7bb4d7dffb31632a0398"),
  R("5502565891", "6e01b33919430a291535c54255826f27d1d25c1f66fb42eea7996cab34a9485e"),
  R("5502566185", "ce0f38fe5d6fcd0575de228fe8835396299f19c2453d3bb9b051c94ef4201dd8"),
  R("5502566491", "70844f776db25567b8ba14be7fadf0e756023d03893b0ff7fc2d8abe8453cd26"),
  R("5502566784", "47577987645e8e35dfbc4dbf2624596ccbc943517d6c4b3da8b9210481216eec"),
  R("5502567054", "3db1f818f13c4dcbb5fca33719db93eaccb0ae24a171124103b41d1fdfd67d46"),
  R("5502567501", "524d4b43d9fe6c2c09f770e141f5a9ccd3793733294123e9c8a5b3d5e415ff3a"),
  R("5502567768", "3cb915743d7e0f6f79968ba834696d5939e599325a3ffc33f93a3243c57c655c"),
  R("5502568063", "ce9586a32c453924bb1bc74f979e4f815c606a7d6dbb8fa6d60420f38f0129e9"),
  R("5502568360", "519a63a58aec3a208c401eea968c6e498b0e3968f26336a1be70708e872354c9"),
  R("5502568697", "a9925d30b31e00ab5ce610c78ac35915b30938b05385acad17d8ce7241817038"),
  R("5502569022", "00ff7b1840a4d0d70e4faf2b62963a975a297de7fd90b05757a8103d5d1abbf1"),
  R("5502569282", "0688fe830d40b784ecf2dee08e1027ae943879c171e40bd7a7d4c605afd3e488"),
  R("5502569555", "2357e0de027af25635eea068cb17ecafa26143adcd0a9cedd611ad5e815aaae9"),
  R("5502570363", "59a9526dd88b8aa474d82ebf4d4571f18e107298694d62d38215fc23ce0c5061"),
  R("5502570624", "3cc5fc418db414f934143f6a8c49f6ef0ee17243a39611a1bf977118605fbcbb"),
  R("5502570926", "0252b98d9c87ee665a0e7518e4c2ea747536f010d136b8775896a8d53a32e104"),
  R("5502571272", "3fb4978ebaf8de363efc06415ff9ad871624c516e3d448aa13899129a01c5667"),
  R("5502571579", "1ee590d988f2fbd401c27ef96398ce3fa94f8ffc8c54a8e1d7cbe64890ce92c9"),
  R("5502571922", "885654180adf336586c704de7b3475ba75fe4f5d76f400ccc7ee711343848ca3"),
  R("5502572218", "a1c649d7e655a62bbeba03c39102bc04debb027c0f760665420ea22e1bcbf69a"),
  R("5502572532", "7211b3244ff59f44689890cb706638a2e932d9afecf190e37923b42365cabc73"),
  R("5502572977", "914d89c28698b9fafed5433f5886629e5de169ad8a5cec1e46975e59e435e618"),
  R("5502573283", "1e092a673fbdb71514ce2210b68bb9fb1988bb6ec68e7f3e53db23060687de4e"),
  R("5502573543", "38ad84ec7719977fa8a06e189881e78fccc241c87e5bb2cad069d6b5f0a1d9df"),
  R("5502574048", "dde37aa5b92fca570ffa047827bf8eae62ba2bdace4dbdfd0a966e8b665eabf2"),
  R("5502574292", "9615ef9f47bebbfde638b42d4437e184ab5b252ca6d7b967fb781fa79e79c000"),
  R("5502574603", "02368e697494d48d8c413f53006a24d41f1d984980b43d554b90618932370eac"),
  R("5502574858", "690e5f61b6f3fa5a87a1770225052aa3367954845c74b83451bb3ef659cc3fbd"),
];

const rows = JSON.parse(readFileSync(`${STAGING}/triage.json`, "utf8")).filter((r) => r.bucket === "not-ready");
if (rows.length !== RENDERS.length) throw new Error(`${rows.length} rows vs ${RENDERS.length} renders`);

const out = [];
for (const [i, row] of rows.entries()) {
  const res = await fetch(RENDERS[i]);
  if (!res.ok) {
    console.error(`  FAIL ${row.base}: ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  // The whole point of the pass: prove transparency rather than assume it.
  const stats = await sharp(buf).ensureAlpha().extractChannel(3).stats();
  const transparent = meta.hasAlpha && stats.channels[0].min === 0;
  const file = join(OUT, `${row.hash.slice(0, 12)}.png`);
  writeFileSync(file, buf);
  out.push({
    sourceHash: row.hash,
    base: row.base,
    file,
    bytes: buf.length,
    width: meta.width,
    height: meta.height,
    hasAlpha: Boolean(meta.hasAlpha),
    transparent,
    alphaMin: stats.channels[0].min,
    resultSha256: createHash("sha256").update(buf).digest("hex"),
  });
  console.log(
    `  ${String(i + 1).padStart(2)}/31  ${transparent ? "alpha OK " : "NO ALPHA"}  ${meta.width}x${meta.height}  ${(buf.length / 1024).toFixed(0).padStart(4)} KB  ${row.base.slice(0, 44)}`,
  );
}

writeFileSync(`${STAGING}/bg-removed.json`, JSON.stringify(out, null, 1));
console.log(`\ndownloaded ${out.length}/31`);
console.log(`with real transparency: ${out.filter((o) => o.transparent).length}`);
