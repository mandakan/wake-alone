# Chaptered Adventures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement issue #3 phases 1+2 — manifest-grouped multi-chapter adventures with localStorage unlock progression and a bounded flag + ending-identity carryover, enforced by a new cross-chapter validation layer.

**Architecture:** The adventure contract lives in `episodes/manifest.json` (a new entry shape with a `chapters` array carrying `file`/`unlock`/`exports`/`imports`). Chapters are ordinary episode JSONs. The engine gains a `skein_progress_v1` localStorage store, a chapter-select screen, unlock gating in `route()`, and flag seeding in `startEpisode()`. A new `tools/adventure.mjs` validates the contract (solver-backed), wired into the whole-manifest pass of `tools/validate.mjs`; `tools/build.mjs` expands adventure entries into the inlined `EPISODES` array.

**Tech Stack:** Vanilla JS (zero-dependency node tools, single-file HTML engine). Tests are the repo's hand-rolled `check()` scripts run by `npm test`.

**Spec:** `docs/superpowers/specs/2026-06-11-chaptered-adventures-design.md`

---

## Context for the implementer

- **House style is ASCII-only** everywhere, including code comments: `--` never an em-dash, straight quotes, `...` not the ellipsis character. The prose linter hard-errors on non-ASCII punctuation in episode text.
- **Never weaken the validator to pass content.** New checks are added; existing ones are untouched.
- The engine (`engine/template.html`) is one file, compact style: `if(x) return y;`, no space after `if(`, 2-space indent, semicolons. Match it.
- The solver in `tools/validate.mjs` mirrors the engine runtime exactly (onEnter once, sanity clamp 0..100, instant madness at sanity <= 0 outside endings, med-gel free action). Keep that mirror true: every engine behavior added here (flag seeding) gets the same treatment in the solver (seed flags).
- `validate.mjs` and `adventure.mjs` will import from each other. This is safe: `solve` is a hoisted function declaration, and the CLI body of `validate.mjs` only runs `validateAdventure` long after both modules finish evaluating. Do not "fix" the cycle by duplicating code.
- After every task: `npm test && npm run validate` must exit 0. After build-touching tasks: `npm run build` too.
- Line numbers below are anchors as of commit `6780307`; verify against the actual text shown in each step (the `old_string` excerpts are exact).

### Manifest shapes (today + new)

Today's entry shapes in `episodes/manifest.json`: playable `{ "file": "x.json", "locked": false }`, locked placeholder `{ "id", "title", "byline", "locked": true }`, anomaly `{ "anomaly": true, "title", "byline" }` (anomalies must come last). New adventure shape:

```jsonc
{
  "adventure": "arc",                       // adventure id (slug, unique across all ids)
  "title": "ARC TITLE",
  "byline": "one line",
  "chapters": [
    { "file": "arc-one.json", "exports": ["saw_it"] },
    { "file": "arc-two.json", "unlock": "any", "imports": ["saw_it", "prior_escape"] }
  ]
}
```

Unlock forms: `"any"` (or omitted) | `{"ending": "<nodeId>"}` | `{"type": "escape"|"dead"|"madness"}` | `{"flag": "<exported flag>"}`. Reserved carried flags, derived from the previous chapter's recorded ending: `prior_escape`, `prior_dead`, `prior_madness`, `prior_end_<endingNodeId>`. Export cap: 4 per chapter.

### Recommended executor model per task

| Task | Model | Why |
|---|---|---|
| 1, 2 | sonnet | Small, fully-specified validator edits |
| 3, 4 | opus | Many interacting validation rules; judgment on message wording |
| 5, 6 | sonnet | Mechanical wiring, code given in full |
| 7, 8 | opus | Edits inside the 1k-line engine file; routing edge cases |
| 9 | sonnet | Playwright driving + cleanup |
| 10 | haiku | Docs only |

---

## File Structure

- Modify: `tools/validate.mjs` — export + extend `solve` (seed flags, ending-flag map), imports-aware `validateEpisode`, chapter discovery, whole-manifest adventure pass
- Create: `tools/adventure.mjs` — the cross-chapter contract: `parseUnlock`, `validateAdventure`, `EXPORT_CAP`
- Create: `tools/adventure.test.mjs` — fixture tests for the contract
- Modify: `tools/validate.test.mjs` — solver/imports test blocks
- Modify: `tools/build.mjs` — adventure expansion into `EPISODES`
- Modify: `engine/template.html` — progress store, unlock checks, flag seeding, adventure screen, menu card, routing
- Modify: `package.json` — add `adventure.test.mjs` to `npm test`
- Modify: `CLAUDE.md`, `README.md` — document the contract

---

### Task 1: Solver — seed flags + ending-flag map + export

**Files:**
- Modify: `tools/validate.mjs:377` (solve), `:410` (init), `:424-430` (collections), `:466-476` (ending record), `:492`, `:502` (madness points), `:509-515` (return), `:418-422` (startMadness return)
- Test: `tools/validate.test.mjs`

- [ ] **Step 1: Write the failing tests**

In `tools/validate.test.mjs`, change the first import line from
`import { validateEpisode } from "./validate.mjs";` to
`import { validateEpisode, solve } from "./validate.mjs";`
and append this block before the final summary/exit lines at the bottom of the file:

```js
// --- solver: seed flags + endingFlags (adventure carryover support) ---
{
  const ep = {
    id: "seed", title: "S", start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>h</p>", choices: [
        { text: "use the code", to: "out", requires: { flag: "code" }, locked: "no code" },
        { text: "mark the wall", to: "marked" },
        { text: "give up", to: "gone" },
      ]},
      marked: { text: "<p>m</p>", onEnter: { flags: { marked: true } }, choices: [{ text: "back", to: "hub" }] },
      out: { ending: { type: "escape", stamp: "// OUT", text: "<p>o</p>" } },
      gone: { ending: { type: "dead", stamp: "// GONE", text: "<p>g</p>" } },
    },
  };
  const dry = solve(ep);
  check("seed: unwinnable without seeded flag", dry.winnable === false);
  check("seed: endingFlags records the dead ending", dry.endingFlags instanceof Map && dry.endingFlags.has("gone"));
  check("seed: earned flag observable at an ending", [...dry.endingFlags.values()].some((s) => s.has("marked")));
  const wet = solve(ep, true, ["code"]);
  check("seed: winnable with seeded flag", wet.winnable === true);
  check("seed: seeded flag present at the escape ending", wet.endingFlags.has("out") && wet.endingFlags.get("out").has("code"));
}

// --- solver: madnessFlags records flags held when sanity hits 0 ---
{
  const ep = {
    id: "madflag", title: "M", start: "hub", startSanity: 10,
    nodes: {
      hub: { text: "<p>h</p>", choices: [
        { text: "take the token", to: "taken" },
        { text: "out", to: "out" },
      ]},
      taken: { text: "<p>t</p>", onEnter: { flags: { token: true } }, choices: [
        { text: "stare into it", to: "hub", effects: { sanity: -50 } },
      ]},
      out: { ending: { type: "escape", stamp: "// OUT", text: "<p>o</p>" } },
    },
  };
  const r = solve(ep);
  check("madflag: madness reachable", r.madnessReachable === true);
  check("madflag: flag held at the madness point is recorded", r.madnessFlags.has("token"));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tools/validate.test.mjs`
Expected: FAIL — `solve` is not exported (`solve is not a function` or import error).

- [ ] **Step 3: Implement**

In `tools/validate.mjs`:

a) Line 375-377 — export, new param, updated comment:

```js
// ---- the solver: mirrors engine/template.html runtime exactly ----
// useGel=false disables the med-gel free action (used by the L14 forced-loss measure).
// seedFlags pre-sets flags before the run starts -- the engine does the same for a
// chapter's imported carryover flags, so the solver must too (adventure contract).
export function solve(ep, useGel = true, seedFlags = []) {
```

b) Line 410 — seed the initial flags. Replace `flags: new Set(),` (inside the `init` literal) with:

```js
    flags: new Set(seedFlags),
```

c) Lines 418-422 — the startMadness early return gains the two new fields. Replace its return object's last line `nodeItems: new Map(), nodeMinSanity: new Map() };` with:

```js
      nodeItems: new Map(), nodeMinSanity: new Map(), endingFlags: new Map(), madnessFlags: new Set(init.flags) };
```

d) After line 428 (`const nodeMinSanity = new Map();  // ...`), add:

```js
  const endingFlags = new Map();    // endingNodeId -> union of flags held on arrival (carryover exportability)
  const madnessFlags = new Set();   // union of flags held at any sanity-0 point (madness also records progress)
```

e) Lines 466-475 — record flags at every reached ending node. The block currently reads:

```js
    if (node.ending) {
      if (node.ending.type === "escape") {
```

Insert between those two lines:

```js
      if (!endingFlags.has(st.cur)) endingFlags.set(st.cur, new Set());
      const ef = endingFlags.get(st.cur);
      for (const f of st.flags) ef.add(f);
```

f) Line 492 — madness on choice effects. Replace
`if (afterChoice.sanity <= 0) { madnessReachable = true; return; } // choose(): madness before goto`
with:

```js
      if (afterChoice.sanity <= 0) { madnessReachable = true; afterChoice.flags.forEach((f) => madnessFlags.add(f)); return; } // choose(): madness before goto
```

g) Line 502 — madness on entry. Replace
`if (sanity <= 0 && !target.ending) { madnessReachable = true; return; } // goto(): madness on entry`
with:

```js
      if (sanity <= 0 && !target.ending) { madnessReachable = true; flags.forEach((f) => madnessFlags.add(f)); return; } // goto(): madness on entry
```

h) Lines 509-515 — the normal return gains the fields. Replace `nodeItems, nodeMinSanity,` with:

```js
    nodeItems, nodeMinSanity, endingFlags, madnessFlags,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run validate`
Expected: all checks pass, every episode still validates (exit 0).

- [ ] **Step 5: Commit**

```bash
git add tools/validate.mjs tools/validate.test.mjs
git commit -m "feat(validate): solver seed flags + per-ending flag map for adventure carryover"
```

---

### Task 2: Imports-aware `validateEpisode`

A chapter must validate standalone without false positives on flags its imports provide: no "requires flag that is never set" error, no dead-choice warn on import-gated choices, no dead-flag warn for the imports themselves (the dead-import warn belongs to `adventure.mjs`, Task 4, with a clearer message).

**Files:**
- Modify: `tools/validate.mjs:68` (signature), `:108-119` (flag universe), `:273-275` (dead-choice warn), `:336-338` (dead-flag warn)
- Test: `tools/validate.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tools/validate.test.mjs` (before the summary):

```js
// --- imports-aware validateEpisode: carried flags are obtainable, not dead ---
{
  const ep = {
    id: "carry", title: "C", start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>h</p>", onEnter: { sanity: -25 }, choices: [
        { text: "remember the door code", to: "annex", requires: { flag: "prior_escape" }, locked: "you do not remember" },
        { text: "pry the hatch", to: "out" },
        { text: "slip", to: "d1" },
        { text: "fall", to: "d2" },
      ]},
      annex: { text: "<p>a</p>", choices: [{ text: "back", to: "hub" }] },
      out: escape(), d1: dead("// D1"), d2: dead("// D2"),
    },
  };
  const bare = validateEpisode(ep);
  check("carry: without imports the gate flag errors as never-set", hasErr(bare, 'requires flag "prior_escape"'));
  const r = validateEpisode(ep, ep.id, { imports: ["prior_escape"] });
  check("carry: with imports, ok", r.ok, r.errors.join("; "));
  check("carry: no dead-choice warn for the import gate", !hasWarn(r, "choice[0]"), r.warnings.join("; "));
  check("carry: no dead-flag warn for the import", !hasWarn(r, '"prior_escape"'), r.warnings.join("; "));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tools/validate.test.mjs`
Expected: FAIL on "carry: with imports, ok" (the third argument is currently ignored, so the never-set error still fires).

- [ ] **Step 3: Implement**

In `tools/validate.mjs`:

a) Line 68 — signature:

```js
export function validateEpisode(ep, name = ep && ep.id, opts = {}) {
```

b) After the items/flags collection loop (after line 119, `}` closing `for (const n of Object.values(ep.nodes)) {...}`), add:

```js
  // flags carried in from a previous chapter (adventure contract): obtainable
  // here without being set here. adventure.mjs verifies the other side.
  const imports = Array.isArray(opts.imports) ? opts.imports : [];
  imports.forEach((f) => flags.add(f));
```

c) Line 273-275 — suppress the dead-choice warn when the gate reads an imported flag (the solver runs imports-off here, so such gates legitimately never open). Replace:

```js
        if (!solver.truncated && c.requires && reached.has(id) && !openable) {
          W(`node "${id}" choice[${i}]: requires never met in any reachable state (dead choice)`);
        }
```

with:

```js
        const importGated = c.requires && ((c.requires.flag && imports.includes(c.requires.flag)) || (c.requires.notFlag && imports.includes(c.requires.notFlag)));
        if (!solver.truncated && c.requires && reached.has(id) && !openable && !importGated) {
          W(`node "${id}" choice[${i}]: requires never met in any reachable state (dead choice)`);
        }
```

d) Lines 336-338 — skip imports in the dead-flag warn. Replace:

```js
  for (const fl of flags) {
    if (!reqFlags.has(fl)) W(`flag "${fl}" is set but never read by any gate (dead flag?)`);
  }
```

with:

```js
  for (const fl of flags) {
    if (imports.includes(fl)) continue; // carried in; adventure.mjs warns about unread imports
    if (!reqFlags.has(fl)) W(`flag "${fl}" is set but never read by any gate (dead flag?)`);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run validate`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/validate.mjs tools/validate.test.mjs
git commit -m "feat(validate): accept declared chapter imports as obtainable flags"
```

---

### Task 3: `tools/adventure.mjs` — contract module, structural checks

**Files:**
- Create: `tools/adventure.mjs`
- Create: `tools/adventure.test.mjs`
- Modify: `package.json:10` (test script)

- [ ] **Step 1: Write the failing tests**

Create `tools/adventure.test.mjs`:

```js
#!/usr/bin/env node
// adventure.test.mjs -- self-tests for the cross-chapter adventure contract.
// Same zero-dep pattern as validate.test.mjs. Run: node tools/adventure.test.mjs

import { validateAdventure, parseUnlock, EXPORT_CAP } from "./adventure.mjs";

let passed = 0, failed = 0;
const C = { red:"\x1b[31m", green:"\x1b[32m", dim:"\x1b[2m", reset:"\x1b[0m" };

function check(label, cond, detail = "") {
  if (cond) { passed++; }
  else { failed++; console.log(`  ${C.red}FAIL${C.reset} ${label}${detail ? `  ${C.dim}${detail}${C.reset}` : ""}`); }
}
const hasErr  = (r, s) => r.errors.some((m) => m.includes(s));
const hasWarn = (r, s) => r.warnings.some((m) => m.includes(s));

// A small valid chapter. opts.setsFlag adds a flag-setting side room; opts.importGate
// adds a choice gated on a carried flag (and a payoff room behind it).
function chEp(id, opts = {}) {
  const hubChoices = [
    { text: "take it", to: "take" },
    { text: "leave", to: "out" },
    { text: "trip", to: "d1" },
    { text: "freeze", to: "d2" },
  ];
  const nodes = {
    hub: { text: "<p>h</p>", onEnter: { sanity: -25 }, choices: hubChoices },
    take: { text: "<p>t</p>", onEnter: { flags: { [opts.setsFlag || "took"]: true } }, choices: [{ text: "back", to: "hub" }] },
    out: { ending: { type: "escape", stamp: "// OUT", text: "<p>o</p>" } },
    d1: { ending: { type: "dead", stamp: "// D1", text: "<p>d</p>" } },
    d2: { ending: { type: "dead", stamp: "// D2", text: "<p>d</p>" } },
  };
  if (opts.importGate) {
    hubChoices.push({ text: "remember", to: "annex", requires: { flag: opts.importGate }, locked: "no" });
    nodes.annex = { text: "<p>a</p>", choices: [{ text: "back", to: "hub" }] };
  }
  return { id, title: id.toUpperCase(), start: "hub", startSanity: 100, nodes };
}
// Bind declarations to parsed chapter episodes the way the CLI does.
function pack(decls, eps) { return decls.map((decl, i) => ({ decl, ep: eps[i] })); }

// --- parseUnlock unit checks ---
{
  check("unlock: omitted is any", parseUnlock(undefined).kind === "any");
  check("unlock: literal any", parseUnlock("any").kind === "any");
  check("unlock: ending form", parseUnlock({ ending: "out" }).kind === "ending");
  check("unlock: type form", parseUnlock({ type: "escape" }).kind === "type");
  check("unlock: flag form", parseUnlock({ flag: "took" }).kind === "flag");
  check("unlock: bad type rejected", !!parseUnlock({ type: "victory" }).error);
  check("unlock: junk rejected", !!parseUnlock({ endings: ["out"] }).error);
  check("unlock: string junk rejected", !!parseUnlock("always").error);
}

// --- clean two-chapter adventure passes ---
{
  const decls = [
    { file: "a1.json", exports: ["took"] },
    { file: "a2.json", unlock: "any", imports: ["took", "prior_escape"] },
  ];
  const eps = [chEp("a1", { setsFlag: "took" }), chEp("a2", { importGate: "took" })];
  const entry = { adventure: "arc", title: "ARC", byline: "b", chapters: decls };
  const r = validateAdventure(entry, pack(decls, eps));
  check("clean: no errors", r.errors.length === 0, r.errors.join("; "));
}

// --- structural errors ---
{
  const one = { adventure: "solo", title: "S", chapters: [{ file: "a1.json" }] };
  const r1 = validateAdventure(one, pack(one.chapters, [chEp("a1")]));
  check("structure: fewer than 2 chapters", hasErr(r1, "at least 2 chapters"));

  const decls2 = [{ file: "a1.json", unlock: "any" }, { file: "a2.json" }];
  const e2 = { adventure: "arc", title: "ARC", chapters: decls2 };
  const r2 = validateAdventure(e2, pack(decls2, [chEp("a1"), chEp("a2")]));
  check("structure: unlock on chapter 1", hasErr(r2, "chapter 1"));

  const decls3 = [{ file: "a1.json" }, { file: "missing.json" }];
  const e3 = { adventure: "arc", title: "ARC", chapters: decls3 };
  const r3 = validateAdventure(e3, pack(decls3, [chEp("a1"), null]));
  check("structure: unreadable chapter file", hasErr(r3, "missing.json"));

  const noTitle = { adventure: "arc", chapters: [{ file: "a1.json" }, { file: "a2.json" }] };
  const r4 = validateAdventure(noTitle, pack(noTitle.chapters, [chEp("a1"), chEp("a2")]));
  check("structure: missing title", hasErr(r4, "title"));
}

// --- export rules ---
{
  const decls = [
    { file: "a1.json", exports: ["f1", "f2", "f3", "f4", "f5"] },
    { file: "a2.json", imports: ["f1"] },
  ];
  const entry = { adventure: "arc", title: "ARC", chapters: decls };
  const r = validateAdventure(entry, pack(decls, [chEp("a1"), chEp("a2")]));
  check("exports: cap enforced", hasErr(r, `${EXPORT_CAP}`));

  const decls2 = [{ file: "a1.json", exports: ["prior_escape"] }, { file: "a2.json" }];
  const e2 = { adventure: "arc", title: "ARC", chapters: decls2 };
  const r2 = validateAdventure(e2, pack(decls2, [chEp("a1"), chEp("a2")]));
  check("exports: prior_ namespace reserved", hasErr(r2, "reserved"));
}

// --- import rules ---
{
  const decls = [
    { file: "a1.json", exports: ["took"] },
    { file: "a2.json", imports: ["never_exported"] },
  ];
  const entry = { adventure: "arc", title: "ARC", chapters: decls };
  const r = validateAdventure(entry, pack(decls, [chEp("a1", { setsFlag: "took" }), chEp("a2")]));
  check("imports: must be exported by the previous chapter", hasErr(r, "never_exported"));

  const decls2 = [{ file: "a1.json" }, { file: "a2.json", imports: ["prior_end_nowhere"] }];
  const e2 = { adventure: "arc", title: "ARC", chapters: decls2 };
  const r2 = validateAdventure(e2, pack(decls2, [chEp("a1"), chEp("a2")]));
  check("imports: prior_end_ must name a real ending of the previous chapter", hasErr(r2, "prior_end_nowhere"));

  const decls3 = [{ file: "a1.json" }, { file: "a2.json", imports: ["prior_end_out"] }];
  const e3 = { adventure: "arc", title: "ARC", chapters: decls3 };
  const r3 = validateAdventure(e3, pack(decls3, [chEp("a1"), chEp("a2", { importGate: "prior_end_out" })]));
  check("imports: prior_end_<real ending> accepted", !hasErr(r3, "prior_end_out"), r3.errors.join("; "));
}

console.log(`\n${failed ? C.red : C.green}adventure: ${passed} passed, ${failed} failed${C.reset}\n`);
process.exit(failed ? 1 : 0);
```

In `package.json`, change the test script to:

```json
    "test": "node tools/validate.test.mjs && node tools/diversity.test.mjs && node tools/adventure.test.mjs",
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tools/adventure.test.mjs`
Expected: FAIL — cannot find module `./adventure.mjs`.

- [ ] **Step 3: Implement the structural half**

Create `tools/adventure.mjs`:

```js
#!/usr/bin/env node
// adventure.mjs -- the cross-chapter contract for chaptered adventures, in one
// place (the spec.mjs pattern: the validator enforces what the manifest declares).
//
// An adventure is a manifest entry that groups ordered chapters (each an ordinary
// episode JSON). Later chapters unlock from the previous chapter's recorded
// completion; a bounded flag set plus the ending's identity carries forward.
//
// Carried-flag universe a chapter may import: the previous chapter's `exports`
// (cap EXPORT_CAP), plus the reserved ending-identity flags the engine derives:
//   prior_escape / prior_dead / prior_madness / prior_end_<endingNodeId>
//
// Hard rule: imports may only gate optional beats. Every chapter still has to
// pass validateEpisode standalone (imports treated as obtainable but the solver
// runs imports-off), so a player whose previous run exported nothing is never
// soft-locked. The checks here cover the other side of the contract.

import { solve } from "./validate.mjs"; // safe cycle: solve is a hoisted function declaration

export const EXPORT_CAP = 4;
const PRIOR_FIXED = ["prior_escape", "prior_dead", "prior_madness"];
const ENDING_TYPES = ["escape", "dead", "madness"];

// Resolve an unlock declaration into {kind, value} or {error}.
export function parseUnlock(u) {
  if (u === undefined || u === "any") return { kind: "any" };
  if (typeof u === "object" && u !== null && Object.keys(u).length === 1) {
    if (typeof u.ending === "string") return { kind: "ending", value: u.ending };
    if (typeof u.type === "string") {
      if (!ENDING_TYPES.includes(u.type)) return { error: `unknown unlock type "${u.type}" (use ${ENDING_TYPES.join("/")})` };
      return { kind: "type", value: u.type };
    }
    if (typeof u.flag === "string") return { kind: "flag", value: u.flag };
  }
  return { error: `unknown unlock form ${JSON.stringify(u)} (use "any", {"ending":"nodeId"}, {"type":"escape|dead|madness"}, or {"flag":"name"})` };
}

// entry: the manifest adventure object. chapters: [{ decl, ep }] aligned with
// entry.chapters, ep = parsed episode JSON or null when the file was unreadable.
export function validateAdventure(entry, chapters) {
  const errors = [];
  const warnings = [];
  const id = entry.adventure || "?";
  const E = (m) => errors.push(`adventure "${id}": ${m}`);
  const W = (m) => warnings.push(`adventure "${id}": ${m}`);

  if (typeof entry.adventure !== "string" || !entry.adventure) E(`missing "adventure" id`);
  if (typeof entry.title !== "string" || !entry.title) E(`missing "title"`);
  const decls = Array.isArray(entry.chapters) ? entry.chapters : [];
  if (decls.length < 2) { E(`needs at least 2 chapters (got ${decls.length})`); return { errors, warnings }; }

  // per-chapter shape
  chapters.forEach(({ decl, ep }, i) => {
    const ch = `chapter ${i + 1}`;
    if (!decl.file) E(`${ch}: missing "file"`);
    else if (!ep) E(`${ch}: cannot read episode file "${decl.file}"`);
    if (i === 0 && (decl.unlock !== undefined || decl.imports !== undefined))
      E(`chapter 1 is always unlocked and imports nothing -- remove "unlock"/"imports"`);
    const u = parseUnlock(decl.unlock);
    if (u.error) E(`${ch}: ${u.error}`);
    const exports = decl.exports ?? [];
    if (!Array.isArray(exports) || exports.some((f) => typeof f !== "string")) E(`${ch}: "exports" must be an array of flag names`);
    else {
      if (exports.length > EXPORT_CAP) E(`${ch}: ${exports.length} exports exceed the cap of ${EXPORT_CAP} -- the carry set stays small so authoring and validation stay tractable`);
      exports.forEach((f) => { if (f.startsWith("prior_")) E(`${ch}: export "${f}" uses the reserved prior_ namespace (the engine derives those)`); });
    }
    const imports = decl.imports ?? [];
    if (!Array.isArray(imports) || imports.some((f) => typeof f !== "string")) E(`${ch}: "imports" must be an array of flag names`);
  });

  // cross-chapter contract (only meaningful where both sides parsed)
  const solved = chapters.map(({ decl, ep }) => {
    if (!ep || !ep.nodes || !ep.nodes[ep.start]) return null;
    try { return solve(ep, true, Array.isArray(decl.imports) ? decl.imports : []); } catch { return null; }
  });

  for (let i = 1; i < chapters.length; i++) {
    const ch = `chapter ${i + 1}`;
    const prev = chapters[i - 1];
    const prevSolve = solved[i - 1];
    const prevExports = Array.isArray(prev.decl.exports) ? prev.decl.exports : [];
    const prevEndings = prev.ep ? Object.keys(prev.ep.nodes || {}).filter((n) => prev.ep.nodes[n].ending) : [];
    const reachableEndings = prevSolve ? new Set(prevSolve.endingFlags.keys()) : null;

    const okPriorEnd = (f) => {
      const node = f.slice("prior_end_".length);
      if (!prev.ep) return true; // file error already reported
      if (!prevEndings.includes(node)) { E(`${ch}: import "${f}" names "${node}", which is not an ending node of the previous chapter`); return false; }
      if (reachableEndings && !reachableEndings.has(node)) { E(`${ch}: import "${f}": ending "${node}" is never reachable in the previous chapter`); return false; }
      return true;
    };

    for (const f of (Array.isArray(chapters[i].decl.imports) ? chapters[i].decl.imports : [])) {
      if (PRIOR_FIXED.includes(f)) continue;
      if (f.startsWith("prior_end_")) { okPriorEnd(f); continue; }
      if (!prevExports.includes(f)) E(`${ch}: import "${f}" is not exported by the previous chapter (exports: ${prevExports.join(", ") || "none"})`);
    }

    const u = parseUnlock(chapters[i].decl.unlock);
    if (!u.error) {
      if (u.kind === "ending" && prev.ep) {
        if (!prevEndings.includes(u.value)) E(`${ch}: unlock ending "${u.value}" is not an ending node of the previous chapter`);
        else if (reachableEndings && !reachableEndings.has(u.value)) E(`${ch}: unlock ending "${u.value}" is never reachable in the previous chapter`);
      }
      if (u.kind === "type" && u.value === "escape" && prev.ep && prev.ep.spec && prev.ep.spec.escape === "forbidden")
        E(`${ch}: unlock {"type":"escape"} after a chapter declared spec.escape="forbidden" can never fire`);
      if (u.kind === "flag" && !prevExports.includes(u.value))
        E(`${ch}: unlock flag "${u.value}" is not in the previous chapter's exports`);
    }
  }

  return { errors, warnings };
}
```

- [ ] **Step 4: Run tests to verify the structural checks pass**

Run: `npm test`
Expected: all `parseUnlock`, structure, export, and import checks pass. (Task 4 adds the solver-backed exportability/dead-carry checks; no test asserts them yet.)

- [ ] **Step 5: Commit**

```bash
git add tools/adventure.mjs tools/adventure.test.mjs package.json
git commit -m "feat(adventure): cross-chapter contract module with structural checks"
```

---

### Task 4: Solver-backed exportability + carryover warns

**Files:**
- Modify: `tools/adventure.mjs`
- Test: `tools/adventure.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tools/adventure.test.mjs` before the summary lines:

```js
// --- solver-backed: an export that can never be set at any reachable ending ---
{
  const decls = [{ file: "a1.json", exports: ["ghost"] }, { file: "a2.json", imports: ["ghost"] }];
  const entry = { adventure: "arc", title: "ARC", chapters: decls };
  const r = validateAdventure(entry, pack(decls, [chEp("a1", { setsFlag: "took" }), chEp("a2", { importGate: "ghost" })]));
  check("exportability: unsettable export errors", hasErr(r, '"ghost"'), r.errors.join("; "));
}

// --- warns: dead export (nothing downstream reads it) ---
{
  const decls = [{ file: "a1.json", exports: ["took"] }, { file: "a2.json" }];
  const entry = { adventure: "arc", title: "ARC", chapters: decls };
  const r = validateAdventure(entry, pack(decls, [chEp("a1", { setsFlag: "took" }), chEp("a2")]));
  check("warns: dead export", hasWarn(r, 'export "took"'), r.warnings.join("; "));
  check("warns: dead export is not an error", r.errors.length === 0, r.errors.join("; "));
}

// --- warns: dead import (no gate in the chapter reads it) ---
{
  const decls = [{ file: "a1.json", exports: ["took"] }, { file: "a2.json", imports: ["took"] }];
  const entry = { adventure: "arc", title: "ARC", chapters: decls };
  const r = validateAdventure(entry, pack(decls, [chEp("a1", { setsFlag: "took" }), chEp("a2")]));
  check("warns: dead import", hasWarn(r, 'import "took"'), r.warnings.join("; "));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tools/adventure.test.mjs`
Expected: the three new checks FAIL (no such errors/warnings yet).

- [ ] **Step 3: Implement**

In `tools/adventure.mjs`, append inside `validateAdventure` just before the final `return { errors, warnings };`:

```js
  // exportability: a declared export the chapter can never have set when a run
  // ends (any ending or a madness collapse -- the engine records progress at
  // both) is a contract the engine can never fulfil.
  chapters.forEach(({ decl }, i) => {
    const s = solved[i];
    if (!s || s.truncated) return;
    const exportable = new Set(s.madnessFlags);
    for (const set of s.endingFlags.values()) for (const f of set) exportable.add(f);
    for (const f of (Array.isArray(decl.exports) ? decl.exports : [])) {
      if (!f.startsWith("prior_") && !exportable.has(f))
        E(`chapter ${i + 1}: export "${f}" can never be set when any reachable ending is recorded`);
    }
  });

  // dead export: nothing downstream (next chapter's imports or unlock flag) reads it.
  for (let i = 0; i < chapters.length; i++) {
    const next = chapters[i + 1];
    const nextImports = next && Array.isArray(next.decl.imports) ? next.decl.imports : [];
    const nextUnlock = next ? parseUnlock(next.decl.unlock) : null;
    for (const f of (Array.isArray(chapters[i].decl.exports) ? chapters[i].decl.exports : [])) {
      const read = nextImports.includes(f) || (nextUnlock && nextUnlock.kind === "flag" && nextUnlock.value === f);
      if (!read) W(`chapter ${i + 1}: export "${f}" is never imported or read by an unlock downstream (dead export?)`);
    }
  }

  // dead import: no requires gate in the chapter reads the carried flag.
  chapters.forEach(({ decl, ep }, i) => {
    if (!ep || !ep.nodes) return;
    const readFlags = new Set();
    for (const node of Object.values(ep.nodes)) {
      for (const c of (node.choices || [])) {
        if (c.requires && c.requires.flag) readFlags.add(c.requires.flag);
        if (c.requires && c.requires.notFlag) readFlags.add(c.requires.notFlag);
      }
    }
    for (const f of (Array.isArray(decl.imports) ? decl.imports : [])) {
      if (!readFlags.has(f)) W(`chapter ${i + 1}: import "${f}" is never read by any gate in the chapter (dead import?)`);
    }
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run validate`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/adventure.mjs tools/adventure.test.mjs
git commit -m "feat(adventure): solver-backed exportability check + dead export/import warns"
```

---

### Task 5: CLI wiring — chapter discovery, manifest adventure pass, id uniqueness

**Files:**
- Modify: `tools/validate.mjs:31-37` (imports), `:544-549` (loadEpisodeFiles), `:566-630` (CLI)

- [ ] **Step 1: Implement (CLI plumbing; verified by running the CLI, not unit tests)**

a) Add to the imports at the top of `tools/validate.mjs` (after line 37):

```js
import { validateAdventure } from "./adventure.mjs"; // safe cycle: only the CLI body calls it
```

b) Replace `loadEpisodeFiles` (lines 544-549) — adventure chapters join discovery, carrying their imports:

```js
function loadEpisodeFiles() {
  const manifest = JSON.parse(readFileSync(join(EPISODES_DIR, "manifest.json"), "utf8"));
  const targets = [];
  for (const e of manifest.episodes) {
    if (e.adventure) {
      for (const ch of e.chapters || []) if (ch.file) targets.push({ file: join(EPISODES_DIR, ch.file), imports: ch.imports || [] });
      continue;
    }
    if (!e.locked && e.file) targets.push({ file: join(EPISODES_DIR, e.file), imports: [] });
  }
  return targets;
}

// A single-file run on an adventure chapter should still know its imports, or it
// would emit false "flag never set" errors. Look the file up in the manifest.
function importsFromManifest(file) {
  try {
    const manifest = JSON.parse(readFileSync(join(EPISODES_DIR, "manifest.json"), "utf8"));
    const base = file.split(/[\\/]/).pop();
    for (const e of manifest.episodes || []) {
      if (!e.adventure) continue;
      for (const ch of e.chapters || []) if (ch.file === base) return ch.imports || [];
    }
  } catch { /* no manifest (fixtures); imports stay empty */ }
  return [];
}
```

c) Add the manifest adventure pass next to `checkManifestOrder` (after line 564):

```js
// Whole-manifest adventure pass: validate every adventure entry's cross-chapter
// contract, and enforce id uniqueness across the whole bundle -- routing is by
// id, so episode ids, adventure ids, and chapter ids share one namespace.
function checkManifestAdventures() {
  const manifest = JSON.parse(readFileSync(join(EPISODES_DIR, "manifest.json"), "utf8"));
  const errors = [];
  const warnings = [];
  const ids = new Map(); // id -> where it was claimed
  const claim = (id, where) => {
    if (!id) return;
    if (ids.has(id)) errors.push(`duplicate id "${id}" (${ids.get(id)} vs ${where}) -- routing is by id; every episode, adventure, and chapter id must be unique`);
    else ids.set(id, where);
  };
  for (const e of manifest.episodes || []) {
    if (e.anomaly) continue;
    if (e.adventure) {
      claim(e.adventure, `adventure entry`);
      const chapters = (e.chapters || []).map((decl, i) => {
        let ep = null;
        if (decl.file) { try { ep = JSON.parse(readFileSync(join(EPISODES_DIR, decl.file), "utf8")); } catch { /* reported by validateAdventure */ } }
        if (ep) claim(ep.id, `adventure "${e.adventure}" chapter ${i + 1}`);
        return { decl, ep };
      });
      const r = validateAdventure(e, chapters);
      errors.push(...r.errors);
      warnings.push(...r.warnings);
      continue;
    }
    if (e.locked) { claim(e.id, "locked placeholder"); continue; }
    if (e.file) { try { claim(JSON.parse(readFileSync(join(EPISODES_DIR, e.file), "utf8")).id, e.file); } catch { /* invalid JSON reported per-episode */ } }
  }
  return { errors, warnings };
}
```

d) CLI: the targets list becomes `{file, imports}` objects. Replace line 572:

```js
  const targets = files.length ? files.map((f) => ({ file: f, imports: importsFromManifest(f) })) : loadEpisodeFiles();
```

and inside the loop (lines 580-595), replace `for (const f of targets) {` ... with the object form — the loop body becomes:

```js
  for (const t of targets) {
    let ep;
    try { ep = JSON.parse(readFileSync(t.file, "utf8")); }
    catch (err) {
      failed++;
      const r = { name: t.file, errors: [`invalid JSON: ${err.message}`], warnings: [], report: null, ok: false };
      results.push(r);
      if (!jsonMode) printResult(r);
      continue;
    }
    parsedEps.push(ep);
    const r = validateEpisode(ep, ep.id || t.file, { imports: t.imports });
    results.push(r);
    if (!jsonMode) printResult(r);
    if (!r.ok) failed++;
  }
```

e) Run the adventure pass alongside the order check. After line 600-602 (`manifestErrors = checkManifestOrder();`), extend:

```js
  let adventureErrors = [];
  let adventureWarnings = [];
  if (files.length === 0) {
    const a = checkManifestAdventures();
    adventureErrors = a.errors;
    adventureWarnings = a.warnings;
  }
```

f) Report + exit code. In the `jsonMode` branch (after the manifest-order push at lines 613-614), add:

```js
    if (adventureErrors.length || adventureWarnings.length)
      results.push({ name: "(adventures)", errors: adventureErrors, warnings: adventureWarnings, report: null, ok: adventureErrors.length === 0 });
```

In the non-json branch (after the manifest-order print at lines 619-622), add:

```js
    if (adventureErrors.length || adventureWarnings.length) {
      console.log(`\n${C.bold}adventures${C.reset}`);
      adventureErrors.forEach((m) => console.log(`  ${C.red}ERROR${C.reset} ${m}`));
      adventureWarnings.forEach((m) => console.log(`  ${C.yellow}warn ${C.reset} ${m}`));
    }
```

And the exit line 629 becomes:

```js
  process.exit((failed || manifestErrors.length || adventureErrors.length) ? 1 : 0);
```

- [ ] **Step 2: Verify**

Run: `npm test && npm run validate && node tools/validate.mjs episodes/derelict.json`
Expected: all exit 0; the single-file run output is unchanged from before this task.

- [ ] **Step 3: Commit**

```bash
git add tools/validate.mjs
git commit -m "feat(validate): adventure chapters in discovery + whole-manifest contract pass"
```

---

### Task 6: Build — expand adventure entries into the bundle

**Files:**
- Modify: `tools/build.mjs:21-43`

- [ ] **Step 1: Implement**

In the manifest loop of `tools/build.mjs`, insert a branch after the `anomaly` branch (after line 29) and before the normal-entry read at line 30:

```js
  if (entry.adventure) {
    const chapters = [];
    for (const ch of entry.chapters || []) {
      const ep = JSON.parse(readFileSync(join(EP_DIR, ch.file), "utf8"));
      const r = validateEpisode(ep, ep.id, { imports: ch.imports || [] });
      if (!r.ok) {
        hadError = true;
        console.log(`${C.red}FAIL${C.reset} ${ep.id}`);
        r.errors.forEach((m) => console.log(`  ${C.red}ERROR${C.reset} ${m}`));
      } else {
        console.log(`${C.green}ok${C.reset}   ${ep.id} ${C.dim}(${r.report.nodes} nodes, endings: ${r.report.endings.join("/")}, ${entry.adventure} ch${chapters.length + 1})${C.reset}`);
        r.report.items.forEach((i) => usedItems.add(i));
      }
      delete ep.spec;
      delete ep.character;
      chapters.push({ unlock: ch.unlock, exports: ch.exports || [], imports: ch.imports || [], ...ep });
    }
    episodes.push({ adventure: true, id: entry.adventure, title: entry.title || "ADVENTURE", byline: entry.byline || "", chapters });
    continue;
  }
```

Note: the cross-chapter contract itself is enforced by `npm run validate` (the CI gate runs it before build), matching how the manifest-order check is validate-only today.

- [ ] **Step 2: Verify (no adventures in the real manifest yet — output must be unchanged)**

Run: `npm run build`
Expected: builds `dist/index.html`, same playable-episode count as before.

- [ ] **Step 3: Commit**

```bash
git add tools/build.mjs
git commit -m "feat(build): inline adventure entries with per-chapter carryover metadata"
```

---

### Task 7: Engine part A — progress store, unlock checks, carryover seeding

No unit harness exists for the engine; Task 9 verifies in-browser. Keep the solver mirror exact: seeding happens before the start node's `onEnter`, same as `solve(ep, useGel, seedFlags)`.

**Files:**
- Modify: `engine/template.html:487-494` (startEpisode), `:736-738` (renderEnding), `:761-762` (renderMadness), `:792-799` (after the scar block), `:801-802` (titleScreen reset)

- [ ] **Step 1: Add the progress store + unlock helpers**

After the scar block (the lines ending `localStorage.setItem(SCAR_KEY, JSON.stringify(s)); }catch(e){}` and the closing `}` at line 799), insert:

```js

/* ---- 06 THE RECORD KEEPS: adventure progress + cross-chapter carryover.
   skein_progress_v1: { advId: { chapterId: { type, node, flags:[...] } } }.
   Completion (any ending, madness included) records the ending's identity and
   which declared exports the run actually set; the next chapter imports from
   that record. Purge clears one adventure's record only. ---- */
const PROG_KEY="skein_progress_v1";
let advCtx=null; // {adv, idx} while a chapter is playing; null otherwise
function loadProgress(){ try{ return JSON.parse(localStorage.getItem(PROG_KEY)||"{}"); }catch(e){ return {}; } }
function recordProgress(type, node){
  if(!advCtx || !episode) return;
  try{ const p=loadProgress();
    (p[advCtx.adv.id]=p[advCtx.adv.id]||{})[episode.id]={ type, node,
      flags:(episode.exports||[]).filter(f=>state && state.flags[f]) };
    localStorage.setItem(PROG_KEY, JSON.stringify(p)); }catch(e){}
}
function priorRecord(adv, idx){
  if(idx<=0) return null;
  return (loadProgress()[adv.id]||{})[adv.chapters[idx-1].id]||null;
}
function carriedFlags(adv, idx){
  const rec=priorRecord(adv, idx);
  if(!rec) return null;
  const set=new Set(rec.flags||[]);
  set.add("prior_"+rec.type);
  if(rec.node) set.add("prior_end_"+rec.node);
  return set;
}
function chapterUnlocked(adv, idx){
  if(idx===0) return true;
  const rec=priorRecord(adv, idx);
  if(!rec) return false;
  const u=adv.chapters[idx].unlock;
  if(u===undefined || u==="any") return true;
  if(u.ending) return rec.node===u.ending;
  if(u.type) return rec.type===u.type;
  if(u.flag) return (rec.flags||[]).includes(u.flag);
  return false;
}
```

- [ ] **Step 2: Seed imports in startEpisode**

Replace the `startEpisode` function (lines 487-494):

```js
function startEpisode(ep, advInfo){
  stopAnomalyChurn();
  episode=ep; advCtx=advInfo||null;
  state={ sanity: ep.startSanity??100, inventory:[...(ep.startInventory||[])], flags:{}, entered:{}, current: ep.start };
  if(advCtx){
    const carried=carriedFlags(advCtx.adv, advCtx.idx);
    if(carried) for(const f of (ep.imports||[])) if(carried.has(f)) state.flags[f]=true;
  }
  html.classList.remove("crush","madness");
  if(AUDIO) AUDIO.wake();
  goto(ep.start); scrollTop(false);
}
```

- [ ] **Step 3: Record completion at both ending funnels**

In `renderEnding` (line 737), change
`clearWatch(); recordScar(end.type, end.stamp);`
to:

```js
  clearWatch(); recordScar(end.type, end.stamp); recordProgress(end.type, state.current);
```

In `renderMadness` (line 762), change
`clearWatch(); recordScar("madness","// COHERENCE LOST");`
to:

```js
  clearWatch(); recordScar("madness","// COHERENCE LOST"); recordProgress("madness", state.current);
```

- [ ] **Step 4: Reset advCtx when leaving for the menu**

In `titleScreen` (line 802), change
`episode=null; state=null; clearWatch();`
to:

```js
  episode=null; state=null; advCtx=null; clearWatch();
```

- [ ] **Step 5: Verify + commit**

Run: `npm run build` (template must still parse and build; nothing user-visible changes yet — no adventure exists in the manifest).

```bash
git add engine/template.html
git commit -m "feat(engine): adventure progress store, unlock checks, carryover seeding"
```

---

### Task 8: Engine part B — adventure screen, menu card, routing, purge

**Files:**
- Modify: `engine/template.html` — titleScreen card loop (`:810-822`), route (`:1029-1039`), returnToMenu (`:1039`), new `adventureScreen`/`purgeAdventure` functions after `titleScreen`'s helpers

- [ ] **Step 1: Menu card for adventures**

In the `titleScreen` card loop, after the anomaly branch and the `epNo++` / `const n = ...` lines (813-814), insert the adventure branch before the `if(ep.locked)` branch:

```js
    if(ep.adventure){
      const prog=loadProgress()[ep.id]||{};
      const done=ep.chapters.filter(c=>prog[c.id]).length;
      return `<div class="epcard" data-ep="${esc(ep.id)}" onclick="location.hash=this.dataset.ep">
        <div class="epn">${n} // MULTIPART // ${done}/${ep.chapters.length} RECOVERED</div>
        <div class="ept">${ep.title}</div><div class="epb">${ep.byline||""}</div></div>`;
    }
```

- [ ] **Step 2: The chapter-select screen**

After the closing `}` of `titleScreen` (line 832), insert:

```js
/* Chapter-select screen for one adventure: chapter 1 always open, later chapters
   encrypted until the previous chapter's recorded completion satisfies their
   unlock. Reuses the locked-card styling; PURGE RECORD is a two-step confirm. */
function adventureScreen(adv){
  episode=null; state=null; advCtx=null; clearWatch();
  if(AUDIO) AUDIO.menu();
  html.removeAttribute("data-tier"); html.classList.remove("crush","madness");
  html.style.setProperty("--glitch","0"); html.style.setProperty("--bleed","0");
  applyScreenFilter();
  const scars = FEAT.scars ? loadScars() : {};
  const prog = loadProgress()[adv.id]||{};
  const cards = adv.chapters.map((ch,i)=>{
    const n = "CH " + String(i+1).padStart(2,"0");
    if(!chapterUnlocked(adv,i)) return `<div class="epcard locked"><div class="epn">${n} // ENCRYPTED</div>
      <div class="ept">[ ${ch.title} ]</div><div class="epb">${ch.byline||""}</div></div>`;
    const o = scars[ch.id];
    const scar = o ? `<div class="scar scar--${o.type}">// last attempt: ${esc(o.label||"UNKNOWN")}</div>` : "";
    return `<div class="epcard" data-ep="${esc(ch.id)}" onclick="location.hash=this.dataset.ep">
      <div class="epn">${n}${prog[ch.id]?" // RECOVERED":""}</div><div class="ept">${ch.title}</div>
      <div class="epb">${ch.byline||""}</div>${scar}</div>`;
  }).join("");
  root.innerHTML = `<div class="title-screen">
    <div class="bigtitle glitchable glow">${adv.title}</div>
    <div class="sub">${adv.byline||""}</div>
    <div class="eplist">${cards}
      <div style="margin-top:24px">
        <button class="choice" onclick="returnToMenu()">Return to salvage menu</button>
        <button class="choice" onclick="purgeAdventure(this,'${esc(adv.id)}')">PURGE LOCAL RECORD</button>
      </div>
    </div></div>` + footer();
  scrollTop(false);
}
function purgeAdventure(btn, advId){
  if(btn.dataset.armed!=="1"){ btn.dataset.armed="1"; btn.textContent="CONFIRM PURGE -- this forgets every segment"; return; }
  try{ const p=loadProgress(); delete p[advId]; localStorage.setItem(PROG_KEY, JSON.stringify(p)); }catch(e){}
  const adv=EPISODES.find(e=>e.adventure && e.id===advId);
  if(adv) adventureScreen(adv);
}
```

Note: chapter `title`/`byline` come from the chapter's own episode JSON (full episodes are inlined). Showing the locked chapter's bracketed title matches the main-menu locked-card pattern; reverse-chronology titles are not spoilers by design.

- [ ] **Step 3: Routing**

Replace `route()` (lines 1029-1038) with:

```js
function route(){
  if(!booted) return; // the boot screen owns the screen until the wake press
  const hash = location.hash.replace(/^#/,"").toLowerCase();
  if(hash==="lab" && labAllowed()){ if(!labOn) lab(); return; }
  if(labOn) return; // lab owns the screen on staging; never auto-leaves it
  const adv = hash && EPISODES.find(e=> e.adventure && (e.id||"").toLowerCase()===hash);
  if(adv){ adventureScreen(adv); return; }
  if(hash) for(const a of EPISODES){
    if(!a.adventure) continue;
    const i=a.chapters.findIndex(c=> (c.id||"").toLowerCase()===hash);
    if(i>=0){
      if(!chapterUnlocked(a,i)){ location.hash=a.id; return; } // unmet unlock -> chapter screen
      if(!episode || episode.id!==a.chapters[i].id) startEpisode(a.chapters[i], {adv:a, idx:i});
      return;
    }
  }
  const ep = hash && EPISODES.find(e=> (e.id||"").toLowerCase()===hash && !e.locked && e.nodes);
  if(ep){ if(!episode || episode.id!==ep.id) startEpisode(ep); return; }
  // empty / unknown / locked -> menu (guarded so a duplicate empty hashchange is a no-op)
  if(episode || !root.querySelector(".title-screen")) titleScreen();
}
```

- [ ] **Step 4: Return flow — a finished chapter lands on its chapter screen**

Replace `returnToMenu` (line 1039) with:

```js
function returnToMenu(){
  if(advCtx){ const a=advCtx.adv.id; advCtx=null; location.hash=a; return; } // chapter ending -> chapter screen (the new unlock is the payoff)
  if(location.hash) location.hash=""; else route();
}
```

- [ ] **Step 5: Verify + commit**

Run: `npm test && npm run validate && npm run build`
Expected: all exit 0; `dist/index.html` builds; opening it shows the menu unchanged (no adventure entries exist yet).

```bash
git add engine/template.html
git commit -m "feat(engine): chapter-select screen, adventure menu card, unlock routing, purge"
```

---

### Task 9: End-to-end playtest with a temporary adventure (Playwright)

Nothing here is committed except fixes it uncovers. The temp fixture is created, exercised, and deleted inside this task.

**Files (temporary, deleted at the end):**
- Create: `episodes/test-arc-late.json`, `episodes/test-arc-early.json`
- Modify: `episodes/manifest.json` (temp entry, reverted)

- [ ] **Step 1: Create the temp chapters**

`episodes/test-arc-late.json`:

```json
{
  "id": "test-arc-late",
  "title": "THE LAST WATCH",
  "byline": "You are the last to wake. Something already happened here.",
  "start": "wake",
  "startSanity": 100,
  "nodes": {
    "wake": { "title": "BUNK ROW", "text": "<p>You wake to a console that is already mid-request. Someone queued it before you slept.</p>", "onEnter": { "sanity": -10 }, "choices": [
      { "text": "Read the pending request", "to": "console" },
      { "text": "Head for the airlock", "to": "out" },
      { "text": "Open the dark locker", "to": "locker" }
    ]},
    "console": { "title": "CONSOLE", "text": "<p>The request names you. It was queued years ago. You note the sender and feel watched.</p>", "onEnter": { "sanity": -15, "flags": { "saw_request": true } }, "choices": [
      { "text": "Back to the bunks", "to": "wake" }
    ]},
    "locker": { "title": "LOCKER", "text": "<p>The locker is colder inside than the room. Something kept it that way on purpose.</p>", "onEnter": { "sanity": -100 }, "choices": [
      { "text": "Close it", "to": "wake" }
    ]},
    "out": { "ending": { "type": "escape", "stamp": "// ADRIFT", "text": "<p>You seal the lock behind you. The request is still pending when the lights go.</p>" } }
  }
}
```

The `locker` node's -100 onEnter makes madness reachable (entering it ends the run at sanity 0), which lets Step 3 exercise the `prior_madness` path. The validator accepts it: the escape path survives (forced loss 10-25), and the locker's unreachable "Close it" choice only draws an advisory dead-choice warn.

`episodes/test-arc-early.json`:

```json
{
  "id": "test-arc-early",
  "title": "THE FIRST WATCH",
  "byline": "Years earlier. The console is empty. For now.",
  "start": "wake",
  "startSanity": 100,
  "nodes": {
    "wake": { "title": "BUNK ROW", "text": "<p>The console sits dark. Nothing queued. Nothing pending. You could change that.</p>", "onEnter": { "sanity": -10 }, "choices": [
      { "text": "You know what gets queued here", "to": "knowing", "requires": { "flag": "saw_request" }, "locked": "x Something about this console nags at you" },
      { "text": "You remember leaving", "to": "leaving", "requires": { "flag": "prior_escape" }, "locked": "x You do not remember how this ends" },
      { "text": "Queue a request and go", "to": "out", "effects": { "sanity": -15 } },
      { "text": "Stay at the console", "to": "stay" }
    ]},
    "knowing": { "title": "CONSOLE", "text": "<p>You have read this request before it exists. Your own name, queued by your own hand.</p>", "onEnter": { "sanity": -10 }, "choices": [
      { "text": "Back away", "to": "wake" }
    ]},
    "leaving": { "title": "CONSOLE", "text": "<p>You remember sealing a lock that has not been built yet.</p>", "onEnter": { "sanity": -5 }, "choices": [
      { "text": "Back away", "to": "wake" }
    ]},
    "stay": { "ending": { "type": "dead", "stamp": "// AT POST", "text": "<p>They find the chair occupied. They log it as empty.</p>" } },
    "out": { "ending": { "type": "escape", "stamp": "// QUEUED", "text": "<p>You queue it for whoever wakes last. You already know who that is.</p>" } }
  }
}
```

Add to `episodes/manifest.json` immediately before the first anomaly entry:

```json
    {
      "adventure": "test-arc",
      "title": "TEST ARC",
      "byline": "temporary playtest fixture -- never ship",
      "chapters": [
        { "file": "test-arc-late.json", "exports": ["saw_request"] },
        { "file": "test-arc-early.json", "unlock": "any", "imports": ["saw_request", "prior_escape"] }
      ]
    },
```

- [ ] **Step 2: Validate + build**

Run: `npm run validate && npm run build`
Expected: exit 0 (warns are fine — the fixtures have only 0-1 dead endings each; that warn is advisory). Fix any ERROR in the fixture, not the tools.

- [ ] **Step 3: Drive it in a browser (Playwright MCP tools)**

Open `file://<repo>/dist/index.html` and verify, in order:

1. Press a key to pass the boot screen. The menu shows the `TEST ARC` card with `// MULTIPART // 0/2 RECOVERED`.
2. Click it: chapter screen shows `CH 01` (THE LAST WATCH, playable) and `CH 02 // ENCRYPTED` (bracketed title, inert).
3. Clicking the encrypted card does nothing; setting `location.hash = "test-arc-early"` by hand bounces back to the chapter screen (unlock guard).
4. Play CH 01: read the pending request (sets `saw_request`), then escape. Ending shows; the return button lands on the chapter screen, where CH 02 is now decrypted and CH 01 shows `// RECOVERED` plus a scar line.
5. Start CH 02: both gated choices are open (`saw_request` imported, `prior_escape` derived). Reach an ending, return.
6. Reload the page, pass boot, open TEST ARC: progress survived (2/2 RECOVERED).
7. `PURGE LOCAL RECORD` -> first click arms, second click clears: CH 02 encrypted again, 0/2 on the menu card.
8. Replay CH 01 but die or go mad instead of escaping: CH 02 unlocks (unlock "any"), and in CH 02 the `prior_escape` gate stays locked while `saw_request` reflects whether that run read the console.
9. `localStorage` sanity: `skein_progress_v1` holds only the `test-arc` key; `skein_scars_v1` gained the two chapter ids.

- [ ] **Step 4: Clean up the fixture**

```bash
git checkout -- episodes/manifest.json
rm episodes/test-arc-late.json episodes/test-arc-early.json
npm run validate && npm run build && npm test
```

Expected: all exit 0, `git status` clean (only prior commits). Commit nothing unless Step 3 uncovered engine/tool fixes — those go in as their own `fix(engine):`/`fix(validate):` commits with the bug named.

---

### Task 10: Docs

**Files:**
- Modify: `CLAUDE.md` (after the "Generation dials" section), `README.md` ("How it fits together" list)

- [ ] **Step 1: CLAUDE.md**

Insert a new section after the "Generation dials" section and before "Don't":

```markdown
## Adventures (chaptered episodes)

The manifest may group ordered chapters into an adventure (issue #3; spec in
`docs/superpowers/specs/2026-06-11-chaptered-adventures-design.md`):

```jsonc
{ "adventure": "arc", "title": "...", "byline": "...",
  "chapters": [
    { "file": "arc-one.json", "exports": ["saw_it"] },             // cap: 4 flags
    { "file": "arc-two.json", "unlock": "any", "imports": ["saw_it", "prior_escape"] }
  ] }
```

Each chapter is an ordinary episode that must validate standalone. Later chapters
stay encrypted on the menu until the previous chapter's recorded completion
satisfies their `unlock` ("any" | `{"ending": id}` | `{"type": t}` | `{"flag": f}`).
On completion (madness included) the engine records the ending's identity and which
declared `exports` the run set (`skein_progress_v1` in localStorage); the next
chapter's `imports` are preset as flags, plus the reserved `prior_escape` /
`prior_dead` / `prior_madness` / `prior_end_<nodeId>`. The hard rule: **imports may
only gate optional beats** -- every chapter must still reach a survivable escape
with zero imports (`tools/adventure.mjs` + the solver enforce the whole contract;
chapter ids share one namespace with episode and adventure ids). Reverse
chronology is the house authoring convention for adventures, not an engine rule.
```

- [ ] **Step 2: README.md**

In the "How it fits together" section, add one list item after the `tools/validate.mjs` entry:

```markdown
- `tools/adventure.mjs` — the cross-chapter contract for multi-chapter adventures: unlock conditions, the bounded flag carryover, and solver-backed continuity checks across chapters.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: adventure manifest shape, carryover rules, validation contract"
```

---

## Final verification

- [ ] `npm test && npm run validate && npm run build` — all exit 0
- [ ] `git log --oneline main..` reads as a coherent conventional-commit series
- [ ] No story content in `engine/template.html` or `dist/`; no validator rule weakened
- [ ] The real manifest contains no adventure entry (the first real adventure is issue #3 phase 3, authored later via the ideate/author/review skill loop)
