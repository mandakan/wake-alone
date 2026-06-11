# Archive Anomaly Placeholders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three permanent, non-numbered "archive anomaly" cards pinned to the end of the salvage menu that render as barely-readable, slowly-churning corrupted blocks.

**Architecture:** A new `anomaly: true` manifest entry kind (no `file`, no nodes). `build.mjs` passes it through to the runtime `EPISODES` array. The engine renders these as a distinct card variety with a churning corruption effect driven by a single `setInterval`, plus a non-navigating click "flinch". No new episode JSON, no audio assets, no validator changes.

**Tech Stack:** Static HTML/CSS/vanilla JS engine (`engine/template.html`), Node build/validate scripts (`tools/*.mjs`), Playwright (via MCP) for browser verification. No test framework exists for the engine UI, so verification is: `npm run validate` (stays green), `npm run build` (succeeds, correct playable count), targeted grep/code checks, and Playwright behavioral checks against `dist/index.html`.

**Spec:** `docs/superpowers/specs/2026-06-11-archive-anomaly-placeholders-design.md`

---

## File structure / decomposition

- `episodes/manifest.json` — three new `anomaly` entries at the end of `episodes[]`. (data)
- `tools/build.mjs` — anomaly passthrough branch + fix playable-count filter. (build)
- `engine/template.html` — all engine behavior, split across three concerns:
  - CSS: `.epcard.anomaly` rule (presentation).
  - JS render: `corruptAnomaly` + helpers, the `titleScreen` card branch, running episode-number counter (render).
  - JS lifecycle/interaction: churn `setInterval` start/stop wired into `titleScreen`/`startEpisode`, and the `anomalyFlinch` click handler (behavior).

These are interdependent edits to one file, so tasks are **sequential** (not parallel). Each task still produces a self-contained, verifiable change.

---

## Task 1: Manifest anomaly entries

**Files:**
- Modify: `episodes/manifest.json` (the `episodes` array, after the `fault.json` entry)

- [ ] **Step 1: Add three anomaly entries at the end of `episodes[]`**

In `episodes/manifest.json`, the array currently ends with:

```json
    {
      "file": "fault.json",
      "locked": false
    }
  ]
```

Replace that closing with the `fault.json` entry followed by three anomaly entries:

```json
    {
      "file": "fault.json",
      "locked": false
    },
    {
      "anomaly": true,
      "title": "THE RENDEZVOUS",
      "byline": "signal degraded beyond recovery threshold"
    },
    {
      "anomaly": true,
      "title": "COLD STORAGE",
      "byline": "checksum fault // segment unreadable"
    },
    {
      "anomaly": true,
      "title": "THE LISTENERS",
      "byline": "archive integrity compromised"
    }
  ]
```

Note: `title`/`byline` are clean ASCII; the engine corrupts them at render. These are placeholder names and may be renamed later without code changes.

- [ ] **Step 2: Verify the manifest is valid JSON and unaffected episodes still validate**

Run: `node -e "JSON.parse(require('fs').readFileSync('episodes/manifest.json','utf8')); console.log('json ok')" && npm run validate`
Expected: `json ok`, then validate prints `ok` for every playable episode and exits 0. The anomaly entries have no `file`, so `validate`'s `loadEpisodeFiles()` (`e.file` guard) skips them — no new errors.

- [ ] **Step 3: Commit**

```bash
git add episodes/manifest.json
git commit -m "feat(menu): add three archive-anomaly manifest entries"
```

---

## Task 2: Build passthrough for anomaly entries

**Files:**
- Modify: `tools/build.mjs:21-25` (the manifest loop) and `tools/build.mjs:72` (playable-count log)

- [ ] **Step 1: Add the anomaly branch before the file read**

In `tools/build.mjs`, the loop currently starts:

```js
for (const entry of manifest.episodes) {
  if (entry.locked) {
    episodes.push({ locked: true, title: entry.title || "LOCKED", byline: entry.byline || "" });
    continue;
  }
  const ep = JSON.parse(readFileSync(join(EP_DIR, entry.file), "utf8"));
```

Insert the anomaly branch immediately after the `locked` branch's closing `}` and before `const ep = ...`:

```js
for (const entry of manifest.episodes) {
  if (entry.locked) {
    episodes.push({ locked: true, title: entry.title || "LOCKED", byline: entry.byline || "" });
    continue;
  }
  if (entry.anomaly) {
    episodes.push({ anomaly: true, title: entry.title || "ANOMALY", byline: entry.byline || "" });
    continue;
  }
  const ep = JSON.parse(readFileSync(join(EP_DIR, entry.file), "utf8"));
```

This stops the loop from trying to `readFileSync(entry.file)` on a fileless entry.

- [ ] **Step 2: Fix the playable-count filter so anomalies are not counted as playable**

In `tools/build.mjs`, the final log line currently reads:

```js
console.log(`\n${C.green}built dist/index.html${C.reset} ${C.dim}(${(html.length/1024).toFixed(0)} kB, ${episodes.filter(e=>!e.locked).length} playable episode(s))${C.reset}`);
```

Change the filter to also exclude anomalies (they are not `locked`, so without this they would inflate the count):

```js
console.log(`\n${C.green}built dist/index.html${C.reset} ${C.dim}(${(html.length/1024).toFixed(0)} kB, ${episodes.filter(e=>!e.locked && !e.anomaly).length} playable episode(s))${C.reset}`);
```

- [ ] **Step 3: Build and verify the count + anomaly passthrough**

Run: `npm run build`
Expected: build succeeds, exits 0, and the summary reports the count of real playable episodes only (the same number as before this change — anomalies excluded).

Run: `node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');const m=h.match(/EPISODES = (\[.*?\]);/s);const eps=JSON.parse(m[1]);console.log('anomalies:', eps.filter(e=>e.anomaly).map(e=>e.title));"`
Expected: `anomalies: [ 'THE RENDEZVOUS', 'COLD STORAGE', 'THE LISTENERS' ]`

- [ ] **Step 4: Commit**

```bash
git add tools/build.mjs
git commit -m "feat(build): pass anomaly manifest entries through to runtime"
```

---

## Task 3: Anomaly card CSS

**Files:**
- Modify: `engine/template.html:140` (insert a rule after `.epcard.locked`)

- [ ] **Step 1: Add the `.epcard.anomaly` rule**

In `engine/template.html`, find:

```css
  .epcard.locked{cursor:not-allowed;color:var(--phosphor-faint);border-color:rgba(255,176,0,.1)}
```

Insert this rule on the line immediately after it:

```css
  .epcard.anomaly{cursor:not-allowed;color:var(--phosphor-faint);border-color:rgba(255,176,0,.08);
    text-shadow:1px 0 1px rgba(255,0,40,.30),-1px 0 1px rgba(0,180,255,.30)}
  .epcard.anomaly:hover{background:transparent;border-color:rgba(255,176,0,.14)}
```

The fixed chromatic-aberration text-shadow is independent of the sanity `--glitch` var (which is 0 on the menu). The `:hover` override stops the normal `.epcard:hover` (which brightens to full phosphor) from making an anomaly look selectable.

- [ ] **Step 2: Verify the rule is present and well-formed**

Run: `grep -n "epcard.anomaly" engine/template.html`
Expected: two matching lines (the base rule and the `:hover` rule).

- [ ] **Step 3: Commit**

```bash
git add engine/template.html
git commit -m "feat(menu): style .epcard.anomaly cards"
```

---

## Task 4: Anomaly corruption + render branch + numbering

**Files:**
- Modify: `engine/template.html` — add corruption helpers near `corruptLabel` (~line 563); change the `titleScreen` card map (~lines 762-771)

- [ ] **Step 1: Add the corruption + fill helpers**

In `engine/template.html`, find the existing line (~563):

```js
function corruptLabel(str,intensity){ return str.split("").map(ch=>{ const up=ch.toUpperCase(); return (LOOKALIKE[up]&&Math.random()<intensity)?LOOKALIKE[up]:ch; }).join(""); }
```

Insert directly after it:

```js
/* Menu-only "archive anomaly" corruption: heavier than the HUD's corruptLabel.
   Per char: block/noise glyph (prob `block`), else lookalike swap (prob `look`),
   else keep. Titles stay squint-legible; the noise line is mostly garbage.
   `heavy` is the click-flinch burst. Block glyphs match the in-engine glyph set. */
const ANOM_BLOCKS="█▓▒#"; // full block, dark/medium shade, hash
function corruptAnomaly(str,block,look){
  return str.split("").map(ch=>{
    if(ch===" ") return ch;
    if(Math.random()<block) return ANOM_BLOCKS[Math.floor(Math.random()*ANOM_BLOCKS.length)];
    const up=ch.toUpperCase();
    return (LOOKALIKE[up]&&Math.random()<look)?LOOKALIKE[up]:ch;
  }).join("");
}
const anomTitle=(s,heavy)=>corruptAnomaly(s, heavy?0.45:0.22, 0.70);
const anomNoise=(s,heavy)=>corruptAnomaly(s, heavy?0.70:0.50, 0.60);
function fillAnomaly(card,heavy){
  const n=card.querySelector(".epn"), t=card.querySelector(".ept"), b=card.querySelector(".epb");
  if(n) n.textContent="?? -- // "+anomNoise("########",heavy);
  if(t) t.textContent="[ "+anomTitle(card.dataset.baseTitle||"",heavy)+" ]";
  if(b) b.textContent=anomNoise(card.dataset.baseNoise||"",heavy);
}
function fillAllAnomalies(heavy){ root.querySelectorAll(".epcard.anomaly").forEach(c=>fillAnomaly(c,heavy)); }
```

(`█▓▒` are the block/shade glyphs; written as escapes so the source stays ASCII per house style.)

- [ ] **Step 2: Add the anomaly render branch and switch to a running episode counter**

In `engine/template.html`, find the card map inside `titleScreen` (~762):

```js
  const cards = EPISODES.map((ep,i)=>{
    const n = "EP " + String(i+1).padStart(2,"0");
    if(ep.locked) return `<div class="epcard locked"><div class="epn">${n} // ENCRYPTED</div>
      <div class="ept">[ ${ep.title} ]</div><div class="epb">${ep.byline||""}</div></div>`;
    const o = scars[ep.id];
    const scar = o ? `<div class="scar scar--${o.type}">// last attempt: ${esc(o.label||"UNKNOWN")}</div>` : "";
    return `<div class="epcard" data-ep="${esc(ep.id)}" onclick="location.hash=this.dataset.ep">
      <div class="epn">${n}</div><div class="ept">${ep.title}</div>
      <div class="epb">${ep.byline||""}</div>${scar}</div>`;
  }).join("");
```

Replace it with (note: numbering now comes from a counter that only advances on non-anomaly cards, so anomalies consume no number; behavior for existing cards is unchanged because anomalies are last):

```js
  let epNo = 0;
  const cards = EPISODES.map((ep)=>{
    if(ep.anomaly) return `<div class="epcard anomaly" data-base-title="${esc(ep.title||"")}" data-base-noise="${esc(ep.byline||"")}" onclick="anomalyFlinch(this)">
      <div class="epn"></div><div class="ept"></div><div class="epb"></div></div>`;
    epNo++;
    const n = "EP " + String(epNo).padStart(2,"0");
    if(ep.locked) return `<div class="epcard locked"><div class="epn">${n} // ENCRYPTED</div>
      <div class="ept">[ ${ep.title} ]</div><div class="epb">${ep.byline||""}</div></div>`;
    const o = scars[ep.id];
    const scar = o ? `<div class="scar scar--${o.type}">// last attempt: ${esc(o.label||"UNKNOWN")}</div>` : "";
    return `<div class="epcard" data-ep="${esc(ep.id)}" onclick="location.hash=this.dataset.ep">
      <div class="epn">${n}</div><div class="ept">${ep.title}</div>
      <div class="epb">${ep.byline||""}</div>${scar}</div>`;
  }).join("");
```

The anomaly card renders empty `.epn/.ept/.epb`; Task 5 fills and churns them. `anomalyFlinch` is defined in Task 5 (the inline `onclick` is fine — it resolves at click time, after the script has fully loaded).

- [ ] **Step 3: Verify syntax and that numbering for real cards is unchanged**

Run: `node -e "require('fs').readFileSync('engine/template.html','utf8'); console.log('read ok')" && grep -n "epcard anomaly" engine/template.html`
Expected: `read ok` and one matching anomaly-card line. (Full behavioral verification happens in Task 5 once the fill/churn lifecycle exists.)

- [ ] **Step 4: Commit**

```bash
git add engine/template.html
git commit -m "feat(menu): render anomaly cards with corrupted text and unnumbered slot"
```

---

## Task 5: Churn lifecycle + click flinch

**Files:**
- Modify: `engine/template.html` — add lifecycle fns + `anomalyFlinch` near the helpers from Task 4; wire `startAnomalyChurn()` into `titleScreen` (~line 779) and `stopAnomalyChurn()` into `startEpisode` (~line 484)

- [ ] **Step 1: Add the churn lifecycle and flinch handler**

In `engine/template.html`, directly after the `fillAllAnomalies` function added in Task 4, insert:

```js
let anomTimer=null;
function startAnomalyChurn(){
  stopAnomalyChurn();
  fillAllAnomalies(false);              // initial corrupted state (also the static state under REDUCED)
  if(REDUCED) return;                   // reduced-motion: corrupt once, never animate
  anomTimer=setInterval(()=>fillAllAnomalies(false), 2500);
}
function stopAnomalyChurn(){ if(anomTimer){ clearInterval(anomTimer); anomTimer=null; } }
/* Click does not navigate: a short intensified garble burst that settles, plus a
   denied blip. Under reduced-motion, a single static re-garble (no animation). */
function anomalyFlinch(card){
  if(AUDIO) AUDIO.blip("punct");
  if(REDUCED){ fillAnomaly(card,true); return; }
  let n=0; const burst=setInterval(()=>{ fillAnomaly(card,true); if(++n>=6){ clearInterval(burst); fillAnomaly(card,false); } }, 70);
}
```

- [ ] **Step 2: Start churn at the end of `titleScreen`**

In `engine/template.html`, find the end of `titleScreen` (~778-779):

```js
  scrollTop(false);
  if(typing) typeSubtitle(sub);
}
```

Add `startAnomalyChurn();` after the `typeSubtitle` line:

```js
  scrollTop(false);
  if(typing) typeSubtitle(sub);
  startAnomalyChurn();
}
```

(Anomaly cards exist in the DOM even while the eplist is hidden during the tagline type-out; filling/churning them early is harmless and they show corrupted the instant the list reveals.)

- [ ] **Step 3: Stop churn when leaving the menu, in `startEpisode`**

In `engine/template.html`, find the start of `startEpisode` (~484):

```js
function startEpisode(ep){
  episode=ep;
```

Add `stopAnomalyChurn();` as the first line of the body:

```js
function startEpisode(ep){
  stopAnomalyChurn();
  episode=ep;
```

(`titleScreen` also calls `stopAnomalyChurn()` via `startAnomalyChurn()`, making re-entry idempotent.)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds, exits 0, playable count unchanged from Task 2.

- [ ] **Step 5: Verify rendering + churn + flinch in a browser (Playwright MCP)**

Use the Playwright MCP browser tools against the built file. Resolve the absolute path first:

Run: `node -e "console.log('file://'+require('path').resolve('dist/index.html'))"`

Then:
1. `browser_navigate` to that `file://...` URL.
2. Force the menu past the boot gate with `browser_evaluate`:
   `() => { booted = true; if (location.hash) location.hash = ''; titleScreen(); return document.querySelectorAll('.epcard.anomaly').length; }`
   Expected return: `3`.
3. Assert anomalies are unnumbered and corrupted, with `browser_evaluate`:
   `() => [...document.querySelectorAll('.epcard.anomaly')].map(c => ({ epn: c.querySelector('.epn').textContent, ept: c.querySelector('.ept').textContent }))`
   Expected: each `epn` starts with `?? -- // ` and contains no `EP`; each `ept` is bracketed corrupted text (contains `[` and `]`).
4. Assert real cards keep correct sequential numbering, with `browser_evaluate`:
   `() => [...document.querySelectorAll('.epcard:not(.anomaly):not(.locked) .epn, .epcard.locked .epn')].map(e => e.textContent)`
   Expected: `EP 01`, `EP 02`, ... contiguous, no gaps, anomalies absent from the list.
5. Assert churn changes text over time: `browser_evaluate` to snapshot `document.querySelector('.epcard.anomaly .ept').textContent`, then `browser_wait_for` ~3 seconds, then snapshot again. Expected: the two snapshots differ (the 2.5s interval re-garbled it).
6. Assert flinch settles: `browser_evaluate` `() => { const c = document.querySelector('.epcard.anomaly'); anomalyFlinch(c); return c.querySelector('.ept').textContent; }` then `browser_wait_for` ~1 second and re-read. Expected: no navigation occurred (`location.hash` is empty), and the card still shows bracketed corrupted text after settling.
7. `browser_close`.

If any assertion fails, fix the implementation and rebuild before continuing.

- [ ] **Step 6: Verify reduced-motion handling by code inspection**

Playwright MCP cannot toggle `prefers-reduced-motion` (it is read into the `REDUCED` const at load). Confirm by reading the code that:
- `startAnomalyChurn` calls `fillAllAnomalies(false)` then `if(REDUCED) return;` before creating the interval (so reduced-motion renders corrupted once, static).
- `anomalyFlinch` has the `if(REDUCED){ fillAnomaly(card,true); return; }` early branch (single re-garble, no animation).

Run: `grep -n "if(REDUCED) return;" engine/template.html && grep -n "if(REDUCED){ fillAnomaly" engine/template.html`
Expected: both grep patterns match within the new functions.

- [ ] **Step 7: Final validation gate**

Run: `npm run validate && npm run build`
Expected: validate exits 0 (no episode regressions); build exits 0 with the correct playable count.

- [ ] **Step 8: Commit**

```bash
git add engine/template.html
git commit -m "feat(menu): slow-churn anomaly cards with reactive click flinch"
```

---

## Self-review checklist (completed during planning)

- **Spec coverage:** data model (T1), build passthrough + playable-count fix (T2), CSS (T3), corruption fn + render branch + unnumbered running counter (T4), churn lifecycle + reduced-motion + click flinch (T5). All spec sections mapped.
- **Hidden requirement surfaced:** `build.mjs:72` playable-count filter (`!e.locked`) would miscount anomalies as playable; fixed in T2 step 2.
- **Type/name consistency:** `corruptAnomaly`, `anomTitle`, `anomNoise`, `fillAnomaly`, `fillAllAnomalies`, `startAnomalyChurn`, `stopAnomalyChurn`, `anomTimer`, `anomalyFlinch`, and the `data-base-title`/`data-base-noise` attributes are used consistently across T4/T5. `ANOM_BLOCKS` defined once in T4 and reused.
- **No placeholders:** every code step shows complete code; every verify step has an exact command and expected output.
