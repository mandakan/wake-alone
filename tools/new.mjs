#!/usr/bin/env node
// new.mjs — scaffold a new, already-valid episode and register it in the manifest.
// Usage: node tools/new.mjs --id tycho --title "Signal Lost" --byline "Relay station Tycho-4."
//        [--size short|standard|long] [--punishment gentle|standard|cruel]
//
// With dials, the skeleton is scaled to satisfy that spec's hard floors (node
// count + dead-ending count) so it validates clean from the start. Fill in the
// prose and tune sanity; the spec is your contract -- `npm run validate` checks it.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { resolveSpec, describeBrief } from "./spec.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EP_DIR = join(ROOT, "episodes");

// Build a valid skeleton scaled to a resolved spec (or sensible defaults).
//   escape required (default): wake -> hub; hub branches to an explore chain
//     (plants key, then a `ready` flag) and to N dead endings; the gated escape
//     needs key + ready.
//   escape forbidden: no way out. hub branches to N dead endings and an explore
//     chain that funnels into a death -- every path ends badly, and it validates.
export function buildSkeleton(resolved) {
  const deadMin = resolved && resolved.deadMin != null ? resolved.deadMin : 2;
  const minNodes = resolved && resolved.minNodes != null ? resolved.minNodes : 6;
  const noEscape = resolved && resolved.escape === "forbidden";
  const fixed = noEscape ? 2 : 3; // wake, hub (+ escape)
  const rooms = Math.max(1, minNodes - fixed - deadMin);

  const nodes = {};
  nodes.wake = {
    title: "Where you wake",
    text: "<p>Cold open: where the protagonist surfaces, alone, and the first wrong detail.</p>",
    choices: [
      { text: "Sit up and take stock.", to: "hub" },
      { text: "Lie still and listen too long.", effects: { sanity: -5 }, to: "hub" },
    ],
  };

  const hubChoices = [{ text: "Press deeper into the dark.", to: "room1" }];
  if (!noEscape) {
    hubChoices.push({ text: "Make for the way out.", to: "escape", requires: { item: "key", flag: "ready" }, locked: "The exit won't give -- you're missing something." });
  }
  for (let d = 1; d <= deadMin; d++) {
    nodes[`dead${d}`] = { ending: { type: "dead", stamp: `// DEAD ${d}`, text: `<p>A nasty ending (${d}). Replace this with a specific, earned death.</p>` } };
    hubChoices.push({ text: `A tempting mistake (${d}).`, effects: { sanity: -10 }, to: `dead${d}` });
  }
  nodes.hub = { title: "The hub", text: "<p>The room you keep coming back to. Branch out, then return.</p>", choices: hubChoices };

  for (let r = 1; r <= rooms; r++) {
    const isFirst = r === 1, isLast = r === rooms;
    let onEnter;
    if (!noEscape) {
      // first room plants the key, last room flips `ready`; a single-room chain
      // must do both, or the escape gate can never open.
      if (isFirst && isLast) onEnter = { add: ["key"], flags: { ready: true } };
      else if (isFirst) onEnter = { add: ["key"] };
      else if (isLast) onEnter = { flags: { ready: true } };
    }
    // required: the chain loops back to the hub. forbidden: it funnels into death.
    const to = r < rooms ? `room${r + 1}` : noEscape ? "dead1" : "hub";
    const lastHint = noEscape ? "The dark closes the loop -- this beat ends in death." : "Flip the `ready` flag here.";
    const node = {
      title: `Branch ${r}`,
      text: `<p>Explorable beat ${r}. ${isFirst && !noEscape ? "Plant the key here." : isLast ? lastHint : "Dread, a detail, a small cost."}</p>`,
      choices: [{ text: r < rooms ? "Keep going." : noEscape ? "Walk into it." : "Head back to the hub.", to }],
    };
    if (onEnter) node.onEnter = onEnter;
    nodes[`room${r}`] = node;
  }

  if (!noEscape) {
    nodes.escape = { ending: { type: "escape", stamp: "// LAUNCH", text: "<p>The survival ending -- hard-won. Replace this.</p>" } };
  }
  return nodes;
}

// ---- CLI ----
const isCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) { args[key] = true; } // boolean flag
    else { args[key] = next; i++; }
  }
  const id = args.id;
  if (!id) { console.error('need --id (e.g. --id tycho). optional: --title "..." --byline "..." --size standard --punishment standard'); process.exit(1); }
  const file = `${id}.json`;
  const path = join(EP_DIR, file);
  if (existsSync(path)) { console.error(`episodes/${file} already exists`); process.exit(1); }

  const spec = {};
  if (args.size) spec.size = args.size;
  if (args.punishment) spec.punishment = args.punishment;
  // --escape forbidden, or the shorthand --no-escape, for a no-way-out story.
  if (args.escape) spec.escape = args.escape;
  else if ("no-escape" in args) spec.escape = "forbidden";
  const hasSpec = Object.keys(spec).length > 0;
  const resolved = hasSpec ? resolveSpec(spec) : null;
  if (resolved && resolved.error) { console.error(`bad spec: ${resolved.error}`); process.exit(1); }

  const episode = {
    id,
    title: (args.title || id).toUpperCase(),
    byline: args.byline || "",
    ...(hasSpec ? { spec } : {}),
    start: "wake",
    startSanity: 100,
    startInventory: [],
    nodes: buildSkeleton(resolved),
  };

  writeFileSync(path, JSON.stringify(episode, null, 2) + "\n");

  const manifest = JSON.parse(readFileSync(join(EP_DIR, "manifest.json"), "utf8"));
  manifest.episodes.push({ file, locked: false });
  writeFileSync(join(EP_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(`created episodes/${file} (valid skeleton) and added it to the manifest.`);
  if (hasSpec) console.log(`spec: ${describeBrief(resolved)}`);
  console.log(`next: author the nodes, then  npm run validate  &&  npm run build`);
}
