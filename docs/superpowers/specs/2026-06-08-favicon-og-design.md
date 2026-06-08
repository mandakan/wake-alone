# Favicon + OG image — design

## Goal

Give WAKE ALONE a proper favicon and a social/link-preview (Open Graph) image,
on-brand with the amber-phosphor CRT terminal aesthetic, without breaking the
single-standalone-file ethos of `dist/index.html`.

## Constraints (from the repo)

- The site ships as one inlined `dist/index.html`, served via Cloudflare Workers
  at `wake.urdr.dev` (staging: `wake-staging.urdr.dev`).
- `dist/` is gitignored and rebuilt by `npm run build` (which CI runs). So any
  static asset that must reach `dist/` has to live in source and be copied by the build.
- A favicon CAN be an inline `data:image/svg+xml` URI (keeps `file://` opening working).
- An OG image CANNOT be inline: crawlers (iMessage, Slack, Discord, Facebook, X)
  require a real fetchable PNG/JPG at an absolute URL and reject SVG / data-URIs.
- Brand tokens are fixed: phosphor `#ffb000`, void `#070806`, VT323 + IBM Plex Mono,
  sharp 0-radius shapes, scanlines + vignette.

## Motif (decided)

**Blinking cursor block** — an amber terminal caret on black. Reads as
"salvage log / dead terminal", on-brand with the engine voice, legible at 16px,
not literal-horror. Unifies favicon and OG card.

## Approach (decided: A)

Author the OG card as HTML, rasterize **once** with Playwright, **commit** the PNG;
`build.mjs` copies committed assets into `dist/`. Deterministic deploys, no Playwright
in CI. A committed render script regenerates the PNGs on demand when the design changes.

## File layout

```
assets/
  icon.svg              cursor-block favicon (also inlined as a data-URI in <head>)
  apple-touch-icon.png  180x180, iOS home-screen icon
  og.png                1200x630 social card
  og-card.html          HTML source the og.png is rendered from (committed, not shipped)
tools/
  render-og.mjs         Playwright: og-card.html -> assets/og.png + assets/apple-touch-icon.png
```

## The assets

### Favicon (`assets/icon.svg`)
Sharp-cornered SVG (0-radius). Background `#070806`. Amber `#ffb000` filled block as a
terminal caret, with a thin amber prompt baseline so it reads as "terminal", not just an
orange square, at 16px. Inlined into the template `<head>` as a `data:image/svg+xml` URI
so the single-file `index.html` still shows it from `file://`. Same artwork renders the
180x180 `apple-touch-icon.png`.

### OG card (`assets/og.png`, 1200x630)
The live CRT look (not a flat mock): radial void background, scanline overlay, vignette.
Layout: cursor-block glyph + **WAKE ALONE** wordmark in VT323 with the amber phosphor
bloom; tagline *"an anthology of small dark rooms in deep space"* in IBM Plex Mono
dim-amber beneath; a faint HUD line. Amber-on-black throughout.

## `engine/template.html` `<head>` additions

- `<link rel="icon" href="data:image/svg+xml,...">` (inline cursor-block SVG)
- `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`
- `<meta name="theme-color" content="#070806">`
- `<meta name="description" content="...">`
- Open Graph: `og:title`, `og:description`, `og:type=website`, `og:url`, `og:image`,
  `og:image:width=1200`, `og:image:height=630`
- Twitter: `twitter:card=summary_large_image`, `twitter:image`
- `og:image` / `og:url` use the absolute prod URL `https://wake.urdr.dev/...`
  (staging reuses prod's identical image — acceptable).

## `tools/build.mjs` change

After writing `dist/index.html`, copy `assets/{icon.svg,apple-touch-icon.png,og.png}`
into `dist/`. Log what was copied.

## Verification

- `npm run build` produces `dist/index.html` plus the copied assets; no validator regressions.
- Open `dist/index.html` from `file://`: favicon (cursor block) shows in the tab.
- The rendered `og.png` matches the live CRT look at 1200x630.
- Meta tags present and well-formed; OG points at an absolute prod URL.

## Out of scope

- Per-episode OG images. One anthology-level card only.
- Animated favicon. The caret is static (no real blink in an icon).
- A favicon.ico fallback for legacy IE — modern SVG + apple-touch PNG is enough.
