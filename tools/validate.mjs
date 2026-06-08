#!/usr/bin/env node
// validate.mjs — zero-dependency validator for WAKE ALONE episodes.
// Catches the failure modes an AI author actually produces:
//   - choices pointing at non-existent nodes
//   - unreachable / orphan nodes
//   - dead-end nodes with no usable exit
//   - no reachable ending (story can't finish)
//   - required item/flag that is never obtainable (soft-lock)
//   - typos in requires/effects keys that silently disable a gate
//
// Usage:  node tools/validate.mjs [episodes/foo.json ...]
//         (no args -> validate every non-locked episode in the manifest)
// Exit code 0 = all valid; 1 = at least one ERROR.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EPISODES_DIR = join(ROOT, "episodes");

const ENDING_TYPES = ["escape", "dead", "madness"];
const REQUIRE_KEYS = ["item", "notItem", "flag", "notFlag", "sanityMin", "sanityMax"];
const EFFECT_KEYS = ["sanity", "add", "remove", "flags"];

const C = { red:"\x1b[31m", yellow:"\x1b[33m", green:"\x1b[32m", dim:"\x1b[2m", bold:"\x1b[1m", reset:"\x1b[0m" };

export function validateEpisode(ep, name = ep && ep.id) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);

  // ---- top-level shape ----
  for (const k of ["id", "title", "start", "nodes"]) {
    if (ep[k] === undefined) E(`missing top-level field "${k}"`);
  }
  if (ep.startSanity !== undefined && (typeof ep.startSanity !== "number" || ep.startSanity < 0 || ep.startSanity > 100))
    E(`startSanity must be a number 0..100`);
  if (ep.startInventory !== undefined && !Array.isArray(ep.startInventory))
    E(`startInventory must be an array`);
  if (typeof ep.nodes !== "object" || ep.nodes === null) {
    return finish(name, errors, warnings, null); // can't go further
  }

  const nodeIds = Object.keys(ep.nodes);
  if (!ep.nodes[ep.start]) E(`start node "${ep.start}" does not exist`);

  // ---- universe of obtainable items / settable flags (optimistic) ----
  const items = new Set(ep.startInventory || []);
  const flags = new Set();
  const collect = (eff) => {
    if (!eff) return;
    (eff.add || []).forEach((i) => items.add(i));
    if (eff.flags) Object.keys(eff.flags).forEach((f) => flags.add(f));
  };
  for (const n of Object.values(ep.nodes)) {
    collect(n.onEnter);
    (n.choices || []).forEach((c) => collect(c.effects));
  }

  const checkEffects = (eff, where) => {
    if (eff === undefined) return;
    if (typeof eff !== "object") return E(`${where}: effects must be an object`);
    for (const k of Object.keys(eff)) if (!EFFECT_KEYS.includes(k)) W(`${where}: unknown effects key "${k}" (typo?)`);
    if (eff.sanity !== undefined && typeof eff.sanity !== "number") E(`${where}: effects.sanity must be a number`);
    (eff.remove || []).forEach((i) => { if (!items.has(i)) W(`${where}: removes item "${i}" that is never added anywhere`); });
  };
  const checkRequires = (req, where) => {
    if (req === undefined) return;
    if (typeof req !== "object") return E(`${where}: requires must be an object`);
    for (const k of Object.keys(req)) if (!REQUIRE_KEYS.includes(k)) W(`${where}: unknown requires key "${k}" (typo? gate will be ignored)`);
    if (req.item && !items.has(req.item)) E(`${where}: requires item "${req.item}" that is never obtainable -> soft-lock`);
    if (req.flag && !flags.has(req.flag)) E(`${where}: requires flag "${req.flag}" that is never set -> soft-lock`);
  };

  // ---- per-node checks ----
  const edges = new Map(); // nodeId -> [toIds]
  for (const [id, node] of Object.entries(ep.nodes)) {
    edges.set(id, []);
    if (node.ending) {
      const en = node.ending;
      if (!ENDING_TYPES.includes(en.type)) E(`node "${id}": ending.type must be one of ${ENDING_TYPES.join("/")}`);
      if (typeof en.stamp !== "string") E(`node "${id}": ending.stamp must be a string`);
      if (typeof en.text !== "string") E(`node "${id}": ending.text must be a string`);
      continue; // endings are terminal; ignore choices
    }
    if (typeof node.text !== "string") W(`node "${id}": no text`);
    checkEffects(node.onEnter, `node "${id}".onEnter`);
    if (node.sanityText) {
      for (const k of Object.keys(node.sanityText)) {
        if (Number.isNaN(Number(k))) E(`node "${id}": sanityText key "${k}" must be numeric`);
        if (typeof node.sanityText[k] !== "string") E(`node "${id}": sanityText["${k}"] must be a string`);
      }
    }
    const choices = node.choices;
    if (!Array.isArray(choices) || choices.length === 0) { E(`node "${id}": non-ending node has no choices (dead end)`); continue; }

    let hasRealExit = false;
    choices.forEach((c, i) => {
      const where = `node "${id}" choice[${i}]`;
      if (typeof c.text !== "string") E(`${where}: missing text`);
      checkRequires(c.requires, where);
      checkEffects(c.effects, where);
      if (c.to !== undefined) {
        hasRealExit = true;
        if (!ep.nodes[c.to]) E(`${where}: points to non-existent node "${c.to}"`);
        else edges.get(id).push(c.to);
      } else if (c.locked === undefined) {
        E(`${where}: has no "to" and no "locked" hint (goes nowhere)`);
      }
    });
    if (!hasRealExit) E(`node "${id}": every choice is a locked hint with no destination (trap)`);
  }

  // ---- reachability from start ----
  const reached = new Set();
  const stack = ep.nodes[ep.start] ? [ep.start] : [];
  while (stack.length) {
    const id = stack.pop();
    if (reached.has(id)) continue;
    reached.add(id);
    (edges.get(id) || []).forEach((to) => stack.push(to));
  }
  for (const id of nodeIds) if (!reached.has(id)) E(`node "${id}" is unreachable from start (orphan)`);

  // ---- at least one ending reachable ----
  const reachableEndings = [...reached].filter((id) => ep.nodes[id].ending);
  if (reachableEndings.length === 0) E(`no ending is reachable from start (the story can never finish)`);
  const escapes = reachableEndings.filter((id) => ep.nodes[id].ending.type === "escape");
  if (escapes.length === 0) W(`no "escape" (survival) ending is reachable — every path is a bad ending`);

  const report = {
    nodes: nodeIds.length,
    reachable: reached.size,
    endings: reachableEndings.map((id) => ep.nodes[id].ending.type),
    items: [...items],
    flags: [...flags],
  };
  return finish(name, errors, warnings, report);
}

function finish(name, errors, warnings, report) {
  return { name, errors, warnings, report, ok: errors.length === 0 };
}

function printResult(r) {
  const head = r.ok ? `${C.green}PASS${C.reset}` : `${C.red}FAIL${C.reset}`;
  console.log(`\n${C.bold}${r.name}${C.reset}  [${head}]`);
  if (r.report) {
    const rp = r.report;
    console.log(`${C.dim}  ${rp.nodes} nodes (${rp.reachable} reachable) · endings: ${rp.endings.join(", ") || "none"} · items: ${rp.items.join(", ") || "none"} · flags: ${rp.flags.join(", ") || "none"}${C.reset}`);
  }
  r.errors.forEach((m) => console.log(`  ${C.red}ERROR${C.reset} ${m}`));
  r.warnings.forEach((m) => console.log(`  ${C.yellow}warn ${C.reset} ${m}`));
}

function loadEpisodeFiles() {
  const manifest = JSON.parse(readFileSync(join(EPISODES_DIR, "manifest.json"), "utf8"));
  const files = [];
  for (const e of manifest.episodes) if (!e.locked && e.file) files.push(join(EPISODES_DIR, e.file));
  return files;
}

// ---- CLI ----
const isCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
  const args = process.argv.slice(2);
  const files = args.length ? args : loadEpisodeFiles();
  if (!files.length) { console.log("no episodes to validate"); process.exit(0); }
  let failed = 0;
  for (const f of files) {
    let ep;
    try { ep = JSON.parse(readFileSync(f, "utf8")); }
    catch (err) { console.log(`\n${C.bold}${f}${C.reset}  [${C.red}FAIL${C.reset}]\n  ${C.red}ERROR${C.reset} invalid JSON: ${err.message}`); failed++; continue; }
    const r = validateEpisode(ep, ep.id || f);
    printResult(r);
    if (!r.ok) failed++;
  }
  console.log(`\n${failed ? C.red : C.green}${files.length - failed}/${files.length} episodes valid${C.reset}\n`);
  process.exit(failed ? 1 : 0);
}
