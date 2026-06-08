#!/usr/bin/env node
// render-og.mjs -- rasterize the committed asset sources into the PNGs that crawlers
// and iOS need (these cannot be SVG/data-URI). Run this whenever assets/og-card.html
// or assets/icon.svg changes; the produced PNGs are committed so deploys (and CI)
// never have to launch a browser.
//
//   node tools/render-og.mjs
//
//   assets/og-card.html  -> assets/og.png              (1200x630 social card)
//   assets/icon.svg      -> assets/apple-touch-icon.png (180x180 home-screen icon)
//
// Requires Playwright + a chromium build (not a runtime/CI dep -- only needed to
// regenerate the committed PNGs):  npx playwright install chromium

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "assets");

const browser = await chromium.launch();
try {
  // --- OG card: render the HTML at exactly 1200x630 (scale 1 -> 1200x630 pixels) ---
  {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(join(ASSETS, "og-card.html")).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300); // let the webfonts paint
    await page.screenshot({ path: join(ASSETS, "og.png") });
    await page.close();
    console.log("wrote assets/og.png (1200x630)");
  }

  // --- apple-touch icon: render the favicon SVG at 180x180 ---
  {
    const svg = readFileSync(join(ASSETS, "icon.svg"), "utf8");
    const page = await browser.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
    // Drop the SVG straight into a 180x180 page so it rasterizes crisply.
    await page.setContent(
      `<!DOCTYPE html><meta charset="utf-8"><style>html,body{margin:0;width:180px;height:180px}` +
      `svg{width:180px;height:180px;display:block}</style>${svg}`,
      { waitUntil: "load" }
    );
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(ASSETS, "apple-touch-icon.png") });
    await page.close();
    console.log("wrote assets/apple-touch-icon.png (180x180)");
  }
} finally {
  await browser.close();
}
