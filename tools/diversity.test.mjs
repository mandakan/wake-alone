#!/usr/bin/env node
// diversity.test.mjs — self-tests for the cross-episode diversity check. Zero deps.
// Synthetic in-memory episodes with known verdicts. Run: node tools/diversity.test.mjs

import { checkDiversity } from "./diversity.mjs";

let passed = 0, failed = 0;
const C = { red: "\x1b[31m", green: "\x1b[32m", dim: "\x1b[2m", reset: "\x1b[0m" };
function check(label, cond, detail = "") {
  if (cond) { passed++; }
  else { failed++; console.log(`  ${C.red}FAIL${C.reset} ${label}${detail ? `  ${C.dim}${detail}${C.reset}` : ""}`); }
}
const hasWarn = (r, s) => r.warnings.some((m) => m.includes(s));

// Config with low thresholds so tiny fixtures still trigger deterministically.
const CFG = { enabled: true, shingleN: 4, phraseMinEpisodes: 2, phraseMinContentWords: 2, openingWords: 60, openingWarnAt: 0.55 };

// A minimal episode: one start node (its text is the opening + the body) and an exit.
const ep = (id, startText, extra = {}) => ({
  id, title: id, start: "s",
  nodes: {
    s: { text: `<p>${startText}</p>`, choices: [{ text: "on", to: "e" }] },
    e: { ending: { type: "escape", stamp: "// OUT", text: `<p>${extra.endText || "you leave"}</p>` } },
  },
});

// --- shared distinctive phrase across two episodes -> flagged ---
{
  const a = ep("aa", "the surgeon left a glove palm up on the deck");
  const b = ep("bb", "much later you find a glove palm up on the cold plate");
  const r = checkDiversity([a, b], CFG, []);
  check("shared phrase flagged", hasWarn(r, "glove palm up on"), r.warnings.join(" | "));
}

// --- same shared phrase, but allowlisted -> suppressed ---
{
  const a = ep("aa", "the surgeon left a glove palm up on the deck");
  const b = ep("bb", "much later you find a glove palm up on the cold plate");
  const r = checkDiversity([a, b], CFG, ["glove palm up"]);
  check("allowlisted phrase suppressed", !hasWarn(r, "glove palm up"), r.warnings.join(" | "));
}

// --- all-stopword overlap is never a "distinctive" phrase ---
{
  const a = ep("aa", "you are in the room and it is dark");
  const b = ep("bb", "you are in the room and it is dark");
  const r = checkDiversity([a, b], CFG, []);
  check("stopword-only overlap not flagged as phrase", !r.warnings.some((m) => m.startsWith("diversity: phrase")), r.warnings.join(" | "));
}

// --- near-identical openings -> opening-similarity warning ---
{
  const shared = "rust and quiet and the particular dread of an engine bay that has gone wrong in a way the gauges refuse to name";
  const a = ep("aa", shared);
  const b = ep("bb", shared);
  const r = checkDiversity([a, b], CFG, []);
  check("near-identical openings flagged", hasWarn(r, "openings"), r.warnings.join(" | "));
}

// --- wholly distinct episodes -> no warnings ---
{
  const a = ep("aa", "salt marsh fog crept over the broken jetty where lanterns guttered");
  const b = ep("bb", "the orbital greenhouse smelled of tomatoes and ozone before the alarm");
  const r = checkDiversity([a, b], CFG, []);
  check("distinct episodes: no warnings", r.warnings.length === 0, r.warnings.join(" | "));
}

// --- master switch off -> nothing, ever ---
{
  const shared = "rust and quiet and the particular dread of an engine bay that has gone wrong";
  const r = checkDiversity([ep("aa", shared), ep("bb", shared)], { ...CFG, enabled: false }, []);
  check("disabled -> no warnings", r.warnings.length === 0, r.warnings.join(" | "));
}

// --- fewer than two episodes -> nothing ---
{
  const r = checkDiversity([ep("aa", "anything at all here")], CFG, []);
  check("single episode -> no warnings", r.warnings.length === 0, r.warnings.join(" | "));
}

console.log(`\n${failed ? C.red : C.green}diversity: ${passed} passed, ${failed} failed${C.reset}`);
process.exit(failed ? 1 : 0);
