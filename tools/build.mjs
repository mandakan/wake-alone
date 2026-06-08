#!/usr/bin/env node
// build.mjs — validate every episode, then inline them into the engine to produce
// a single standalone dist/index.html (no server or fetch needed to play).

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { validateEpisode } from "./validate.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EP_DIR = join(ROOT, "episodes");
const C = { red:"\x1b[31m", yellow:"\x1b[33m", green:"\x1b[32m", dim:"\x1b[2m", reset:"\x1b[0m" };

const manifest = JSON.parse(readFileSync(join(EP_DIR, "manifest.json"), "utf8"));
const itemNames = JSON.parse(readFileSync(join(ROOT, "engine", "item-names.json"), "utf8"));

const episodes = [];
const usedItems = new Set();
let hadError = false;

for (const entry of manifest.episodes) {
  if (entry.locked) {
    episodes.push({ locked: true, title: entry.title || "LOCKED", byline: entry.byline || "" });
    continue;
  }
  const ep = JSON.parse(readFileSync(join(EP_DIR, entry.file), "utf8"));
  const r = validateEpisode(ep, ep.id);
  if (!r.ok) {
    hadError = true;
    console.log(`${C.red}FAIL${C.reset} ${ep.id}`);
    r.errors.forEach((m) => console.log(`  ${C.red}ERROR${C.reset} ${m}`));
  } else {
    console.log(`${C.green}ok${C.reset}   ${ep.id} ${C.dim}(${r.report.nodes} nodes, endings: ${r.report.endings.join("/")})${C.reset}`);
    r.report.items.forEach((i) => usedItems.add(i));
  }
  delete ep.spec;      // authoring metadata; never ship it in the runtime bundle
  delete ep.character; // protagonist profile -- informs generation, surfaces only indirectly
  episodes.push(ep);
}

if (hadError) {
  console.log(`\n${C.red}build aborted: fix validation errors first${C.reset}\n`);
  process.exit(1);
}

// warn about inventory items with no display label
for (const i of usedItems) {
  if (!itemNames[i]) console.log(`${C.yellow}warn${C.reset} item "${i}" has no label in engine/item-names.json (will show raw id)`);
}

const inject =
  `MANIFEST = ${JSON.stringify({ title: manifest.title, subtitle: manifest.subtitle })};\n` +
  `ITEM_NAMES = ${JSON.stringify(itemNames)};\n` +
  `EPISODES = ${JSON.stringify(episodes)};`;

const template = readFileSync(join(ROOT, "engine", "template.html"), "utf8");
if (!template.includes("/*__INJECT__*/")) { console.log(`${C.red}template is missing /*__INJECT__*/ marker${C.reset}`); process.exit(1); }
const html = template.replace("/*__INJECT__*/", inject);

mkdirSync(join(ROOT, "dist"), { recursive: true });
writeFileSync(join(ROOT, "dist", "index.html"), html);
console.log(`\n${C.green}built dist/index.html${C.reset} ${C.dim}(${(html.length/1024).toFixed(0)} kB, ${episodes.filter(e=>!e.locked).length} playable episode(s))${C.reset}`);

// Copy runtime assets the inlined HTML references by URL (favicon source, the iOS
// home-screen icon, and the Open Graph card). These cannot be inlined: og:image must
// be a real fetchable PNG. Regenerate the PNGs with `node tools/render-og.mjs`.
const ASSET_DIR = join(ROOT, "assets");
for (const name of ["icon.svg", "apple-touch-icon.png", "og.png"]) {
  const src = join(ASSET_DIR, name);
  if (!existsSync(src)) {
    console.log(`${C.red}ERROR${C.reset} missing asset ${C.dim}assets/${name}${C.reset} -- run ${C.dim}node tools/render-og.mjs${C.reset}`);
    process.exit(1);
  }
  copyFileSync(src, join(ROOT, "dist", name));
}
console.log(`${C.green}copied assets${C.reset} ${C.dim}-> dist/ (icon.svg, apple-touch-icon.png, og.png)${C.reset}\n`);
