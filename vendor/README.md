# vendor/

Pinned third-party runtime code, committed so the build needs no network and the
shipped site has no CDN dependency.

- `tone.min.js` - Tone.js 14.8.49 (MIT, https://tonejs.github.io/), the
  production build from cdnjs (`/ajax/libs/tone/14.8.49/Tone.js`).
  sha256: 1261cdd3331d826237e7b0b954b5ed7d2381c8df4331d2018acea8c7a64a9a7b
  Used by `engine/skein-audio.js`; inlined into `dist/index.html` by
  `tools/build.mjs`. If you bump the version, re-tune by ear in
  `tools/audio-bench.html` before shipping.
