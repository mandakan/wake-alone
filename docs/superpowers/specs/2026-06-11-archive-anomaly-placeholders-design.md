# Archive anomaly placeholders -- design

## Summary

Add three permanent, non-numbered "archive anomaly" cards pinned to the end of
the salvage menu. They render as barely-readable corrupted blocks whose text
slowly churns, signalling that the anthology is still growing / data is still
being recovered. They are not playable and never resolve into real episodes;
real episodes get added *above* them.

This is distinct from the existing `locked: true` teaser cards (e.g. `tycho` /
SIGNAL LOST), which are legible "coming soon" placeholders shown with a real
`EP NN` number. Anomalies are a third card tier: no number, heavily corrupted,
always last.

## Decisions (locked during brainstorming)

- **Concept:** archive anomaly -- barely-readable corrupted blocks, pure
  artifact/dread, no legibility promise beyond a squint.
- **Motion:** slow continuous churn (~2.5s re-garble cadence). Paused under
  `prefers-reduced-motion` (render corrupted once, static).
- **Click:** brief reactive flinch -- short intensified garble burst + a denied
  audio blip, no navigation.
- **EP slot:** churning glitch block (`?? -- // ########`) instead of an EP
  number.
- **Title content:** heavily-corrupted versions of plausible future-episode
  titles, legible if you squint. Stored clean in source; corrupted at runtime.

## Data model (`episodes/manifest.json`)

A new entry kind, distinct from `locked`, appended to `episodes[]`:

```json
{ "anomaly": true, "title": "THE RENDEZVOUS", "byline": "..." }
```

- `title` / `byline` are stored as clean ASCII; the engine corrupts them at
  render. `title` is a real-ish future title (squint-legible after corruption);
  `byline` becomes the noise line under it.
- Three such entries, always the last items in the array. Permanent.

Seed content (rename freely; bylines read as noise regardless):

- `THE RENDEZVOUS`
- `COLD STORAGE`
- `THE LISTENERS`

## Build passthrough (`tools/build.mjs`)

`build.mjs` currently only special-cases `entry.locked` (pushing a stub with
`title`/`byline`) and otherwise reads `entry.file`. Add an anomaly branch
*before* the file read:

```js
if (entry.anomaly) {
  episodes.push({ anomaly: true, title: entry.title, byline: entry.byline || "" });
  continue;
}
```

No other tool changes are required:

- `tools/validate.mjs` `loadEpisodeFiles()` already guards on `e.file`, so
  fileless anomaly entries are skipped.
- The engine play-router (`!ep.locked && ep.nodes`) and `labEpisodes()`
  (`e.nodes`) already self-exclude entries with no nodes.

## Engine changes (`engine/template.html`)

### Menu render (`titleScreen`, ~line 762)

- Add an `ep.anomaly` branch ahead of the `ep.locked` branch.
- Replace the `EP NN` slot with a churning glitch block: `?? -- // ########`.
- Switch real-card numbering to a running counter that increments only on
  non-anomaly cards. (No visible change today since anomalies are last; robust
  if ordering ever shifts.)
- Card markup carries the clean base strings in `data-base-title` /
  `data-base-noise` so each churn tick re-corrupts from the original (never
  compounding corruption).
- Classes: `epcard anomaly`. A fixed faint chromatic-aberration text-shadow,
  independent of the sanity `--glitch` CSS var (which is 0 on the menu).

### Corruption function (new `corruptAnomaly`)

Reuses the existing `LOOKALIKE` map but is heavier than the HUD's
`corruptLabel`: per character, roll a lookalike swap, else a block/noise glyph
(`#`, plus block glyphs already used in-engine), else keep. Tuned so the title
stays squint-legible and the noise line is mostly garbage. Non-ASCII display
glyphs are already used in-engine (`LOOKALIKE` contains `Я`/`И`), so this stays
consistent; source data stays ASCII.

### Motion: slow continuous churn

- A single `setInterval` (~2.5s) started at the end of `titleScreen`,
  re-corrupting every anomaly card's title + noise line from the stored base
  strings.
- Cleared at the top of `titleScreen` (idempotent) and at the start of
  `startEpisode` (leaving the menu), mirroring the existing `clearWatch`
  lifecycle.
- Under `REDUCED`: no timer; cards render corrupted once, static.

### Click: reactive flinch

- Anomaly cards get an onclick handler that does **not** navigate: a ~400ms
  intensified garble burst (more block glyphs) then settle, plus a denied cue
  via the existing `AUDIO.blip("punct")` (no audio-engine changes).
- Under `REDUCED`: a single static re-garble + blip, no animation.

## CSS

- `.epcard.anomaly`: faint phosphor (close to `.epcard.locked`), `not-allowed`
  cursor, a fixed subtle red/blue chromatic-aberration text-shadow.

## Out of scope

- No new audio assets or audio-engine changes (reuse `AUDIO.blip`).
- No changes to `validate.mjs` logic or the prose linter.
- No new episode JSON; anomalies have no nodes and are never playable.

## Open knobs (tunable during implementation)

- Churn cadence (default ~2.5s).
- Exact block-glyph set / corruption intensities for title vs noise line.
- Whether all three share one decay intensity or get progressively worse toward
  the bottom of the list (default: shared intensity unless it looks flat).
