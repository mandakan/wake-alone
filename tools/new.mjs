#!/usr/bin/env node
// new.mjs — scaffold a new, already-valid episode and register it in the manifest.
// Usage: node tools/new.mjs --id tycho --title "Signal Lost" --byline "Relay station Tycho-4."

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EP_DIR = join(ROOT, "episodes");

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) { args[argv[i].slice(2)] = argv[i + 1]; i++; }
}
const id = args.id;
if (!id) { console.error('need --id (e.g. --id tycho). optional: --title "..." --byline "..."'); process.exit(1); }
const file = `${id}.json`;
const path = join(EP_DIR, file);
if (existsSync(path)) { console.error(`episodes/${file} already exists`); process.exit(1); }

const title = (args.title || id).toUpperCase();
const skeleton = {
  id,
  title,
  byline: args.byline || "",
  start: "wake",
  startSanity: 100,
  startInventory: [],
  nodes: {
    wake: {
      title: "Where you wake",
      text: "<p>Describe the cold open: where the protagonist surfaces, alone, and the first wrong detail.</p>",
      choices: [
        { text: "A first action.", to: "explore" },
        { text: "A second action that costs something.", effects: { sanity: -8 }, to: "explore" }
      ]
    },
    explore: {
      title: "First room",
      text: "<p>Branch out from here. Plant at least one item and one flag on the path to the escape ending.</p>",
      choices: [
        { text: "Reach for the way out.", to: "end_escape" },
        { text: "Look too closely at the wrong thing.", effects: { sanity: -20 }, to: "explore" }
      ]
    },
    end_escape: {
      ending: { type: "escape", stamp: "// LAUNCH", text: "<p>The survival ending.</p>" }
    }
  }
};

writeFileSync(path, JSON.stringify(skeleton, null, 2) + "\n");

const manifest = JSON.parse(readFileSync(join(EP_DIR, "manifest.json"), "utf8"));
manifest.episodes.push({ file, locked: false });
writeFileSync(join(EP_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`created episodes/${file} (valid skeleton) and added it to the manifest.`);
console.log(`next: author the nodes, then  npm run validate  &&  npm run build`);
