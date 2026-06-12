# Audio auto-suspend on tab visibility — design

Date: 2026-06-12
Status: approved

## Problem

skein-audio keeps rendering when the page is backgrounded. On mobile the
browser deprioritizes the audio thread for hidden tabs, so the ambience
starts to crackle; it also drains battery and keeps the OS "tab is playing
audio" indicator lit.

## Decision

Suspend the AudioContext when the page is hidden, resume it when the page
becomes visible again, with fades on both edges. Trigger is the Page
Visibility API only (`document.visibilitychange`); window `blur`/`focus` is
deliberately not used — it is twitchy on desktop (devtools, second monitor)
and visibility already covers tab switch, app switch on mobile, and screen
lock.

Fading the master gain to 0 without suspending was rejected: a silent graph
still renders in the background, so the crackle source, battery cost, and
audio indicator all remain.

## Behavior

- **Hidden:** ramp the master gain to 0 over ~0.4 s, then suspend the raw
  AudioContext. Background tabs clamp `setTimeout` to ~1 s, so the suspend
  may land a moment after the fade completes; acceptable.
- **Visible:** resume the context, then restore the master gain via the
  existing `_applyMaster()` with a ~1.5 s fade-in. Mute state, user volume,
  and the current scene (off/menu/play) are respected automatically because
  `_applyMaster()` already encodes them. The resume call also recovers from
  iOS's `interrupted` context state.
- **Race guard:** a generation token invalidates the pending suspend if the
  page becomes visible again mid-fade; the gain ramps back up instead of the
  context suspending under a live page.

## Placement

All logic lives in `engine/skein-audio.js`. `init()` attaches one
`visibilitychange` listener after the graph is built (guarded so a missing
`document` is a no-op). `engine/template.html` needs no changes; the
audio-bench page gets the same behavior for free. No new public API, no
schema or validator impact.

## Testing

Manual: `npm run build`, open `dist/index.html` on a phone, background the
browser, confirm silence (no crackle, audio indicator clears), return,
confirm the ambience fades back in at the correct level for the current
scene and mute state. Desktop: switch tabs and back.
