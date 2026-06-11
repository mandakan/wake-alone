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

console.log(`\n${failed ? C.red : C.green}adventure: ${passed} passed, ${failed} failed${C.reset}\n`);
process.exit(failed ? 1 : 0);
