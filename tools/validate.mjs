#!/usr/bin/env node
// validate.mjs — zero-dependency validator for WAKE ALONE episodes.
//
// Structural checks (graph shape):
//   - choices pointing at non-existent nodes
//   - unreachable / orphan nodes
//   - dead-end nodes with no usable exit
//   - no reachable ending (story can't finish)
//   - required item/flag that is never obtainable (soft-lock)
//   - typos in requires/effects keys that silently disable a gate
//
// Semantic checks (a sanity-aware solver that mirrors the engine runtime):
//   - SOLVABILITY: at least one survivable path actually reaches an "escape"
//     ending without sanity hitting 0 first. Structural reachability is not
//     enough — sanity costs and sanity/item/flag gates are honoured. An episode
//     that is winnable-on-the-map but unwinnable-in-practice is an ERROR.
//   - NASTY ENDINGS: a horror episode should offer a few reachable "dead"
//     endings (warn below MIN_DEAD_ENDINGS).
//   - dead choices (a `requires` that can never be met in any reachable state)
//   - dead items / flags (added or set but never read by any gate)
//
// The solver models the engine precisely: onEnter fires once per node, sanity
// clamps to 0..100, sanity <= 0 at a non-ending point is instant madness, and
// med-gel is a free +25 action usable at ANY node while held (inventory dedups,
// so at most one is held at a time).
//
// Usage:  node tools/validate.mjs [--json] [episodes/foo.json ...]
//         (no file args -> validate every non-locked episode in the manifest)
// Exit code 0 = all valid; 1 = at least one ERROR.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { resolveSpec, estimateMinutes } from "./spec.mjs";
import { lintProse } from "./prose-lint.mjs";

let ITEM_NAMES = {};
try { ITEM_NAMES = JSON.parse(readFileSync(join(EPISODES_DIR, "..", "engine", "item-names.json"), "utf8")); } catch {}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EPISODES_DIR = join(ROOT, "episodes");

const ENDING_TYPES = ["escape", "dead", "madness"];
const REQUIRE_KEYS = ["item", "notItem", "flag", "notFlag", "sanityMin", "sanityMax"];
const EFFECT_KEYS = ["sanity", "add", "remove", "flags"];
const MIN_DEAD_ENDINGS = 2;     // horror wants a few nasty ways to die
const MAX_STATES = 2_000_000;   // solver safety cap (episodes are tiny; this never trips in practice)

const C = { red:"\x1b[31m", yellow:"\x1b[33m", green:"\x1b[32m", dim:"\x1b[2m", bold:"\x1b[1m", reset:"\x1b[0m" };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// crude word count: strip tags, collapse whitespace, count tokens.
const words = (s) => (typeof s === "string" ? (s.replace(/<[^>]*>/g, " ").trim().match(/\S+/g) || []).length : 0);
function episodeWordCount(ep) {
  let n = 0;
  for (const node of Object.values(ep.nodes)) {
    n += words(node.text);
    if (node.sanityText) for (const v of Object.values(node.sanityText)) n += words(v);
    (node.choices || []).forEach((c) => { n += words(c.text); n += words(c.locked); });
    if (node.ending) n += words(node.ending.text);
  }
  return n;
}

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

  // ---- optional protagonist profile (informs hint calibration; stripped at build) ----
  let character = null;
  if (ep.character !== undefined) {
    const c = ep.character;
    if (typeof c !== "object" || c === null || Array.isArray(c)) E(`character must be an object {role, expertise, backstory}`);
    else {
      if (c.role !== undefined && typeof c.role !== "string") E(`character.role must be a string`);
      if (c.expertise !== undefined && !Array.isArray(c.expertise)) E(`character.expertise must be an array of domain strings`);
      if (c.backstory !== undefined && typeof c.backstory !== "string") E(`character.backstory must be a string`);
      for (const k of Object.keys(c)) if (!["role", "expertise", "backstory"].includes(k)) W(`character: unknown key "${k}" (use role/expertise/backstory)`);
      character = { role: c.role ?? null, expertise: Array.isArray(c.expertise) ? c.expertise : [] };
    }
  }

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
    if (eff.flags) Object.keys(eff.flags).forEach((f) => { if (eff.flags[f]) flags.add(f); });
  };
  for (const n of Object.values(ep.nodes)) {
    collect(n.onEnter);
    (n.choices || []).forEach((c) => collect(c.effects));
  }

  // ---- references, for dead item/flag detection ----
  const reqItems = new Set();   // items read by a gate
  const removedItems = new Set(); // items consumed by an effect
  const reqFlags = new Set();    // flags read by a gate
  const noteRefs = (req, eff) => {
    if (req) {
      if (req.item) reqItems.add(req.item);
      if (req.notItem) reqItems.add(req.notItem);
      if (req.flag) reqFlags.add(req.flag);
      if (req.notFlag) reqFlags.add(req.notFlag);
    }
    if (eff) (eff.remove || []).forEach((i) => removedItems.add(i));
  };

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
      checkEffects(node.onEnter, `node "${id}".onEnter`);
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
      noteRefs(c.requires, c.effects);
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

  // ---- structural reachability from start (ignores sanity/gates) ----
  const reached = new Set();
  const stack = ep.nodes[ep.start] ? [ep.start] : [];
  while (stack.length) {
    const id = stack.pop();
    if (reached.has(id)) continue;
    reached.add(id);
    (edges.get(id) || []).forEach((to) => stack.push(to));
  }
  for (const id of nodeIds) if (!reached.has(id)) E(`node "${id}" is unreachable from start (orphan)`);

  const reachableEndings = [...reached].filter((id) => ep.nodes[id].ending);
  if (reachableEndings.length === 0) E(`no ending is reachable from start (the story can never finish)`);
  const structuralEscapes = reachableEndings.filter((id) => ep.nodes[id].ending.type === "escape");

  // ---- optional generation spec (size / punishment / escape dials) ----
  const resolved = resolveSpec(ep.spec);
  if (resolved && resolved.error) E(`spec: ${resolved.error}`);
  // "required" (default): a survivable escape must exist. "forbidden": the
  // episode is meant to have no way out -- escapes are an error, but it must
  // still be completable (some dead/madness ending is reachable).
  const escapeMode = resolved && resolved.escape ? resolved.escape : "required";

  // ---- sanity-aware solver (only when the graph is sound enough to walk) ----
  let solver = null;
  const danglingRefs = errors.some((m) => m.includes("non-existent node"));
  if (ep.nodes[ep.start] && !danglingRefs) {
    try { solver = solve(ep); }
    catch (err) { W(`solver could not run (internal: ${err.message}); solvability not verified`); }
  }

  if (solver) {
    if (solver.startMadness) {
      E(`start node "${ep.start}" drops sanity to 0 on entry (instant madness; unplayable)`);
    } else if (escapeMode === "forbidden") {
      // no-way-out story: escapes are an error; it must still be able to end.
      const escapeNodes = nodeIds.filter((id) => ep.nodes[id].ending && ep.nodes[id].ending.type === "escape");
      if (escapeNodes.length) {
        E(`spec(escape=forbidden): this episode is meant to have no way out, but ${escapeNodes.length} "escape" ending(s) exist (${escapeNodes.join(", ")})`);
      }
      if (!solver.truncated && solver.deadEndings.size === 0 && !solver.madnessReachable) {
        E(`spec(escape=forbidden): no "dead" or madness ending is reachable -- the run can never actually end`);
      }
    } else if (!solver.winnable) {
      if (solver.truncated) {
        W(`solvability not fully verified: state space hit the ${MAX_STATES.toLocaleString()} cap before an escape was found`);
      } else if (structuralEscapes.length === 0) {
        E(`unwinnable: no "escape" ending is reachable at all (every path dies). ` +
          `If that is intended, declare spec.escape = "forbidden".`);
      } else {
        E(`unwinnable: an "escape" ending exists but no survivable path reaches it ` +
          `(every route forces sanity to 0 or fails a gate). Lower forced sanity loss or add restores.`);
      }
    }

    // nasty-ending coverage. When a punishment spec declares a deadMin, that
    // becomes a hard floor (handled in the spec block below); otherwise this is
    // the universal advisory.
    const specDeadMin = resolved && !resolved.error ? resolved.deadMin : undefined;
    if (specDeadMin === undefined && !solver.truncated && solver.deadEndings.size < MIN_DEAD_ENDINGS) {
      W(`only ${solver.deadEndings.size} reachable "dead" ending(s); a horror episode should offer ` +
        `a few nasty ways to die (>= ${MIN_DEAD_ENDINGS} recommended)`);
    }

    // choice integrity: a clickable choice must have a real destination, and a
    // gate that never opens is dead weight.
    for (const [id, node] of Object.entries(ep.nodes)) {
      if (node.ending || !Array.isArray(node.choices)) continue;
      node.choices.forEach((c, i) => {
        const openable = solver.openableChoices.has(`${id}#${i}`);
        const toResolves = c.to !== undefined && !!ep.nodes[c.to];
        // clickable-but-goes-nowhere -> the engine calls goto(undefined) and crashes.
        // This happens when a "locked" hint is written with a satisfiable gate
        // (e.g. notItem on an item you might not hold) instead of a real "to".
        if (openable && !toResolves) {
          E(`node "${id}" choice[${i}]: clickable (its requirements can be satisfied) but has no valid "to" -- the engine crashes on click. Give it a real destination, or write the locked state as the positive gate on the real choice (requires the thing + a "locked" hint), not an inverted gate with no "to".`);
        }
        if (!solver.truncated && c.requires && reached.has(id) && !openable) {
          W(`node "${id}" choice[${i}]: requires never met in any reachable state (dead choice)`);
        }
      });
    }
  }

  // ---- metrics + spec thresholds ----
  const wordCount = episodeWordCount(ep);
  const optimalSteps = solver && solver.bestEscape ? solver.bestEscape.path.length : null;
  const estMinutes = solver ? estimateMinutes(wordCount, optimalSteps || 0) : null;
  let deathRatio = null, escapeCount = null, deadCount = null;
  if (solver && !solver.truncated) {
    escapeCount = solver.escapeEndings.size;
    deadCount = solver.deadEndings.size;
    const total = escapeCount + deadCount;
    deathRatio = total ? deadCount / total : 0;
  }

  if (solver && !solver.truncated && resolved && !resolved.error) {
    const tag = [resolved.size && `size=${resolved.size}`, resolved.punishment && `punishment=${resolved.punishment}`].filter(Boolean).join(",");
    // size -> node-count budget (hard)
    if (resolved.minNodes != null && (nodeIds.length < resolved.minNodes || nodeIds.length > resolved.maxNodes)) {
      E(`spec(${tag}): ${nodeIds.length} nodes outside the ${resolved.minNodes}-${resolved.maxNodes} range for size "${resolved.size}"`);
    }
    // punishment -> dead-ending floor + death ratio (hard)
    if (resolved.deadMin != null && deadCount < resolved.deadMin) {
      E(`spec(${tag}): ${deadCount} reachable "dead" ending(s); punishment "${resolved.punishment}" wants >= ${resolved.deadMin}`);
    }
    if (resolved.deathRatioFloor != null && deathRatio < resolved.deathRatioFloor) {
      E(`spec(${tag}): death ratio ${Math.round(deathRatio * 100)}% below the ${Math.round(resolved.deathRatioFloor * 100)}% floor for punishment "${resolved.punishment}"`);
    }
    // punishment -> losable to madness (advisory)
    if (resolved.expectMadness && !solver.madnessReachable) {
      W(`spec(${tag}): punishment "${resolved.punishment}" expects the run to be losable to madness, but sanity 0 is never reachable`);
    }
    // size -> play-time (advisory, derived)
    if (resolved.minMinutes != null && (estMinutes < resolved.minMinutes || estMinutes > resolved.maxMinutes)) {
      W(`spec(${tag}): est. play-time ~${estMinutes} min outside the ${resolved.minMinutes}-${resolved.maxMinutes} min range for size "${resolved.size}" (advisory)`);
    }
  }

  // ---- dead items / flags (static) ----
  for (const it of items) {
    if (it === "medgel") continue; // consumed via the always-available HUD button
    if (!reqItems.has(it) && !removedItems.has(it)) W(`item "${it}" is obtained but never required or consumed (dead item?)`);
  }
  for (const fl of flags) {
    if (!reqFlags.has(fl)) W(`flag "${fl}" is set but never read by any gate (dead flag?)`);
  }

  // ---- prose hygiene + state-coherence (slop linter) ----
  const prose = lintProse(ep, {
    nodeItems: solver ? solver.nodeItems : undefined,
    nodeMinSanity: solver ? solver.nodeMinSanity : undefined,
    items,
    itemNames: ITEM_NAMES,
  });
  prose.errors.forEach(E);
  prose.warnings.forEach(W);

  const report = {
    nodes: nodeIds.length,
    reachable: reached.size,
    endings: reachableEndings.map((id) => ep.nodes[id].ending.type),
    items: [...items],
    flags: [...flags],
    winnable: solver ? !!solver.winnable : null,
    bestEscapeSanity: solver ? solver.bestEscape && solver.bestEscape.sanity : null,
    bestEscapePath: solver ? solver.bestEscape && solver.bestEscape.path : null,
    deadEndings: solver ? solver.deadEndings.size : null,
    escapeEndings: solver ? solver.escapeEndings.size : null,
    madnessReachable: solver ? solver.madnessReachable : null,
    statesExplored: solver ? solver.statesExplored : null,
    truncated: solver ? solver.truncated : null,
    spec: resolved && !resolved.error ? { size: resolved.size, punishment: resolved.punishment, escape: resolved.escape } : null,
    character,
    escape: escapeMode,
    words: wordCount,
    estMinutes,
    optimalSteps,
    deathRatio: deathRatio == null ? null : Math.round(deathRatio * 100) / 100,
  };
  return finish(name, errors, warnings, report);
}

// ---- the solver: mirrors engine/template.html runtime exactly ----
function solve(ep) {
  const nodeHasOnEnter = (id) => !!(ep.nodes[id] && ep.nodes[id].onEnter);

  const meetsReq = (req, st) => {
    if (!req) return true;
    if (req.item && !st.inv.has(req.item)) return false;
    if (req.notItem && st.inv.has(req.notItem)) return false;
    if (typeof req.sanityMax === "number" && st.sanity > req.sanityMax) return false;
    if (typeof req.sanityMin === "number" && st.sanity < req.sanityMin) return false;
    if (req.flag && !st.flags.has(req.flag)) return false;
    if (req.notFlag && st.flags.has(req.notFlag)) return false;
    return true;
  };
  const applyEff = (eff, st) => {
    let sanity = st.sanity;
    const inv = new Set(st.inv);
    const flags = new Set(st.flags);
    if (eff) {
      if (typeof eff.sanity === "number") sanity = clamp(sanity + eff.sanity, 0, 100);
      (eff.add || []).forEach((i) => inv.add(i));
      (eff.remove || []).forEach((i) => inv.delete(i));
      if (eff.flags) for (const [k, v] of Object.entries(eff.flags)) { if (v) flags.add(k); else flags.delete(k); }
    }
    return { sanity, inv, flags };
  };
  const keyOf = (st) =>
    `${st.cur}|${st.sanity}|${[...st.inv].sort().join(",")}|${[...st.flags].sort().join(",")}|${[...st.entered].sort().join(",")}`;

  // initial state: startEpisode + goto(start) applying start's onEnter once
  let init = {
    cur: ep.start,
    sanity: clamp(ep.startSanity ?? 100, 0, 100),
    inv: new Set(ep.startInventory || []),
    flags: new Set(),
    entered: new Set(),
  };
  const startNode = ep.nodes[ep.start];
  if (startNode.onEnter) {
    const r = applyEff(startNode.onEnter, init);
    init = { cur: init.cur, sanity: r.sanity, inv: r.inv, flags: r.flags, entered: new Set([ep.start]) };
  }
  if (init.sanity <= 0 && !startNode.ending) {
    return { startMadness: true, winnable: false, escapeEndings: new Set(), deadEndings: new Set(),
      madnessReachable: true, openableChoices: new Set(), bestEscape: null, statesExplored: 0, truncated: false,
      nodeItems: new Map(), nodeMinSanity: new Map() };
  }

  const escapeEndings = new Set();
  const deadEndings = new Set();
  const openableChoices = new Set();
  const nodeItems = new Map();      // nodeId -> Set of items possibly held when at the node
  const nodeMinSanity = new Map();  // nodeId -> lowest sanity the node is ever rendered at
  let madnessReachable = false;
  let bestEscape = null; // {node, sanity, path}

  const visited = new Set();
  const parent = new Map(); // key -> {prev, label}
  const startKey = keyOf(init);
  visited.add(startKey);
  parent.set(startKey, null);
  const queue = [{ st: init, key: startKey }];
  let truncated = false;

  const pathTo = (key) => {
    const labels = [];
    let k = key;
    while (k && parent.get(k)) { labels.push(parent.get(k).label); k = parent.get(k).prev; }
    return labels.reverse();
  };
  const enqueue = (st, prevKey, label) => {
    const k = keyOf(st);
    if (visited.has(k)) return;
    visited.add(k);
    parent.set(k, { prev: prevKey, label });
    queue.push({ st, key: k });
  };

  while (queue.length) {
    if (visited.size > MAX_STATES) { truncated = true; break; }
    const { st, key } = queue.shift();
    const node = ep.nodes[st.cur];

    // record what is true at this node, for prose state-coherence
    if (!nodeItems.has(st.cur)) nodeItems.set(st.cur, new Set());
    const bag = nodeItems.get(st.cur);
    for (const it of st.inv) bag.add(it);
    const prevMin = nodeMinSanity.get(st.cur);
    nodeMinSanity.set(st.cur, prevMin === undefined ? st.sanity : Math.min(prevMin, st.sanity));

    if (node.ending) {
      if (node.ending.type === "escape") {
        escapeEndings.add(st.cur);
        if (!bestEscape || st.sanity > bestEscape.sanity) bestEscape = { node: st.cur, sanity: st.sanity, path: pathTo(key) };
      } else if (node.ending.type === "dead") {
        deadEndings.add(st.cur);
      } else if (node.ending.type === "madness") {
        madnessReachable = true;
      }
      continue; // terminal
    }

    // free action: use med-gel (any node, while held)
    if (st.inv.has("medgel")) {
      const r = applyEff({ sanity: +25, remove: ["medgel"] }, st);
      enqueue({ cur: st.cur, sanity: r.sanity, inv: r.inv, flags: r.flags, entered: st.entered }, key, "use med-gel [+25]");
    }

    // choices
    const choices = Array.isArray(node.choices) ? node.choices : [];
    choices.forEach((c, i) => {
      if (!meetsReq(c.requires, st)) return;
      openableChoices.add(`${st.cur}#${i}`);
      if (c.to === undefined || !ep.nodes[c.to]) return; // locked hint / dangling (dangling already an error)

      const afterChoice = applyEff(c.effects, st);
      if (afterChoice.sanity <= 0) { madnessReachable = true; return; } // choose(): madness before goto

      // goto(c.to): apply target's onEnter once
      let sanity = afterChoice.sanity, inv = afterChoice.inv, flags = afterChoice.flags, entered = st.entered;
      if (nodeHasOnEnter(c.to) && !st.entered.has(c.to)) {
        const r = applyEff(ep.nodes[c.to].onEnter, { sanity, inv, flags });
        sanity = r.sanity; inv = r.inv; flags = r.flags;
        entered = new Set(st.entered); entered.add(c.to);
      }
      const target = ep.nodes[c.to];
      if (sanity <= 0 && !target.ending) { madnessReachable = true; return; } // goto(): madness on entry

      const label = `${st.cur} -> ${c.to}` + (c.text ? ` ("${String(c.text).slice(0, 40)}")` : "");
      enqueue({ cur: c.to, sanity, inv, flags, entered }, key, label);
    });
  }

  return {
    startMadness: false,
    winnable: escapeEndings.size > 0,
    escapeEndings, deadEndings, madnessReachable, openableChoices,
    bestEscape, statesExplored: visited.size, truncated,
    nodeItems, nodeMinSanity,
  };
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
    if (rp.winnable !== null) {
      const solv = rp.winnable
        ? `${C.green}solvable${C.reset} (best escape: ${rp.bestEscapeSanity}% sanity, ${rp.bestEscapePath ? rp.bestEscapePath.length : "?"} steps)`
        : rp.escape === "forbidden"
          ? `${C.dim}no escape (by design)${C.reset}`
          : `${C.red}UNWINNABLE${C.reset}`;
      console.log(`${C.dim}  solver: ${solv}${C.dim} · dead endings: ${rp.deadEndings} · madness reachable: ${rp.madnessReachable ? "yes" : "no"} · states: ${rp.statesExplored}${rp.truncated ? " (truncated)" : ""}${C.reset}`);
      const ratio = rp.deathRatio == null ? "?" : `${Math.round(rp.deathRatio * 100)}%`;
      console.log(`${C.dim}  metrics: ${rp.words} words · ~${rp.estMinutes} min · death ratio ${ratio}${rp.spec ? ` · spec: ${[rp.spec.size && `size=${rp.spec.size}`, rp.spec.punishment && `punishment=${rp.spec.punishment}`, rp.spec.escape === "forbidden" && "escape=forbidden"].filter(Boolean).join(", ")}` : ""}${C.reset}`);
      if (rp.character) console.log(`${C.dim}  character: ${rp.character.role || "(unspecified role)"}${rp.character.expertise.length ? ` · knows: ${rp.character.expertise.join(", ")}` : ""}${C.reset}`);
    }
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
  const jsonMode = args.includes("--json");
  const files = args.filter((a) => a !== "--json");
  const targets = files.length ? files : loadEpisodeFiles();
  if (!targets.length) {
    if (jsonMode) console.log("[]"); else console.log("no episodes to validate");
    process.exit(0);
  }
  let failed = 0;
  const results = [];
  for (const f of targets) {
    let ep;
    try { ep = JSON.parse(readFileSync(f, "utf8")); }
    catch (err) {
      failed++;
      const r = { name: f, errors: [`invalid JSON: ${err.message}`], warnings: [], report: null, ok: false };
      results.push(r);
      if (!jsonMode) printResult(r);
      continue;
    }
    const r = validateEpisode(ep, ep.id || f);
    results.push(r);
    if (!jsonMode) printResult(r);
    if (!r.ok) failed++;
  }
  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`\n${failed ? C.red : C.green}${targets.length - failed}/${targets.length} episodes valid${C.reset}\n`);
  }
  process.exit(failed ? 1 : 0);
}
