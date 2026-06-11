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
