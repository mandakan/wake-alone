# Hash Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the URL hash the single source of truth for which screen is showing, so browser Back returns to the salvage menu, episodes have shareable deep links, and an in-story "abort to menu" control exists.

**Architecture:** A single `route()` function reads `location.hash` and dispatches to `lab()`, `startEpisode(ep)`, or `titleScreen()`. It runs on initial load and on every `hashchange`. Episode cards and all "return to menu" buttons set/clear the hash instead of calling render functions directly. Story nodes never touch history, so Back from any node pops the hash to empty and lands on the menu. No per-node persistence: deep-linking or reloading into an episode starts it fresh.

**Tech Stack:** Plain ES in `engine/template.html` (the skein runtime). Build via `node tools/build.mjs` (inlines template -> `dist/index.html`). Behavioral verification via Playwright MCP against `dist/index.html`.

---

## Context for the implementer

The skein runtime is one self-contained file, `engine/template.html`. Its `<script>`
block defines the engine. There is **no per-component test harness for the engine**:
`npm test` runs only the solver fixtures (`tools/`), and `node tools/build.mjs`
inlines text without executing the page's JavaScript, so neither catches a JS syntax
error or a DOM-behavior regression in the template. Real verification is the final
Playwright task, which loads the built page and asserts hash/menu behavior and a
clean console.

Because of that, each edit task ends with a `node --check` syntax guard on the
extracted script plus a commit; the behavioral assertions live in Task 5. Keep the
app working after every task (the ordering below guarantees that).

Key current line anchors (verify before editing -- line numbers drift):
- `function footer(){...}` -- single line, currently line 745.
- Episode card markup with `onclick="startEpisode(EPISODES[${i}])"` -- currently
  lines 735-737, inside `titleScreen()`.
- Four `onclick="titleScreen()">> Return to salvage menu` buttons -- currently
  lines 668, 681, 694, 708 (endings + madness).
- Boot + lab `hashchange` listener -- currently lines 866-867:
  ```js
  if(labHash() && labAllowed()) lab(); else titleScreen();
  window.addEventListener("hashchange", ()=>{ if(labHash() && labAllowed() && !labOn) lab(); });
  ```
- `const labHash=()=> location.hash.toLowerCase()==="#lab";` -- currently line 865.
- `function render(){...}` ends with `+ footer();` at line 519 (the play screen).

---

## File Structure

Only `engine/template.html` changes. New functions `route()` and `returnToMenu()`
join the existing engine functions; `footer()` gains a parameter; the boot/listener
lines and several `onclick` strings are repointed. `dist/index.html` is regenerated
by the build (not hand-edited).

---

### Task 1: Add the router and `returnToMenu()`, wire boot + hashchange

**Files:**
- Modify: `engine/template.html` (boot lines ~865-867; add two functions just above them)

- [ ] **Step 1: Add `route()` and `returnToMenu()` directly above the `labHash` line**

Find (currently line 865):

```js
const labHash=()=> location.hash.toLowerCase()==="#lab";
```

Insert immediately BEFORE that line:

```js
/* ---- ROUTING: the URL hash is the single source of truth for which SCREEN is
   shown -- empty = salvage menu, #<episode-id> = that episode (started fresh),
   #lab = lab mode. Story nodes never touch history, so Back from any node pops
   the hash to empty and lands on the menu. ---- */
function route(){
  const hash = location.hash.replace(/^#/,"").toLowerCase();
  if(hash==="lab"){ if(labAllowed() && !labOn) lab(); return; }
  if(labOn) return; // lab owns the screen on staging; never auto-leaves it
  const ep = hash && EPISODES.find(e=> (e.id||"").toLowerCase()===hash && !e.locked && e.nodes);
  if(ep){ if(!episode || episode.id!==ep.id) startEpisode(ep); return; }
  // empty / unknown / locked -> menu (guarded so a duplicate empty hashchange is a no-op)
  if(episode || !root.querySelector(".title-screen")) titleScreen();
}
function returnToMenu(){ if(location.hash) location.hash=""; else route(); }
```

- [ ] **Step 2: Replace the boot line and lab-only hashchange listener with the router**

Find (currently lines 866-867):

```js
if(labHash() && labAllowed()) lab(); else titleScreen();
window.addEventListener("hashchange", ()=>{ if(labHash() && labAllowed() && !labOn) lab(); });
```

Replace with:

```js
window.addEventListener("hashchange", route);
route();
```

- [ ] **Step 3: Syntax-check the template's script**

Run:

```bash
node --check <(awk '/<script>/{f=1;next} /<\/script>/{f=0} f' engine/template.html)
```

Expected: no output, exit 0 (a syntax error would print a `SyntaxError` and exit non-zero).

- [ ] **Step 4: Build to confirm the template still inlines**

Run: `npm run build`
Expected: completes and writes `dist/index.html` with no error.

- [ ] **Step 5: Commit**

```bash
git add engine/template.html dist/index.html
git commit -m "feat(engine): add hash router and returnToMenu helper"
```

---

### Task 2: Start episodes by setting the hash

**Files:**
- Modify: `engine/template.html` (episode-card markup in `titleScreen()`, ~line 735)

- [ ] **Step 1: Point the card click at the hash instead of `startEpisode`**

Find (currently lines 735-737, inside `titleScreen()`):

```js
    return `<div class="epcard" onclick="startEpisode(EPISODES[${i}])">
      <div class="epn">${n}</div><div class="ept">${ep.title}</div>
      <div class="epb">${ep.byline||""}</div>${scar}</div>`;
```

Replace with (only the `onclick` changes -- it now sets the hash, which `route()`
turns into `startEpisode`):

```js
    return `<div class="epcard" onclick="location.hash='${ep.id}'">
      <div class="epn">${n}</div><div class="ept">${ep.title}</div>
      <div class="epb">${ep.byline||""}</div>${scar}</div>`;
```

- [ ] **Step 2: Syntax-check the template's script**

Run:

```bash
node --check <(awk '/<script>/{f=1;next} /<\/script>/{f=0} f' engine/template.html)
```

Expected: no output, exit 0.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: completes, writes `dist/index.html`.

- [ ] **Step 4: Commit**

```bash
git add engine/template.html dist/index.html
git commit -m "feat(engine): start episodes via URL hash (deep links)"
```

---

### Task 3: Repoint the four "return to menu" buttons at `returnToMenu()`

**Files:**
- Modify: `engine/template.html` (`renderEnding` ~lines 668, 681; `renderMadness` ~lines 694, 708)

- [ ] **Step 1: Replace every `onclick="titleScreen()"` on a salvage-menu button**

There are exactly four occurrences of this exact substring:

```
onclick="titleScreen()">> Return to salvage menu
```

Replace the `titleScreen()` call in each with `returnToMenu()`, so each reads:

```
onclick="returnToMenu()">> Return to salvage menu
```

(Use a global replace of `onclick="titleScreen()">> Return to salvage menu`
-> `onclick="returnToMenu()">> Return to salvage menu`. After this, the only
remaining `titleScreen()` reference is the one inside `route()` and the function
definition itself -- verify with the grep in Step 2.)

- [ ] **Step 2: Verify no stray `titleScreen()` button calls remain**

Run: `grep -n 'titleScreen()' engine/template.html`
Expected: matches only the definition `function titleScreen(){`, the call inside
`route()`, and the lab fallback `if(!eps.length){ titleScreen(); return; }`.
**No** match should contain `Return to salvage menu`.

- [ ] **Step 3: Syntax-check + build**

Run:

```bash
node --check <(awk '/<script>/{f=1;next} /<\/script>/{f=0} f' engine/template.html)
npm run build
```

Expected: both succeed, no output from `node --check`.

- [ ] **Step 4: Commit**

```bash
git add engine/template.html dist/index.html
git commit -m "feat(engine): route ending/madness menu buttons through returnToMenu"
```

---

### Task 4: In-story "abort to salvage menu" link in the footer

**Files:**
- Modify: `engine/template.html` (`.footer` CSS ~line 148; `footer()` ~line 745; `render()` call ~line 519)

- [ ] **Step 1: Add subtle abort-link styling next to the `.src` rules**

Find (currently lines 147-148):

```css
  .footer .src{color:inherit;text-decoration:none;border-bottom:1px solid var(--phosphor-ghost);transition:color .25s,border-color .25s}
  .footer .src:hover,.footer .src:focus{color:var(--phosphor-dim);border-color:var(--phosphor-dim)}
```

Insert immediately AFTER those two lines:

```css
  .footer .abort{font:inherit;color:var(--phosphor-ghost);background:transparent;border:0;border-bottom:1px solid var(--phosphor-ghost);padding:0;cursor:pointer;transition:color .25s,border-color .25s}
  .footer .abort:hover,.footer .abort:focus{color:var(--phosphor-dim);border-color:var(--phosphor-dim)}
```

- [ ] **Step 2: Give `footer()` an optional exit-link line**

Find (currently line 745):

```js
function footer(){ return `<div class="footer">skein v${VERSION} // neural integrity at 0% ends the run // <a class="src" href="https://github.com/mandakan/wake-alone" target="_blank" rel="noopener">source</a></div>`; }
```

Replace with:

```js
function footer(showExit){
  const exit = showExit
    ? `<div class="footer"><button class="abort" onclick="returnToMenu()">> abort to salvage menu</button></div>`
    : "";
  return exit + `<div class="footer">skein v${VERSION} // neural integrity at 0% ends the run // <a class="src" href="https://github.com/mandakan/wake-alone" target="_blank" rel="noopener">source</a></div>`;
}
```

- [ ] **Step 3: Show the link only on the play screen**

In `render()`, find the closing line (currently line 519):

```js
    + `</div>` + footer();
```

Replace with:

```js
    + `</div>` + footer(true);
```

(Leave every other `footer()` call -- menu, endings, madness -- without an argument,
so the abort link appears only during play.)

- [ ] **Step 4: Syntax-check + build**

Run:

```bash
node --check <(awk '/<script>/{f=1;next} /<\/script>/{f=0} f' engine/template.html)
npm run build
```

Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add engine/template.html dist/index.html
git commit -m "feat(engine): in-story abort-to-menu link in play footer"
```

---

### Task 5: Behavioral verification with Playwright

**Files:**
- No source changes. Verifies the built `dist/index.html`.

This task asserts the three behaviors end to end and a clean console. Use the
Playwright MCP browser tools. The target is the built file:
`file:///Users/mathias/work/wake-alone/dist/index.html`.

- [ ] **Step 1: Ensure a fresh build**

Run: `npm run build`
Expected: writes `dist/index.html`.

- [ ] **Step 2: Load the menu and confirm a clean start**

- `browser_navigate` to `file:///Users/mathias/work/wake-alone/dist/index.html`
- `browser_snapshot` -> confirm the salvage menu renders (`.title-screen`, episode cards).
- `browser_console_messages` -> Expected: no errors.

- [ ] **Step 3: Deep link -- clicking a card sets the hash**

- `browser_click` the first unlocked episode card (an `.epcard` without `.locked`).
- `browser_evaluate` `() => location.hash` -> Expected: a non-empty `#<id>` (the
  clicked episode's id).
- `browser_snapshot` -> confirm the play HUD renders (NEURAL INTEGRITY bar) and the
  footer shows the `> abort to salvage menu` button.

- [ ] **Step 4: Back returns to the menu**

- `browser_navigate_back`
- `browser_evaluate` `() => location.hash` -> Expected: empty string.
- `browser_snapshot` -> confirm `.title-screen` is shown again (not an external page).

- [ ] **Step 5: In-story abort link returns to the menu**

- `browser_navigate` to `file:///Users/mathias/work/wake-alone/dist/index.html#<id>`
  using the id observed in Step 3 (e.g. `...#derelict`).
- `browser_snapshot` -> confirm the episode plays (fresh: full neural integrity).
- `browser_click` the `> abort to salvage menu` button in the footer.
- `browser_evaluate` `() => location.hash` -> Expected: empty string.
- `browser_snapshot` -> confirm `.title-screen` is shown.

- [ ] **Step 6: Reload mid-episode starts it fresh**

- `browser_navigate` to `...#<id>`, then `browser_navigate` to the same URL again
  (forces a reload of the deep link).
- `browser_snapshot` -> confirm the episode renders from its start node at full
  neural integrity (no resume, as designed).
- `browser_console_messages` -> Expected: no errors across the session.

- [ ] **Step 7: Confirm the existing suite still passes**

Run: `npm test`
Expected: passes (solver fixtures unaffected by this UI change).

- [ ] **Step 8: Final commit (if the build changed)**

```bash
git add -A
git commit -m "chore: rebuild dist after hash-navigation work" --allow-empty
```

---

## Self-Review notes

- **Spec coverage:** Back-to-menu (Task 1 router + Task 2 hash start, verified Task 5
  Step 4); in-story exit control (Task 4, verified Step 5); shareable per-episode URLs
  (Task 2, verified Step 3); fresh-start-on-deep-link (no persistence; verified Step 6);
  `#lab` preserved and edge cases (locked/unknown/prod-lab -> menu) handled in `route()`.
- **No new types/functions are referenced before they are defined:** `route()` and
  `returnToMenu()` are created in Task 1, before Tasks 2-4 reference them.
- **`footer(showExit)`** is defined in Task 4 Step 2 and the only truthy caller is
  `render()` (Task 4 Step 3); all other call sites pass no argument.
