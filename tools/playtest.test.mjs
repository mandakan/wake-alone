#!/usr/bin/env node
// playtest.test.mjs — self-tests for the playthrough planner and trace checks.
// The browser driver itself is exercised by running npm run playtest (it hard-fails
// on any engine/planner drift); these tests pin the non-browser parts: the solver's
// structured runs, chapter unlock seeding, and the revisit prose check.
// Run: node tools/playtest.test.mjs  (npm test). Exit 1 on failure.

import { buildPlan, chapterSeed, checkRevisitProse, formatTrace } from "./playtest.mjs";

let passed = 0, failed = 0;
const C = { red: "\x1b[31m", green: "\x1b[32m", dim: "\x1b[2m", reset: "\x1b[0m" };
function check(label, cond, detail = "") {
  if (cond) { passed++; }
  else { failed++; console.log(`  ${C.red}FAIL${C.reset} ${label}${detail ? `  ${C.dim}${detail}${C.reset}` : ""}`); }
}

const escape = () => ({ ending: { type: "escape", stamp: "// OUT", text: "<p>out</p>" } });
const dead = (stamp = "// DEAD") => ({ ending: { type: "dead", stamp, text: "<p>dead</p>" } });

// --- fixture: single forced route; solver must emit a replayable act list per ending ---
{
  const ep = {
    id: "acts", title: "ACTS", start: "intro", startSanity: 100,
    nodes: {
      intro: { text: "<p>w</p>", choices: [{ text: "on", to: "hub" }] },
      hub: { text: "<p>h</p>", choices: [
        { text: "exit", to: "exit", requires: { item: "key" }, locked: "locked" },
        { text: "closet", to: "closet" },
        { text: "pit", to: "pit" },
      ]},
      closet: { text: "<p>c</p>", onEnter: { add: ["key"], sanity: -20 }, choices: [{ text: "back", to: "hub" }] },
      exit: escape(), pit: dead(),
    },
  };
  const plan = buildPlan(ep);
  check("plan: one trace per reachable ending + no madness", plan.traces.length === 2, `got ${plan.traces.length}`);
  const esc = plan.traces.find((t) => t.name.includes("escape"));
  check("plan: escapes sort first", plan.traces[0] === esc);
  check("plan: escape route is the known unique one",
    JSON.stringify(esc.acts.map((a) => a.idx)) === JSON.stringify([0, 1, 0, 0]), JSON.stringify(esc.acts));
  check("plan: escape sanity accounts for onEnter", esc.expect.sanity === 80, `got ${esc.expect.sanity}`);
  const pit = plan.traces.find((t) => t.name.includes("pit"));
  check("plan: dead route found", pit && pit.expect.node === "pit", pit && JSON.stringify(pit.acts));
}

// --- fixture: gel is required to survive; the planned run must include it.
// Madness is reachable (skip the gel), so a madness trace must exist too. ---
{
  const ep = {
    id: "gel", title: "GEL", start: "intro", startSanity: 20, startInventory: ["medgel"],
    nodes: {
      intro: { text: "<p>w</p>", choices: [{ text: "on", to: "maw" }] },
      maw: { text: "<p>m</p>", choices: [{ text: "through", to: "exit", effects: { sanity: -30 } }] },
      exit: escape(),
    },
  };
  const plan = buildPlan(ep);
  const esc = plan.traces.find((t) => t.name.includes("escape"));
  check("gel: escape run uses the med-gel free action", esc && esc.acts.some((a) => a.kind === "gel"), esc && JSON.stringify(esc.acts));
  check("gel: escape sanity after gel", esc && esc.expect.sanity === 15, esc && `got ${esc.expect.sanity}`);
  const mad = plan.traces.find((t) => t.kind === "madness");
  check("gel: madness route recorded (fatal act last)", mad && mad.acts.length === 2 && mad.acts[1].idx === 0, mad && JSON.stringify(mad.acts));
}

// --- solve(): seeded flags open gated routes (chapter imports) ---
{
  const ep = {
    id: "seeded", title: "S", start: "intro", startSanity: 100,
    nodes: {
      intro: { text: "<p>w</p>", choices: [
        { text: "gated", to: "exit", requires: { flag: "prior_escape" }, locked: "no" },
        { text: "pit", to: "pit" },
      ]},
      exit: escape(), pit: dead(),
    },
  };
  check("seed: gated escape closed without imports", buildPlan(ep, []).traces.every((t) => t.expect.node !== "exit"));
  check("seed: gated escape open with imports", buildPlan(ep, ["prior_escape"]).traces.some((t) => t.expect.node === "exit"));
}

// --- chapterSeed: synthetic prior record mirrors the engine's unlock/import rules ---
{
  const prev = { ep: { id: "ch1", nodes: { out: { ending: { type: "escape" } }, grave: { ending: { type: "dead" } } } } };
  const byType = chapterSeed({ idx: 1, prev, decl: { unlock: { type: "escape" }, imports: ["saw_it", "prior_escape", "prior_end_out"] } });
  check("chapterSeed: unlock-by-type picks a matching prior ending", byType.record.type === "escape" && byType.record.node === "out", JSON.stringify(byType));
  check("chapterSeed: imports = declared ∩ carried (undeclared exports stay unset)",
    JSON.stringify(byType.imports.sort()) === JSON.stringify(["prior_end_out", "prior_escape"]), JSON.stringify(byType.imports));
  const byFlag = chapterSeed({ idx: 1, prev, decl: { unlock: { flag: "saw_it" }, imports: ["saw_it"] } });
  check("chapterSeed: unlock-by-flag carries the flag into imports", JSON.stringify(byFlag.imports) === JSON.stringify(["saw_it"]), JSON.stringify(byFlag));
  check("chapterSeed: first chapter needs no seed", chapterSeed({ idx: 0, prev: null, decl: {} }) === null);
}

// --- revisit check: first-arrival prose flagged only on re-entry ---
{
  const trace = { name: "t", steps: [
    { n: 1, id: "intro", prose: "You wake with a start." },
    { n: 2, id: "hub", prose: "The hub hums." },
    { n: 3, id: "intro", prose: "You wake with a start." },
    { n: 4, id: "hub", prose: "The hub hums." },
  ] };
  const warns = checkRevisitProse(trace);
  check("revisit: wake prose on re-entry flagged once", warns.length === 1 && warns[0].includes(`"intro"`), warns.join("; "));
}

// --- formatTrace: revisits marked, state line present ---
{
  const tr = { name: "escape via \"exit\"", steps: [
    { n: 1, id: "hub", sanity: 90, inv: ["key"], flags: ["power"], title: "HUB", prose: "The hub.", choices: [{ locked: false, idx: 0, text: "go" }, { locked: true, idx: null, text: "sealed" }], action: "[0] go" },
    { n: 2, id: "hub", sanity: 85, inv: [], flags: [], title: "HUB", prose: "Again.", choices: [], action: "[0] go" },
  ], end: { node: "exit", sanity: 85, stamp: "// OUT", type: "escape", prose: "Out." } };
  const txt = formatTrace(tr);
  check("format: state line", txt.includes(`[step 1] node "hub" | SANITY 90 | INV: key | FLAGS: power`), txt.split("\n")[2]);
  check("format: revisit marker", txt.includes(`node "hub" (revisit)`));
  check("format: locked choice rendered", txt.includes("[locked] sealed"));
  check("format: ending block", txt.includes(`[ending] node "exit" | SANITY 85 | type: escape`));
}

console.log(failed ? `${C.red}${failed} failed${C.reset}, ${passed} passed` : `${C.green}all ${passed} playtest tests passed${C.reset}`);
process.exit(failed ? 1 : 0);
