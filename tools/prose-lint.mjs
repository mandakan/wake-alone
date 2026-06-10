#!/usr/bin/env node
// prose-lint.mjs — catch the mechanical tells of LLM "slop" in episode prose,
// and (with solver context) state-coherence bugs. Zero deps.
//
// ERRORS (gate the build): non-ASCII punctuation (em-dash, curly quotes, ...) --
// the top visual LLM tells -- and essay/marketing register that never belongs in
// terse second-person horror.
// WARNS (advisory): horror cliches, risky filler, robotic cadence (uniform
// sentence length, repeated openers, "X, Y, and Z" triads, copy-pasted phrases),
// first-person slips, and -- when given solver context -- dead sanityText
// variants and prose that claims an item the player can never hold there.
//
// House style is calibrated to episodes/derelict.json. Used by validate.mjs
// (so CI enforces it) and runnable standalone: node tools/prose-lint.mjs [file...]

// Non-ASCII punctuation -> the ASCII the house style wants instead.
// House style uses a single hyphen "-" for dashes -- never em/en dashes, never
// a doubled "--" (which reads as a failed em-dash substitute).
export const PUNCT_BANS = {
  "—": "-", "–": "-", "‒": "-", "―": "-",
  "“": '"', "”": '"', "„": '"', "‟": '"',
  "‘": "'", "’": "'", "‚": "'", "‛": "'",
  "…": "...", " ": "space", " ": "space", " ": "space",
  "​": "(zero-width)", "﻿": "(zero-width)", "⁠": "(zero-width)",
};

// Essay/marketing register -- effectively never legitimate in this genre. ERROR.
export const SLOP_ERRORS = [
  "delve", "delved", "leverage", "leverages", "seamless", "seamlessly",
  "paradigm", "holistic", "multifaceted", "game-changer", "game changer",
  "synergy", "cutting-edge", "state-of-the-art", "it's worth noting",
  "in conclusion", "a testament to", "rich tapestry", "tapestry of",
  "navigating the complexities", "in the realm of",
];

// Filler that is usually-but-not-always slop. WARN.
export const SLOP_WARNS = [
  "ultimately", "myriad", "plethora", "palpable", "stark reminder",
  "beacon", "bustling", "paramount", "that said", "needless to say",
];

// Genre cliches -- the horror equivalents of slop. WARN.
export const HORROR_CLICHES = [
  "blood ran cold", "blood runs cold", "shiver down your spine",
  "shivers down your spine", "chill down your spine", "heart pounded",
  "heart hammered", "heart raced", "deafening silence", "eerie silence",
  "dead silence", "little did you", "sent a chill", "chill ran",
  "spine-chilling", "bone-chilling", "without warning", "or so you thought",
  "pitch black", "ice in your veins", "hair on the back of your neck",
  "frozen in fear", "couldn't believe your eyes",
];

const stripTags = (s) => (typeof s === "string" ? s.replace(/<[^>]*>/g, " ") : "");
const stripQuoted = (s) => s.replace(/"[^"]*"/g, " "); // exempt dialogue / logs
const sentencesOf = (s) => s.split(/[.!?]+/).map((x) => x.trim()).filter(Boolean);
const wordsOf = (s) => s.match(/[A-Za-z'-]+/g) || [];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasPhrase = (text, p) => new RegExp(`(?:^|[^A-Za-z])${escapeRe(p)}(?:[^A-Za-z]|$)`, "i").test(text);

// Lint a single text field. Returns { errors, warnings } of message strings.
function lintField(raw, where) {
  const errors = [], warnings = [];
  if (typeof raw !== "string" || !raw.trim()) return { errors, warnings };

  // 1. non-ASCII punctuation (ERROR)
  for (const ch of raw) {
    if (PUNCT_BANS[ch]) {
      errors.push(`${where}: non-ASCII "${ch}" (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}) -- use ${PUNCT_BANS[ch]}`);
    }
  }
  const plain = stripTags(raw);
  // 2. doubled dashes (ERROR) -- stories use a single hyphen for dashes
  const dd = plain.match(/-{2,}/g);
  if (dd) errors.push(`${where}: doubled dash (x${dd.length}) -- use a single hyphen "-"`);
  // 3. essay/marketing register (ERROR)
  for (const p of SLOP_ERRORS) if (hasPhrase(plain, p)) errors.push(`${where}: slop phrase "${p}" -- never in this voice`);
  // 3. filler + genre cliches (WARN)
  for (const p of SLOP_WARNS) if (hasPhrase(plain, p)) warnings.push(`${where}: filler "${p}" (consider cutting)`);
  for (const p of HORROR_CLICHES) if (hasPhrase(plain, p)) warnings.push(`${where}: horror cliche "${p}"`);
  // 4. first-person slips outside quoted speech (WARN) -- voice is 2nd person
  const fp = stripQuoted(plain).match(/(?:^|[^A-Za-z])(I|I'm|I've|we|we're|us|our|my)(?:[^A-Za-z]|$)/g);
  if (fp && fp.length) warnings.push(`${where}: first-person (${fp.map((s) => s.replace(/[^A-Za-z']/g, "")).join(", ")}) breaks the second-person voice`);

  return { errors, warnings };
}

// Collect every prose field of a node: [where, raw, isNarrative]. Choice labels
// are navigation UI -- they get punctuation/slop/voice checks but are excluded
// from cadence/repetition analysis (a hub naturally reuses "Back to the ...").
function nodeFields(id, node) {
  const fields = [];
  if (node.text) fields.push([`node "${id}".text`, node.text, true]);
  if (node.sanityText) for (const [k, v] of Object.entries(node.sanityText)) fields.push([`node "${id}".sanityText["${k}"]`, v, true]);
  (node.choices || []).forEach((c, i) => {
    if (c.text) fields.push([`node "${id}" choice[${i}].text`, c.text, false]);
    if (c.locked) fields.push([`node "${id}" choice[${i}].locked`, c.locked, false]);
  });
  if (node.ending && node.ending.text) fields.push([`node "${id}".ending.text`, node.ending.text, true]);
  return fields;
}

// Full episode lint. ctx (optional) = { nodeItems: Map<id,Set>, nodeMinSanity:
// Map<id,number>, items: Set, itemNames: object } enables state-coherence checks.
export function lintProse(ep, ctx = {}) {
  const errors = [], warnings = [];
  if (!ep || typeof ep.nodes !== "object" || !ep.nodes) return { errors, warnings };

  const allSentenceLens = [];
  const openers = {};
  const phraseCounts = {};
  const triadCounts = {};
  let scaffoldTotal = 0; // L15: "the way X" simile-scaffold uses across the episode
  const STOP = ["you", "your", "the", "a", "an", "it", "and"];
  const TRIAD_RE = /\w+,\s+\w+,\s+and\s+\w+/g;
  const SCAFFOLD_RE = /\bthe way\b/gi;
  const SCAFFOLD_MAX = 5;

  for (const [id, node] of Object.entries(ep.nodes)) {
    const renderings = [];
    for (const [where, raw, isNarrative] of nodeFields(id, node)) {
      const r = lintField(raw, where);
      errors.push(...r.errors); warnings.push(...r.warnings);
      if (isNarrative) renderings.push(stripTags(raw)); // base text + each sanityText variant + ending
    }
    // A node renders exactly ONE of its narrative texts per visit: the base text,
    // or one sanityText variant (lowest matching threshold). They are mutually
    // exclusive, so repetition BETWEEN a node's own renderings is never seen on
    // screen. Count each node's worst single rendering (max), then aggregate
    // across nodes -- this lets a hub describe the same gauge in its base text and
    // in every low-sanity variant without tripping the repetition checks, while
    // genuine reuse across *different* nodes still accrues.
    const nodeOpeners = {}, nodePhrases = {}, nodeTriads = {};
    let nodeScaffold = 0;
    for (const plain of renderings) {
      const locOpen = {}, locPhrase = {}, locTriad = {};
      nodeScaffold = Math.max(nodeScaffold, (plain.match(SCAFFOLD_RE) || []).length);
      for (const sent of sentencesOf(plain)) {
        const w = wordsOf(sent);
        if (!w.length) continue;
        allSentenceLens.push(w.length);
        const first = w[0].toLowerCase();
        if (!STOP.includes(first)) locOpen[first] = (locOpen[first] || 0) + 1;
      }
      const toks = wordsOf(plain.toLowerCase());
      for (let i = 0; i + 4 <= toks.length; i++) {
        const g = toks.slice(i, i + 4).join(" ");
        locPhrase[g] = (locPhrase[g] || 0) + 1;
      }
      for (const m of (plain.match(TRIAD_RE) || [])) {
        const k = m.toLowerCase().replace(/\s+/g, " ");
        locTriad[k] = (locTriad[k] || 0) + 1;
      }
      for (const [k, v] of Object.entries(locOpen)) nodeOpeners[k] = Math.max(nodeOpeners[k] || 0, v);
      for (const [k, v] of Object.entries(locPhrase)) nodePhrases[k] = Math.max(nodePhrases[k] || 0, v);
      for (const [k, v] of Object.entries(locTriad)) nodeTriads[k] = Math.max(nodeTriads[k] || 0, v);
    }
    for (const [k, v] of Object.entries(nodeOpeners)) openers[k] = (openers[k] || 0) + v;
    for (const [k, v] of Object.entries(nodePhrases)) phraseCounts[k] = (phraseCounts[k] || 0) + v;
    for (const [k, v] of Object.entries(nodeTriads)) triadCounts[k] = (triadCounts[k] || 0) + v;
    scaffoldTotal += nodeScaffold;
  }

  // cadence: uniform sentence length reads as robotic
  if (allSentenceLens.length >= 12) {
    const mean = allSentenceLens.reduce((a, b) => a + b, 0) / allSentenceLens.length;
    const sd = Math.sqrt(allSentenceLens.reduce((a, b) => a + (b - mean) ** 2, 0) / allSentenceLens.length);
    if (mean > 0 && sd / mean < 0.35) warnings.push(`cadence: sentence lengths are uniform (mean ${mean.toFixed(1)}, stdev ${sd.toFixed(1)}); vary rhythm so it doesn't read mechanically`);
  }
  // repeated sentence openers
  for (const [w, n] of Object.entries(openers)) {
    if (n >= 4) warnings.push(`cadence: ${n} sentences open with "${w}" (repetitive)`);
  }
  // "X, Y, and Z" triads
  const totalTriads = Object.values(triadCounts).reduce((a, b) => a + b, 0);
  if (totalTriads >= 3) warnings.push(`cadence: ${totalTriads} "X, Y, and Z" triads -- a classic LLM rhythm; break some up`);
  // copy-pasted phrases
  for (const [g, n] of Object.entries(phraseCounts)) {
    if (n >= 3) warnings.push(`cadence: phrase "${g}" repeats ${n}x across the episode`);
  }
  // L15: one simile scaffold must not become the episode's default move
  if (scaffoldTotal > SCAFFOLD_MAX) {
    warnings.push(`cadence: the "the way ..." simile scaffold appears ${scaffoldTotal}x across the episode (advisory max ${SCAFFOLD_MAX}); one comparison frame is becoming the default move -- recast the excess (L15)`);
  }

  // ---- state-coherence (needs solver context) ----
  const { nodeItems, nodeMinSanity, items, itemNames } = ctx;
  if (nodeMinSanity) {
    for (const [id, node] of Object.entries(ep.nodes)) {
      if (!node.sanityText) continue;
      const minS = nodeMinSanity.get(id);
      if (minS === undefined) continue; // unreachable: structural check owns it
      for (const k of Object.keys(node.sanityText)) {
        const K = Number(k);
        if (!Number.isNaN(K) && minS > K) {
          warnings.push(`node "${id}": sanityText["${k}"] never displays -- the node is never entered at <= ${k} sanity (min reachable here is ${minS})`);
        }
      }
    }
  }
  if (nodeItems && items) {
    for (const [id, node] of Object.entries(ep.nodes)) {
      const held = nodeItems.get(id);
      if (held === undefined) continue;
      const plain = stripTags(node.text || "") + " " + (node.ending ? stripTags(node.ending.text || "") : "");
      for (const it of items) {
        if (held.has(it)) continue; // player can hold it here -> fine
        // "your <id>" / "your <label>" implies possession the player can't have here
        const names = [it, itemNames && itemNames[it]].filter(Boolean);
        for (const nm of names) {
          if (new RegExp(`\\byour\\s+${escapeRe(nm)}\\b`, "i").test(plain)) {
            warnings.push(`node "${id}": prose says "your ${nm}" but the player can never hold "${it}" here (state-incoherent)`);
            break;
          }
        }
      }
    }
  }

  return { errors, warnings };
}

// ---- CLI (text checks only; run validate for full solver-backed coherence) ----
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const isCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
  const files = process.argv.slice(2);
  if (!files.length) { console.log("usage: node tools/prose-lint.mjs episodes/foo.json [...]"); process.exit(0); }
  let failed = 0;
  for (const f of files) {
    let ep; try { ep = JSON.parse(readFileSync(f, "utf8")); } catch (e) { console.log(`${f}: invalid JSON: ${e.message}`); failed++; continue; }
    const { errors, warnings } = lintProse(ep);
    console.log(`\n${f}  [${errors.length ? "FAIL" : "ok"}]`);
    errors.forEach((m) => console.log(`  ERROR ${m}`));
    warnings.forEach((m) => console.log(`  warn  ${m}`));
    if (errors.length) failed++;
  }
  process.exit(failed ? 1 : 0);
}
