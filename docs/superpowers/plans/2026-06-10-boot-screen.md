# Boot Screen + Typed Tagline + Menu Drone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A skippable POST-style boot screen gates every fresh load; the wake press unlocks audio, the menu tagline types out char-by-char with telemetry blips, and a distant calm drone plays under the menu.

**Architecture:** Two files carry the feature. `engine/skein-audio.js` grows a third scene level (`menu()`, same drone graph at ~1/3 volume, dread clamped calm) and a `blip(kind)` UI voice that bypasses the scene gate but respects mute/volume. `engine/template.html` gets a `bootScreen()` pre-route state guarding `route()`, plus a one-time `typeSubtitle()` type-out in `titleScreen()`. `tools/audio-bench.html` gets trigger buttons for tuning.

**Tech Stack:** Vanilla JS in a single static HTML engine; Tone.js (vendored, global `Tone`); no test framework for browser code (repo tests cover only the validator tools). Verification is `npm run build` + Playwright against `dist/index.html` (Task 5), plus `npm test` as regression.

**Spec:** `docs/superpowers/specs/2026-06-10-boot-screen-design.md`

**Note on TDD:** The engine has no browser test harness and the repo's convention is manual playtest + Playwright verification for engine changes (validator tools are the only unit-tested code). Tasks 1-4 therefore end with a syntax check and Task 5 is the behavioral verification gate. Do not introduce a JS test framework for this.

**Parallelism:** Task 1+2 (audio files) and Task 3+4 (template.html) touch disjoint files and can run as two parallel workers. Task 5 runs after both.

---

### Task 1: skein-audio.js -- menu scene + blip voice

**Files:**
- Modify: `engine/skein-audio.js`

- [x] **Step 1: Add tuning constants**

After the `MASTER_CEIL` line (~line 35), add:

```js
const MENU_LEVEL = 0.33;       // menu-scene master scale: same ship, heard from outside
const BLIP = { charHz: 780, punctHz: 520, driftCents: 30, volDb: -18 }; // typed-tagline telemetry voice
```

- [x] **Step 2: Replace the `_awake` boolean with a `_scene` string**

In the constructor, replace:

```js
      this._awake = false;        // scene gate: graph runs from first gesture, audible only in play
```

with:

```js
      this._scene = 'off';        // 'off' (boot screen) | 'menu' (distant calm drone) | 'play' (full ambience)
```

- [x] **Step 3: Name the limiter so blips can route around the scene-gated master**

In `init()`, replace:

```js
      n.master = new Tone.Gain(0).connect(new Tone.Limiter(-2).toDestination());
```

with:

```js
      n.limiter = new Tone.Limiter(-2).toDestination();
      n.master = new Tone.Gain(0).connect(n.limiter);
```

- [x] **Step 4: Replace wake()/sleep() with the three-scene gate**

Replace:

```js
    // scene gate, orthogonal to mute: wake() entering play, sleep() on the menu.
    wake() { this._awake = true; if (this.isReady) this._applyMaster(RAMP); }
    sleep() { this._awake = false; if (this.isReady) this._applyMaster(2.0); }
```

with:

```js
    // scene gate, orthogonal to mute: sleep() on the boot screen, menu() on the
    // salvage menu (distant, dread clamped calm), wake() entering play.
    wake() { this._setScene('play'); }
    menu() { this._setScene('menu'); }
    sleep() { this._setScene('off'); }
    _setScene(s) {
      this._scene = s;
      if (!this.isReady) return;
      this._applyDread(RAMP); // menu clamps dread to calm; play restores it
      this._applyMaster(s === 'off' ? 2.0 : RAMP);
    }
```

- [x] **Step 5: Scene-aware master and dread**

Replace `_applyMaster`:

```js
    _applyMaster(time) {
      const scene = this._scene === 'play' ? 1 : (this._scene === 'menu' ? MENU_LEVEL : 0);
      const target = this._muted ? 0 : this._userVolume * MASTER_CEIL * scene;
      this._nodes.master.gain.rampTo(target, time);
    }
```

In `_applyDread`, replace the first line:

```js
      const d = this._dread, n = this._nodes;
```

with:

```js
      // the menu holds calm regardless of the last episode's sanity
      const d = this._scene === 'menu' ? 0 : this._dread, n = this._nodes;
```

- [x] **Step 6: Add the blip voice**

After the `stinger()` method, add:

```js
    // UI voice for the boot beep and the typed-tagline telemetry blips. Bypasses
    // the scene gate (it must sound on the boot screen, where the drone is still
    // silent) but respects mute and the volume pref. One mono synth, lazily built.
    blip(kind = 'char') {
      if (!this.isReady || this._muted) return;
      const n = this._nodes;
      try {
        if (!n.blipSynth) {
          n.blipLp = new Tone.Filter({ type: 'lowpass', frequency: 1400, Q: 0.5 }).connect(n.limiter);
          n.blipSynth = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.004, decay: 0.028, sustain: 0, release: 0.012 },
            volume: BLIP.volDb
          }).connect(n.blipLp);
        }
        const now = Tone.now(), v = this._userVolume;
        if (kind === 'boot') { // the audio bus coming up: two slower notes
          n.blipSynth.triggerAttackRelease(BLIP.punctHz, 0.09, now, 0.9 * v);
          n.blipSynth.triggerAttackRelease(BLIP.charHz, 0.07, now + 0.13, 0.7 * v);
        } else {
          const hz = (kind === 'punct' ? BLIP.punctHz : BLIP.charHz)
            * Math.pow(2, (Math.random() * 2 - 1) * BLIP.driftCents / 1200);
          n.blipSynth.triggerAttackRelease(hz, 0.03, now, 0.5 * v);
        }
      } catch (e) { /* a UI sound must never break the UI */ }
    }
```

- [x] **Step 7: Update the wiring comment**

In the header comment block (top of file), replace:

```js
 *   startButton.addEventListener('click', async () => { await audio.init(); ... });
```

with:

```js
 *   startButton.addEventListener('click', async () => { await audio.init(); ... });
 *   audio.menu();                      // distant calm drone (salvage menu)
 *   audio.wake(); / audio.sleep();     // full ambience (play) / silence (boot)
 *   audio.blip('char'|'punct'|'boot'); // UI telemetry blips (typed tagline, boot beep)
```

- [x] **Step 8: Syntax check**

Run: `node --check engine/skein-audio.js`
Expected: no output, exit 0.

- [x] **Step 9: Commit**

```bash
git add engine/skein-audio.js
git commit -m "feat(audio): menu scene level + blip UI voice"
```

---

### Task 2: audio-bench.html -- blip and scene triggers

**Files:**
- Modify: `tools/audio-bench.html`

- [x] **Step 1: Add the buttons**

After the existing stinger/mute `<div class="buttons">` block (the one containing `stinger: dead` and `mute`), add:

```html
  <div class="buttons">
    <button class="bl" data-k="char" disabled>blip: char</button>
    <button class="bl" data-k="punct" disabled>blip: punct</button>
    <button class="bl" data-k="boot" disabled>blip: boot</button>
    <button id="scene-menu" disabled>scene: menu</button>
    <button id="scene-play" disabled>scene: play</button>
  </div>
```

- [x] **Step 2: Wire them**

After the existing `.st` stinger wiring line (`document.querySelectorAll('.st').forEach(...)`), add:

```js
  document.querySelectorAll('.bl').forEach(b => b.addEventListener('click', () => audio.blip(b.dataset.k)));
  $('#scene-menu').addEventListener('click', () => audio.menu());
  $('#scene-play').addEventListener('click', () => audio.wake());
```

(The `$` helper and the `enableAll` that flips `disabled` off already exist and cover the new buttons.)

- [x] **Step 3: Commit**

```bash
git add tools/audio-bench.html
git commit -m "feat(bench): blip + scene trigger rows"
```

---

### Task 3: template.html -- boot screen + route gate

**Files:**
- Modify: `engine/template.html`

- [x] **Step 1: Add boot CSS**

After the `.eplist{...}` rule (line ~133):

```css
  .boot{max-width:520px;margin:0 auto;padding-top:18vh;font-family:var(--font-display);font-size:20px;text-align:left}
  .boot-line{color:var(--phosphor-dim);white-space:pre;visibility:hidden}
  .boot-prompt{margin-top:26px;color:var(--phosphor);visibility:hidden}
```

- [x] **Step 2: Add bootScreen() just above the ROUTING comment block**

Insert before the `/* ---- ROUTING: ... ---- */` comment (near the end of the script):

```js
/* ---- BOOT: every fresh load opens on a silent POST scroll; the press that
   dismisses it is the autoplay gesture that unlocks audio (the first beep you
   ever hear is the audio bus coming up). It gates routing, so deep links
   (#episode-id) pass through the boot too, then land in the episode. ---- */
const BOOT_LINES = [
  "SKEIN RUNTIME v" + VERSION,
  "MEM CHECK ............ OK",
  "PHOSPHOR ............. OK",
  "NEURAL LINK .......... DEGRADED",
  "AUDIO BUS ............ WAITING"
];
let booted = false;
function bootScreen(){
  root.innerHTML = `<div class="boot">` +
    BOOT_LINES.map(l=>`<div class="boot-line">${esc(l)}</div>`).join("") +
    `<div class="boot-prompt">&gt; PRESS ANY KEY TO WAKE<span class="cursor"></span></div></div>`;
  const lines=[...root.querySelectorAll(".boot-line")];
  const prompt=root.querySelector(".boot-prompt");
  let shown=0, timer=null, atPrompt=false, waking=false;
  const showPrompt=()=>{ if(timer){ clearInterval(timer); timer=null; }
    lines.forEach(l=>l.style.visibility="visible");
    prompt.style.visibility="visible"; atPrompt=true; };
  if(REDUCED) showPrompt();
  else timer=setInterval(()=>{ if(shown<lines.length) lines[shown++].style.visibility="visible"; else showPrompt(); }, 190);
  const press=(e)=>{
    if(e.type==="keydown" && ["Shift","Control","Alt","Meta"].includes(e.key)) return;
    if(waking) return;
    if(!atPrompt){ showPrompt(); return; } // first press fast-forwards the scroll
    waking=true;
    const bus=lines.find(l=>l.textContent.startsWith("AUDIO BUS"));
    if(bus) bus.textContent="AUDIO BUS ............ OK";
    if(AUDIO) AUDIO.init().then(()=>AUDIO.blip("boot"));
    setTimeout(()=>{
      document.removeEventListener("pointerdown",press);
      document.removeEventListener("keydown",press);
      booted=true; route();
    }, 450);
  };
  document.addEventListener("pointerdown", press);
  document.addEventListener("keydown", press);
}
```

- [x] **Step 3: Gate route() and boot on load**

At the top of `function route(){`, add as the first line:

```js
  if(!booted) return; // the boot screen owns the screen until the wake press
```

And replace the final `route();` call (last line of the script, after the `hashchange` listener) with:

```js
bootScreen();
```

- [x] **Step 4: Syntax check**

Extract and check the inline script:

```bash
node -e "const m=require('fs').readFileSync('engine/template.html','utf8').match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,'')); m.forEach(s=>new Function(s)); console.log('OK')"
```

Expected: `OK` (constructing the Function compiles without executing; DOM access stays untouched).

- [x] **Step 5: Commit**

```bash
git add engine/template.html
git commit -m "feat(engine): POST boot screen gates routing + audio unlock"
```

---

### Task 4: template.html -- menu type-out + menu drone call

**Files:**
- Modify: `engine/template.html` (depends on Task 3 being committed; same file)

- [x] **Step 1: Add type-out CSS**

Next to the boot CSS added in Task 3:

```css
  .eplist{transition:opacity .9s ease}
  .eplist.eplist-hidden{opacity:0;pointer-events:none}
```

And inside the existing reduced-motion media block (line ~220, `@media (prefers-reduced-motion: reduce){...}`), add `.eplist{transition:none}` so it reads:

```css
  @media (prefers-reduced-motion: reduce){ .screen{animation:none} .cursor{animation:none} .eplist{transition:none} }
```

- [x] **Step 2: Switch the menu to the distant drone**

In `titleScreen()`, replace:

```js
  if(AUDIO) AUDIO.sleep(); // the salvage menu is silent
```

with:

```js
  if(AUDIO) AUDIO.menu(); // distant calm drone: the ship is out there, even from the menu
```

- [x] **Step 3: First-render type-out in titleScreen()**

Replace the `root.innerHTML = ...` block at the end of `titleScreen()`:

```js
  root.innerHTML = `<div class="title-screen">
    <div class="bigtitle glitchable glow">${words.join("<br>")}</div>
    <div class="sub">${MANIFEST.subtitle||""}<span class="cursor"></span></div>
    <div class="eplist">${cards}</div></div>` + footer();
  scrollTop(false);
}
```

with:

```js
  const sub = MANIFEST.subtitle||"";
  const typing = !menuTyped && !REDUCED && !!sub;
  root.innerHTML = `<div class="title-screen">
    <div class="bigtitle glitchable glow">${words.join("<br>")}</div>
    <div class="sub"><span id="subtype">${typing?"":sub}</span><span class="cursor"></span></div>
    <div class="eplist${typing?" eplist-hidden":""}">${cards}</div></div>` + footer();
  scrollTop(false);
  if(typing) typeSubtitle(sub);
}
```

- [x] **Step 4: Add typeSubtitle() after titleScreen()**

```js
/* One-time tagline type-out on the first menu after boot: char-by-char with
   telemetry blips (silent on spaces, lower on punctuation), episode cards held
   back until the line lands. Any press completes it instantly. */
let menuTyped=false;
function typeSubtitle(text){
  menuTyped=true; // once per load, even if interrupted by navigation
  const el=document.getElementById("subtype");
  let timer=null, i=0;
  const done=()=>{ if(timer){ clearTimeout(timer); timer=null; }
    document.removeEventListener("pointerdown",done);
    if(!el.isConnected) return; // navigated away mid-type
    el.textContent=text;
    const list=root.querySelector(".eplist"); if(list) list.classList.remove("eplist-hidden"); };
  document.addEventListener("pointerdown",done);
  const step=()=>{
    if(!el.isConnected || i>=text.length) return done();
    const ch=text[i++]; el.textContent+=ch;
    if(AUDIO && ch!==" ") AUDIO.blip(/[a-z0-9]/i.test(ch)?"char":"punct");
    timer=setTimeout(step, ch===" " ? 95 : 38+Math.random()*24);
  };
  timer=setTimeout(step, 350);
}
```

- [x] **Step 5: Syntax check**

Same command as Task 3 Step 4. Expected: `OK`.

- [x] **Step 6: Commit**

```bash
git add engine/template.html
git commit -m "feat(engine): typed tagline with blips + distant menu drone"
```

---

### Task 5: Build + behavioral verification

**Files:**
- Read-only verification; no source changes expected (fixes loop back into Tasks 1-4 files).

- [x] **Step 1: Regression + build**

```bash
npm test && npm run build
```

Expected: validator/diversity tests pass; build writes `dist/index.html` with audio inlined.

- [x] **Step 2: Playwright -- boot flow**

Open `file://<repo>/dist/index.html`. Verify in order:
1. Boot screen visible; within ~1.5s all five POST lines shown; prompt `> PRESS ANY KEY TO WAKE` with blinking cursor; `AUDIO BUS ............ WAITING` present. No menu content.
2. Click once: `AUDIO BUS ............ OK` appears; after ~450ms the menu renders.
3. On the menu: title `WAKE ALONE` visible immediately; subtitle types out (snapshot mid-type shows a prefix of "an anthology of small dark rooms in deep space"); episode cards initially `eplist-hidden`.
4. After typing completes (~3s) the full subtitle is shown and cards are visible/clickable.
5. Console: no errors (Tone.js autoplay warnings before the click are acceptable).

- [x] **Step 3: Playwright -- skip paths**

Reload. Click during the POST scroll: all lines + prompt appear immediately (first press = fast-forward). Click again: menu. Click during the type-out: subtitle completes instantly, cards appear.

- [x] **Step 4: Playwright -- deep link + return**

Navigate to `file://<repo>/dist/index.html#<first-unlocked-episode-id>` (check `episodes/manifest.json` for an unlocked id, e.g. `derelict`). Verify: boot screen first; after wake press the EPISODE renders (not the menu). Then click "abort to salvage menu": menu renders fully formed, subtitle already complete, no re-boot, no re-type.

- [x] **Step 5: Final commit if any fixes were made, then report**

```bash
git status
```

Expected: clean tree (all work committed in Tasks 1-4 or fix commits).
