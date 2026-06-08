#!/usr/bin/env node
// validate.test.mjs — self-tests for the validator/solver. Zero deps.
// Each fixture is a tiny episode with a known verdict; we assert the validator
// reaches it. Run: node tools/validate.test.mjs  (npm test). Exit 1 on failure.

import { validateEpisode } from "./validate.mjs";
import { resolveSpec } from "./spec.mjs";
import { buildSkeleton } from "./new.mjs";

let passed = 0, failed = 0;
const C = { red:"\x1b[31m", green:"\x1b[32m", dim:"\x1b[2m", reset:"\x1b[0m" };

function check(label, cond, detail = "") {
  if (cond) { passed++; }
  else { failed++; console.log(`  ${C.red}FAIL${C.reset} ${label}${detail ? `  ${C.dim}${detail}${C.reset}` : ""}`); }
}
const hasErr  = (r, s) => r.errors.some((m) => m.includes(s));
const hasWarn = (r, s) => r.warnings.some((m) => m.includes(s));

// ending helpers
const escape = (stamp = "// OUT") => ({ ending: { type: "escape", stamp, text: "<p>out</p>" } });
const dead   = (stamp = "// DEAD") => ({ ending: { type: "dead", stamp, text: "<p>dead</p>" } });

// --- fixture: clean, winnable, 2 dead endings, no dead items/flags ---
{
  const ep = {
    id: "clean", title: "CLEAN", start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>h</p>", choices: [
        { text: "open door", to: "exit", requires: { item: "key" }, locked: "locked" },
        { text: "search closet", to: "closet" },
        { text: "jump in pit", to: "pit" },
        { text: "touch the void", to: "void" },
      ]},
      closet: { text: "<p>c</p>", onEnter: { add: ["key"], sanity: -10 }, choices: [{ text: "back", to: "hub" }] },
      exit: escape(), pit: dead("// PIT"), void: dead("// VOID"),
    },
  };
  const r = validateEpisode(ep);
  check("clean: ok", r.ok, r.errors.join("; "));
  check("clean: winnable", r.report.winnable === true);
  check("clean: 2 dead endings", r.report.deadEndings === 2, `got ${r.report?.deadEndings}`);
  check("clean: no warnings", r.warnings.length === 0, r.warnings.join("; "));
}

// --- fixture: unwinnable — escape exists but onEnter cost forces madness first ---
{
  const ep = {
    id: "unwinnable", title: "U", start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>h</p>", choices: [
        { text: "crawl into the tunnel", to: "tunnel" },
        { text: "lie down", to: "grave" },
      ]},
      tunnel: { text: "<p>t</p>", onEnter: { sanity: -100 }, choices: [{ text: "out", to: "exit" }] },
      exit: escape(), grave: dead(),
    },
  };
  const r = validateEpisode(ep);
  check("unwinnable: not ok", !r.ok);
  check("unwinnable: flagged unwinnable", hasErr(r, "unwinnable"), r.errors.join("; "));
  check("unwinnable: solver winnable=false", r.report.winnable === false);
}

// --- fixture: solvable ONLY by grabbing and using med-gel (tests gel modeling) ---
{
  const ep = {
    id: "gel", title: "GEL", start: "hub", startSanity: 30,
    nodes: {
      hub: { text: "<p>h</p>", choices: [
        { text: "grab the gel", to: "shelf" },
        { text: "steady yourself and open the door", to: "exit", requires: { sanityMin: 50 }, locked: "not steady enough" },
        { text: "panic 1", to: "d1" },
        { text: "panic 2", to: "d2" },
      ]},
      shelf: { text: "<p>s</p>", onEnter: { add: ["medgel"] }, choices: [{ text: "back", to: "hub" }] },
      exit: escape(), d1: dead("// A"), d2: dead("// B"),
    },
  };
  const r = validateEpisode(ep);
  check("gel: ok", r.ok, r.errors.join("; "));
  check("gel: winnable via gel", r.report.winnable === true);
  check("gel: no unwinnable error", !hasErr(r, "unwinnable"));
}

// --- fixture: onEnter fires once — a revisited hub must not re-charge its cost ---
{
  // hub costs -60 on first enter (100 -> 40). You leave to a branch and come back.
  // If onEnter re-applied on return (40 -> 0) the escape would be unreachable.
  const ep = {
    id: "once", title: "ONCE", start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>h</p>", onEnter: { sanity: -60 }, choices: [
        { text: "fetch key", to: "room", requires: { notItem: "key" }, locked: "have key" },
        { text: "leave", to: "exit", requires: { item: "key" }, locked: "need key" },
        { text: "die", to: "g1" }, { text: "die2", to: "g2" },
      ]},
      room: { text: "<p>r</p>", onEnter: { add: ["key"] }, choices: [{ text: "back", to: "hub" }] },
      exit: escape(), g1: dead("// X"), g2: dead("// Y"),
    },
  };
  const r = validateEpisode(ep);
  check("once: ok (onEnter once)", r.ok, r.errors.join("; "));
  check("once: winnable", r.report.winnable === true);
}

// --- fixture: soft-lock — requires an item that is never obtainable ---
{
  const ep = {
    id: "softlock", title: "S", start: "hub",
    nodes: {
      hub: { text: "<p>h</p>", choices: [
        { text: "open", to: "exit", requires: { item: "ghostkey" }, locked: "locked" },
        { text: "die", to: "grave" },
      ]},
      exit: escape(), grave: dead(),
    },
  };
  const r = validateEpisode(ep);
  check("softlock: not ok", !r.ok);
  check("softlock: soft-lock error", hasErr(r, "soft-lock"), r.errors.join("; "));
}

// --- fixture: dangling pointer — solver must be skipped, structural error raised ---
{
  const ep = {
    id: "dangling", title: "D", start: "hub",
    nodes: {
      hub: { text: "<p>h</p>", choices: [
        { text: "go", to: "nowhere" },
        { text: "die", to: "grave" },
      ]},
      grave: dead(),
    },
  };
  const r = validateEpisode(ep);
  check("dangling: not ok", !r.ok);
  check("dangling: non-existent node error", hasErr(r, "non-existent node"));
  check("dangling: solver skipped", r.report.winnable === null);
}

// --- fixture: only one nasty ending — advisory warn, still valid ---
{
  const ep = {
    id: "onedeath", title: "1", start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>h</p>", choices: [
        { text: "leave", to: "exit" },
        { text: "die", to: "grave" },
      ]},
      exit: escape(), grave: dead(),
    },
  };
  const r = validateEpisode(ep);
  check("onedeath: ok (advisory only)", r.ok, r.errors.join("; "));
  check("onedeath: nasty-ending warn", hasWarn(r, "nasty ways to die"));
}

// --- fixture: dead item + dead flag warnings ---
{
  const ep = {
    id: "deadrefs", title: "DR", start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>h</p>", choices: [
        { text: "pocket the trinket", to: "a", effects: { add: ["trinket"], flags: { seen: true } } },
        { text: "leave", to: "exit" },
        { text: "die", to: "d1" }, { text: "die2", to: "d2" },
      ]},
      a: { text: "<p>a</p>", choices: [{ text: "back", to: "hub" }] },
      exit: escape(), d1: dead("// A"), d2: dead("// B"),
    },
  };
  const r = validateEpisode(ep);
  check("deadrefs: ok", r.ok, r.errors.join("; "));
  check("deadrefs: dead item warn", hasWarn(r, 'item "trinket"'));
  check("deadrefs: dead flag warn", hasWarn(r, 'flag "seen"'));
}

// --- spec: scaffold for a spec validates clean against that spec ---
for (const [size, punishment] of [["short", "gentle"], ["standard", "standard"], ["long", "cruel"]]) {
  const resolved = resolveSpec({ size, punishment });
  const ep = { id: `scaf-${size}-${punishment}`, title: "S", spec: { size, punishment },
    start: "wake", startSanity: 100, startInventory: [], nodes: buildSkeleton(resolved) };
  const r = validateEpisode(ep);
  check(`scaffold ${size}/${punishment}: no errors`, r.errors.length === 0, r.errors.join("; "));
  check(`scaffold ${size}/${punishment}: node count in range`,
    r.report.nodes >= resolved.minNodes && r.report.nodes <= resolved.maxNodes, `got ${r.report.nodes}`);
  check(`scaffold ${size}/${punishment}: meets death floor`, r.report.deadEndings >= resolved.deadMin);
}

// --- spec: unknown dial is an error ---
{
  const ep = { id: "badspec", title: "B", spec: { size: "epic" }, start: "a",
    nodes: { a: { text: "<p>a</p>", choices: [{ text: "go", to: "x" }, { text: "die", to: "d" }] }, x: escape(), d: dead() } };
  const r = validateEpisode(ep);
  check("badspec: unknown dial error", hasErr(r, "spec: unknown size"), r.errors.join("; "));
}

// --- spec: node count below the size floor is an ERROR ---
{
  const ep = { id: "toosmall", title: "T", spec: { size: "standard" }, start: "a", startSanity: 100,
    nodes: { a: { text: "<p>a</p>", choices: [{ text: "go", to: "x" }, { text: "die", to: "d" }] }, x: escape(), d: dead() } };
  const r = validateEpisode(ep);
  check("toosmall: node-count error", hasErr(r, "nodes outside"), r.errors.join("; "));
}

// --- spec: death ratio / dead floor below punishment is an ERROR ---
{
  // cruel wants >= 3 dead endings; give it one.
  const ep = { id: "toosoft", title: "T", spec: { punishment: "cruel" }, start: "a", startSanity: 100,
    nodes: { a: { text: "<p>a</p>", choices: [{ text: "out", to: "x" }, { text: "die", to: "d" }] }, x: escape(), d: dead() } };
  const r = validateEpisode(ep);
  check("toosoft: punishment floor error", hasErr(r, 'punishment "cruel"'), r.errors.join("; "));
}

// --- character: a well-formed protagonist profile validates and is reported ---
{
  const ep = { id: "char", title: "C", start: "hub", startSanity: 100,
    character: { role: "maintenance engineer", expertise: ["power systems", "hull"], backstory: "Twelve years on long-haul tugs." },
    nodes: { hub: { text: "<p>h</p>", choices: [
      { text: "out", to: "x" }, { text: "die", to: "d" }, { text: "die2", to: "d2" }] },
      x: escape(), d: dead("// A"), d2: dead("// B") } };
  const r = validateEpisode(ep);
  check("character: ok", r.ok, r.errors.join("; "));
  check("character: role reported", r.report.character && r.report.character.role === "maintenance engineer");
  check("character: expertise reported", r.report.character && r.report.character.expertise.length === 2);
}

// --- character: malformed shape is an error ---
{
  const ep = { id: "badchar", title: "B", start: "hub", startSanity: 100,
    character: { role: 42, expertise: "power" },
    nodes: { hub: { text: "<p>h</p>", choices: [
      { text: "out", to: "x" }, { text: "die", to: "d" }, { text: "die2", to: "d2" }] },
      x: escape(), d: dead("// A"), d2: dead("// B") } };
  const r = validateEpisode(ep);
  check("badchar: role-type error", hasErr(r, "character.role must be a string"));
  check("badchar: expertise-type error", hasErr(r, "character.expertise must be an array"));
}

// --- escape=forbidden: a no-way-out story validates clean ---
{
  const ep = {
    id: "noexit", title: "NOEXIT", spec: { escape: "forbidden" }, start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>h</p>", choices: [
        { text: "wander", to: "room" },
        { text: "give in", to: "d1" },
        { text: "give up", to: "d2" },
      ]},
      room: { text: "<p>r</p>", choices: [{ text: "deeper", to: "d1" }] },
      d1: dead("// A"), d2: dead("// B"),
    },
  };
  const r = validateEpisode(ep);
  check("noexit: ok (no escape required)", r.ok, r.errors.join("; "));
  check("noexit: not flagged unwinnable", !hasErr(r, "unwinnable"));
  check("noexit: report.winnable false", r.report.winnable === false);
  check("noexit: report.escape forbidden", r.report.escape === "forbidden");
}

// --- escape=forbidden but an escape ending exists -> ERROR ---
{
  const ep = {
    id: "contradiction", title: "C", spec: { escape: "forbidden" }, start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>h</p>", choices: [{ text: "out", to: "exit" }, { text: "die", to: "d1" }] },
      exit: escape(), d1: dead(),
    },
  };
  const r = validateEpisode(ep);
  check("contradiction: not ok", !r.ok);
  check("contradiction: escape-forbidden error", hasErr(r, "no way out"), r.errors.join("; "));
}

// --- default (no escape dial): still requires a survivable escape ---
{
  const ep = {
    id: "needsescape", title: "N", start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>h</p>", choices: [{ text: "die", to: "d1" }, { text: "die2", to: "d2" }] },
      d1: dead("// A"), d2: dead("// B"),
    },
  };
  const r = validateEpisode(ep);
  check("needsescape: not ok by default", !r.ok);
  check("needsescape: unwinnable hint mentions forbidden", hasErr(r, 'spec.escape = "forbidden"'), r.errors.join("; "));
}

// --- scaffolder: forbidden skeleton validates clean and has no escape node ---
{
  const resolved = resolveSpec({ size: "short", punishment: "cruel", escape: "forbidden" });
  const ep = { id: "scaf-noexit", title: "S", spec: { size: "short", punishment: "cruel", escape: "forbidden" },
    start: "wake", startSanity: 100, startInventory: [], nodes: buildSkeleton(resolved) };
  const r = validateEpisode(ep);
  check("scaffold forbidden: no errors", r.errors.length === 0, r.errors.join("; "));
  check("scaffold forbidden: no escape ending", !Object.values(ep.nodes).some((n) => n.ending && n.ending.type === "escape"));
}

// --- prose: non-ASCII punctuation is a hard error ---
{
  const EM = String.fromCodePoint(0x2014); // em-dash
  const ep = { id: "emdash", title: "E", start: "hub", startSanity: 100,
    nodes: { hub: { text: `<p>The corridor goes ${EM} nowhere.</p>`, choices: [
      { text: "out", to: "x" }, { text: "die", to: "d" }, { text: "die2", to: "d2" }] },
      x: escape(), d: dead("// A"), d2: dead("// B") } };
  const r = validateEpisode(ep);
  check("emdash: non-ASCII error", hasErr(r, "non-ASCII"), r.errors.join("; "));
}

// --- a clickable choice with no destination is an ERROR (runtime crash class) ---
{
  // the "locked" hint uses an inverted gate (notItem) that IS satisfiable when
  // the player lacks the item, so the engine would render it clickable with no
  // "to" and crash on click -- exactly the derelict launch bug.
  const ep = { id: "nogo", title: "N", start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>h</p>", choices: [
        { text: "grab key", to: "room" },
        { text: "launch", to: "x", requires: { item: "key" } },
        { text: "launch", requires: { notItem: "key" }, locked: "no key" },
        { text: "die", to: "d" }, { text: "die2", to: "d2" }] },
      room: { text: "<p>r</p>", onEnter: { add: ["key"] }, choices: [{ text: "back", to: "hub" }] },
      x: escape(), d: dead("// A"), d2: dead("// B") } };
  const r = validateEpisode(ep);
  check("nogo: clickable-no-destination error", hasErr(r, "crashes on click"), r.errors.join("; "));
}

// --- prose: a doubled dash is a hard error (stories use single hyphens) ---
{
  const ep = { id: "doubledash", title: "D", start: "hub", startSanity: 100,
    nodes: { hub: { text: "<p>The hall goes on -- and on.</p>", choices: [
      { text: "out", to: "x" }, { text: "die", to: "d" }, { text: "die2", to: "d2" }] },
      x: escape(), d: dead("// A"), d2: dead("// B") } };
  const r = validateEpisode(ep);
  check("doubledash: doubled-dash error", hasErr(r, "doubled dash"), r.errors.join("; "));
}

// --- prose: essay-register slop is a hard error ---
{
  const ep = { id: "slop", title: "S", start: "hub", startSanity: 100,
    nodes: { hub: { text: "<p>You delve into the dark.</p>", choices: [
      { text: "out", to: "x" }, { text: "die", to: "d" }, { text: "die2", to: "d2" }] },
      x: escape(), d: dead("// A"), d2: dead("// B") } };
  const r = validateEpisode(ep);
  check("slop: delve is an error", hasErr(r, '"delve"'), r.errors.join("; "));
}

// --- prose: first-person warns, but quoted speech is exempt ---
{
  const ep = { id: "pov", title: "P", start: "hub", startSanity: 100,
    nodes: { hub: { text: '<p>I run for it. The log says "we are not alone here".</p>', choices: [
      { text: "out", to: "x" }, { text: "die", to: "d" }, { text: "die2", to: "d2" }] },
      x: escape(), d: dead("// A"), d2: dead("// B") } };
  const r = validateEpisode(ep);
  const pov = r.warnings.find((w) => w.includes("first-person")) || "";
  check("pov: flags narrative I", pov.includes("I"), pov);
  check("pov: exempts quoted we", !pov.includes("we"), pov);
}

// --- prose: a sanityText variant that can never show warns (solver-backed) ---
{
  const ep = { id: "deadsan", title: "D", start: "hub", startSanity: 100,
    nodes: { hub: { text: "<p>h</p>", sanityText: { "20": "<p>low</p>" }, choices: [
      { text: "out", to: "x" }, { text: "die", to: "d" }, { text: "die2", to: "d2" }] },
      x: escape(), d: dead("// A"), d2: dead("// B") } };
  const r = validateEpisode(ep);
  check("deadsan: never-shown sanityText warn", r.warnings.some((w) => w.includes("never displays")), r.warnings.join("; "));
}

// --- prose: "your <item>" where the item can't be held there warns (solver-backed) ---
{
  const ep = { id: "possess", title: "P", start: "hub", startSanity: 100,
    nodes: {
      hub: { text: "<p>your keycard is missing.</p>", choices: [
        { text: "grab it", to: "room" },
        { text: "out", to: "x", requires: { item: "keycard" }, locked: "need the card" },
        { text: "die", to: "d" }, { text: "die2", to: "d2" }] },
      room: { text: "<p>r</p>", onEnter: { add: ["keycard"] }, choices: [{ text: "out", to: "x" }] },
      x: escape(), d: dead("// A"), d2: dead("// B") } };
  const r = validateEpisode(ep);
  check("possess: state-incoherent possession warn", r.warnings.some((w) => w.includes("your keycard") && w.includes("incoherent")), r.warnings.join("; "));
}

console.log(`\n${failed ? C.red : C.green}validate.test: ${passed} passed, ${failed} failed${C.reset}\n`);
process.exit(failed ? 1 : 0);
