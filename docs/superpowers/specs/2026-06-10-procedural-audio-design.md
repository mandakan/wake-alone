# Procedural sanity-coupled audio (skein-audio) - design

Date: 2026-06-10. Source design: `~/Downloads/wake-audio` (skein-audio.js +
integration notes). This doc records the integration decisions; the audio engine
itself ships as `engine/skein-audio.js`.

## Goal

Ambient dread that degrades with the prose, driven by the same sanity value the
renderer already tracks. No audio assets: everything is synthesised at runtime
with Tone.js. Zero content changes - episodes are untouched; this is renderer-only.

## Decisions

- **Vendor Tone.js, no CDN.** `vendor/tone.min.js`, pinned 14.8.49 (the version
  the engine was written against; sha256 1261cdd3331d826237e7b0b954b5ed7d2381c8df
  4331d2018acea8c7a64a9a7b). The build inlines it (plus skein-audio.js) into
  `dist/index.html`, replacing the `<!--__AUDIO__-->` marker, so dist stays a
  single standalone file. Cost: dist grows ~350 kB.
- **Unlock on first pointerdown** (capture, once) anywhere on the page, not just
  the menu card click - covers deep links and lab mode, and satisfies autoplay
  policy because it always runs inside a real gesture. `init()` is idempotent.
- **Awake/asleep scene gating** (added to SkeinAudio): the graph runs from first
  gesture, but the master gain only opens during play. `wake()` in
  `startEpisode`, `sleep()` in `titleScreen`. Menu is silent; mute pref
  (localStorage `skein-audio-muted`) is orthogonal and persisted.
- **One choke point for sanity:** `setScreen()` already runs on every state
  change (goto, choose, useGel, lab slider), so `AUDIO.setSanity()` lives there.
  `setNode()` is called from `goto()` and `startEpisode()`.
- **Stingers:** `dead` ending -> `dead`; `escape`/authored `madness` ending ->
  `reveal`; sanity-zero madness -> `dead`; any single effects-application that
  costs >= 15 sanity -> `sanity` (fired from `applyEffects`).
- **Mute control in the footer**, styled like the existing abort/source links,
  label `sound: on|off`, rendered on every screen. Unmuting also calls `init()`
  (it is a gesture).
- **Engine degrades to silence**: template guards on `typeof SkeinAudio`; the
  raw template (no build injection) and any Tone failure are silent no-ops.
- **No per-node `audio` field in v1.** The doc's optional author-cue extension
  (validate/strip plumbing like `spec`/`character`) is deferred until the
  default ambience proves insufficient.

## Files

- `vendor/tone.min.js` - pinned dependency (committed; see vendor/README.md)
- `engine/skein-audio.js` - the ambience engine + wake/sleep addition
- `engine/template.html` - `<!--__AUDIO__-->` marker + ~20 lines of wiring
- `tools/build.mjs` - inlines the two scripts at the marker (function-form
  `replace` so `$` sequences in minified Tone are literal)
- `tools/audio-bench.html` - tuning bench (local script paths; open directly)

## Testing

`npm run validate` and `npm test` must stay green (no episode/solver changes).
`npm run build`, then Playwright smoke: load dist, enter an episode, confirm no
console errors, Tone context running after a click, mute toggle flips state.
Audible tuning happens in `tools/audio-bench.html` by ear.

## Known caveats (from the source doc)

- Synthesised ambience tops out at "competent unsettling drone"; a CC0 one-shot
  hybrid remains the escape hatch for specific scares.
- Low-frequency content is speaker-dependent; the sub is gated to low sanity and
  deliberately not load-bearing. Test on laptop speakers and phone.
- Verify CPU over 20+ minute sessions (reverb tails).
