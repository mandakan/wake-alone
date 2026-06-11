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
  if (chapters.length !== decls.length) { E(`internal: ${chapters.length} packed chapters for ${decls.length} declarations`); return { errors, warnings }; }

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
      const dupes = exports.filter((f, idx) => exports.indexOf(f) !== idx);
      if (dupes.length) W(`${ch}: duplicate export(s) ${[...new Set(dupes)].map((f) => `"${f}"`).join(", ")}`);
    }
    const imports = decl.imports ?? [];
    if (!Array.isArray(imports) || imports.some((f) => typeof f !== "string")) E(`${ch}: "imports" must be an array of flag names`);
  });

  // normalized views: the shape checks above report malformed declarations; every
  // later phase works on the string-only view so one stray element cannot crash it.
  const expOf = (decl) => (Array.isArray(decl.exports) ? decl.exports.filter((f) => typeof f === "string") : []);
  const impOf = (decl) => (Array.isArray(decl.imports) ? decl.imports.filter((f) => typeof f === "string") : []);

  // cross-chapter contract (only meaningful where both sides parsed)
  const solved = chapters.map(({ decl, ep }) => {
    if (!ep || !ep.nodes || !ep.nodes[ep.start]) return null;
    try { return solve(ep, true, impOf(decl)); } catch { return null; }
  });

  for (let i = 1; i < chapters.length; i++) {
    const ch = `chapter ${i + 1}`;
    const prev = chapters[i - 1];
    const prevSolve = solved[i - 1];
    const prevExports = expOf(prev.decl);
    const prevEndings = prev.ep ? Object.keys(prev.ep.nodes || {}).filter((n) => prev.ep.nodes[n].ending) : [];
    const reachableEndings = prevSolve ? new Set(prevSolve.endingFlags.keys()) : null;

    const okPriorEnd = (f) => {
      const node = f.slice("prior_end_".length);
      if (!prev.ep) return true; // file error already reported
      if (!prevEndings.includes(node)) { E(`${ch}: import "${f}" names "${node}", which is not an ending node of the previous chapter`); return false; }
      if (reachableEndings && !reachableEndings.has(node)) { E(`${ch}: import "${f}": ending "${node}" is never reachable in the previous chapter`); return false; }
      return true;
    };

    for (const f of impOf(chapters[i].decl)) {
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
      if (u.kind === "type") {
        if (u.value === "escape" && prev.ep && prev.ep.spec && prev.ep.spec.escape === "forbidden")
          E(`${ch}: unlock {"type":"escape"} after a chapter declared spec.escape="forbidden" can never fire`);
        else if (prevSolve && !prevSolve.truncated) {
          const reachable = u.value === "escape" ? prevSolve.winnable
            : u.value === "dead" ? prevSolve.deadEndings.size > 0
            : prevSolve.madnessReachable;
          if (!reachable) E(`${ch}: unlock {"type":"${u.value}"} can never fire -- the previous chapter never reaches a ${u.value} ending`);
        }
      }
      if (u.kind === "flag" && !prevExports.includes(u.value))
        E(`${ch}: unlock flag "${u.value}" is not in the previous chapter's exports`);
    }
  }

  // exportability: a declared export the chapter can never have set when a run
  // ends (any ending or a madness collapse -- the engine records progress at
  // both) is a contract the engine can never fulfil.
  chapters.forEach(({ decl }, i) => {
    const s = solved[i];
    if (!s || s.truncated) return;
    const exportable = new Set(s.madnessFlags);
    for (const set of s.endingFlags.values()) for (const f of set) exportable.add(f);
    for (const f of expOf(decl)) {
      if (!f.startsWith("prior_") && !exportable.has(f))
        E(`chapter ${i + 1}: export "${f}" can never be set when any reachable ending is recorded`);
    }
  });

  // dead export: nothing downstream (next chapter's imports or unlock flag) reads it.
  for (let i = 0; i < chapters.length; i++) {
    const next = chapters[i + 1];
    const nextImports = next ? impOf(next.decl) : [];
    const nextUnlock = next ? parseUnlock(next.decl.unlock) : null;
    for (const f of expOf(chapters[i].decl)) {
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
    for (const f of impOf(decl)) {
      if (!readFlags.has(f)) W(`chapter ${i + 1}: import "${f}" is never read by any gate in the chapter (dead import?)`);
    }
  });

  return { errors, warnings };
}
