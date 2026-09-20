// Render a verification sheet: every thumbnail beside the caption written for it,
// so the captions can be checked against the pixels rather than trusted.
//
//   node caption-sheet.mjs <captions.json> <out.png> [title]
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(
  "C:/Users/justi/ai-screen-builder/.claude/worktrees/reverent-hofstadter-46a7eb/package.json",
);
const puppeteer = require("puppeteer");

const [, , captionsPath, outPath, title = "Caption verification"] = process.argv;
const captions = JSON.parse(readFileSync(captionsPath, "utf8"));
const encoded = JSON.parse(
  readFileSync("C:/Users/justi/ai-screen-builder-assets/staging/flowgen-complete-2026-09-20/encoded.json", "utf8"),
);
const byId = new Map(encoded.map((r) => [r.shortId, r]));

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fileUrl = (p) => `file:///${p.split("\\").join("/")}`;

const cards = captions
  .map((c) => {
    const row = byId.get(c.id);
    const excluded = Boolean(c.excludeReason);
    return `
<div class="card ${excluded ? "excluded" : ""}">
  <div class="shot"><img src="${fileUrl(row?.thumb ?? "")}"></div>
  <div class="meta">
    ${excluded ? `<div class="flag">EXCLUDED — ${esc(c.excludeReason)}</div>` : ""}
    <div class="desc">${esc(c.subjectDescription)}</div>
    <div class="row"><b>subject</b> ${esc((c.subjectTags ?? []).join(" · "))}</div>
    <div class="row"><b>domains</b> <span class="dom">${esc((c.domainTags ?? []).join(" · "))}</span></div>
    <div class="row"><b>slot</b> ${esc(c.slot)} &nbsp; <b>tone</b> ${esc(c.tone)} &nbsp; <b>overlay</b> ${esc(c.overlaySafeZone)} / ${esc(c.overlaySafety)}</div>
    <div class="row src">${esc(row?.folder ?? "")} · ${esc(c.id)}</div>
  </div>
</div>`;
  })
  .join("");

const html = `<html><head><meta charset="utf-8"><style>
  body { margin:0; background:#14110f; font-family: ui-sans-serif, system-ui, sans-serif; color:#f4efe9; }
  h1 { font-size:20px; margin:20px 24px 4px; }
  p.sub { margin:0 24px 18px; color:#9a9088; font-size:13px; }
  .grid { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:14px; padding:0 24px 28px; }
  .card { display:grid; grid-template-columns: 300px minmax(0,1fr); gap:14px; background:#1f1a17; border:1px solid #332c27; border-radius:10px; overflow:hidden; }
  .card.excluded { border-color:#a8452f; background:#241612; }
  .shot { background:#0d0b0a; display:flex; align-items:center; justify-content:center; }
  .shot img { width:100%; height:190px; object-fit:cover; display:block; }
  .meta { padding:12px 14px 12px 0; font-size:12.5px; line-height:1.5; min-width:0; }
  .desc { font-size:14px; margin-bottom:8px; color:#fff; }
  .row { color:#b5aaa1; margin-top:3px; word-break:break-word; }
  .row b { color:#7e7268; font-weight:600; text-transform:uppercase; font-size:10.5px; letter-spacing:.06em; margin-right:5px; }
  .dom { color:#e0b877; }
  .src { color:#6a6058; font-size:11px; margin-top:7px; }
  .flag { color:#ff9c80; font-weight:600; margin-bottom:6px; font-size:12px; }
</style></head><body>
<h1>${esc(title)}</h1>
<p class="sub">${captions.length} images · captions written from the pixels · check each sentence against the picture beside it</p>
<div class="grid">${cards}</div>
</body></html>`;

const htmlPath = outPath.replace(/\.png$/, ".html");
writeFileSync(htmlPath, html);

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1560, height: 1200 });
await page.goto(fileUrl(htmlPath), { waitUntil: "networkidle0" });
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(`wrote ${outPath}`);
