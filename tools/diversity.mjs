#!/usr/bin/env node
// diversity.mjs — cross-episode diversity check for the WAKE ALONE anthology.
// Zero deps, deterministic, ADVISORY ONLY (warnings, never errors). The sibling of
// prose-lint.mjs: prose-lint catches copy-paste WITHIN one episode; this catches
// sameness ACROSS episodes, with openings treated as the priority.
//
// Two signals:
//   1. Shared distinctive phrases — N-gram shingles that recur across episodes,
//      minus stopword-only shingles and minus the curated motif allowlist.
//   2. Opening similarity — TF-IDF cosine between each episode's opening (the
//      first-choice path from `start`, capped at openingWords). idf naturally
//      down-weights premise words (wake/cold/alone) since they appear everywhere.
//
// Dials live in diversity-config.mjs; intentional motifs in diversity-allow.txt.
// Run: node tools/diversity.mjs [episodes/foo.json ...]   (no args -> whole manifest)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { DIVERSITY } from "./diversity-config.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// Common English + premise vocabulary. A shingle made ENTIRELY of these is too
// generic to be a "distinctive" shared phrase, so Signal 1 skips it. (Signal 2
// does not need this list — idf neutralises ubiquitous words on its own.)
const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","of","to","in","on","at","by","for","with",
  "from","into","out","up","down","over","under","off","as","is","are","was","were",
  "be","been","being","it","its","this","that","these","those","you","your","yours",
  "he","she","they","them","his","her","their","not","no","nor","so","than","then",
  "there","here","when","where","what","which","who","how","all","any","one","two",
  "do","does","did","have","has","had","will","would","can","could","still","like",
  // premise vocabulary — every episode opens on this; not distinctive
  "wake","woke","waking","wakes","cold","dark","alone","ship","hull","cryo","pod",
  "airlock","light","dark","void","stars","silence","cuff","berth","frost","corridor",
]);

const stripTags = (s) => (typeof s === "string" ? s.replace(/<[^>]*>/g, " ") : "");
const wordsOf = (s) => (stripTags(s).toLowerCase().match(/[a-z'-]+/g) || []);

// All narrative prose of an episode, concatenated: node.text + sanityText values +
// ending.text. Choice text/locked are navigation UI and are excluded (a hub
// legitimately repeats "Back to the room").
function narrativeTokens(ep) {
  const parts = [];
  for (const node of Object.values(ep.nodes || {})) {
    if (node.text) parts.push(node.text);
    if (node.sanityText) for (const v of Object.values(node.sanityText)) parts.push(v);
    if (node.ending && node.ending.text) parts.push(node.ending.text);
  }
  return wordsOf(parts.join(" "));
}

// The opening: walk from `start`, append each node's narrative text, follow the
// FIRST choice, stop at an ending / a revisit / once we have maxWords words.
function openingTokens(ep, maxWords) {
  const seen = new Set();
  const words = [];
  let id = ep.start;
  while (id && !seen.has(id) && words.length < maxWords) {
    seen.add(id);
    const node = (ep.nodes || {})[id];
    if (!node) break;
    if (node.ending) { words.push(...wordsOf(node.ending.text || "")); break; }
    words.push(...wordsOf(node.text || ""));
    const ch = (node.choices || [])[0];
    id = ch && ch.to;
  }
  return words.slice(0, maxWords);
}

function shingleSet(tokens, n) {
  const s = new Set();
  for (let i = 0; i + n <= tokens.length; i++) s.add(tokens.slice(i, i + n).join(" "));
  return s;
}

// Signal 1: distinctive shingles shared by >= phraseMinEpisodes episodes.
function sharedPhrases(eps, cfg, allow) {
  const n = cfg.shingleN;
  const owners = new Map(); // shingle -> [episode names], in input order
  eps.forEach((e) => {
    for (const sh of shingleSet(e.tokens, n)) {
      if (!owners.has(sh)) owners.set(sh, []);
      owners.get(sh).push(e.name);
    }
  });
  const out = [];
  for (const [sh, names] of owners) {
    if (names.length < cfg.phraseMinEpisodes) continue;
    const content = sh.split(" ").filter((t) => !STOPWORDS.has(t));
    if (content.length < cfg.phraseMinContentWords) continue; // too generic (common phrasing) -> skip
    if (allow.some((p) => sh.includes(p))) continue;          // intentional motif -> skip
    out.push({ phrase: sh, episodes: names });
  }
  out.sort((a, b) => a.phrase.localeCompare(b.phrase));
  return out;
}

// TF-IDF cosine between two openings, computed over the opening corpus. Stopwords
// (common + premise vocab) are dropped so only content words drive the score, and
// idf is smoothed so it never collapses to 0 (which would make identical openings
// score 0 at small corpus sizes). Distinctive shared words weigh most; ubiquitous
// ones get the floor weight rather than vanishing.
function openingSimilarity(eps) {
  const docs = eps.map((e) => {
    const tf = new Map();
    for (const t of e.opening) { if (STOPWORDS.has(t)) continue; tf.set(t, (tf.get(t) || 0) + 1); }
    return tf;
  });
  const df = new Map();
  docs.forEach((tf) => { for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1); });
  const N = docs.length;
  const idf = (t) => Math.log((N + 1) / (df.get(t) + 1)) + 1; // smoothed: always > 0
  const vecs = docs.map((tf) => {
    const v = new Map();
    for (const [t, c] of tf) v.set(t, c * idf(t));
    return v;
  });
  const norm = (v) => Math.sqrt([...v.values()].reduce((a, x) => a + x * x, 0));
  const cosine = (a, b) => {
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    let dot = 0;
    for (const [t, x] of small) if (big.has(t)) dot += x * big.get(t);
    const na = norm(a), nb = norm(b);
    return na && nb ? dot / (na * nb) : 0;
  };
  const pairs = [];
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++)
      pairs.push({ a: eps[i].name, b: eps[j].name, cosine: cosine(vecs[i], vecs[j]) });
  return pairs;
}

// Core: pure over already-parsed episodes. Returns advisory warnings + the raw
// data behind them (for the standalone report). Never returns errors.
export function checkDiversity(episodes, cfg = DIVERSITY, allow = []) {
  if (!cfg.enabled || !Array.isArray(episodes) || episodes.length < 2) {
    return { warnings: [], phrases: [], pairs: [] };
  }
  const eps = episodes.map((ep) => ({
    name: ep.id || ep.title || "(unnamed)",
    tokens: narrativeTokens(ep),
    opening: openingTokens(ep, cfg.openingWords),
  }));
  const phrases = sharedPhrases(eps, cfg, allow);
  const pairs = openingSimilarity(eps).sort((a, b) => b.cosine - a.cosine);

  const warnings = [];
  for (const p of phrases)
    warnings.push(`diversity: phrase "${p.phrase}" shared by ${p.episodes.join(", ")}`);
  for (const pr of pairs)
    if (pr.cosine >= cfg.openingWarnAt)
      warnings.push(`diversity: openings "${pr.a}" ~ "${pr.b}" similar (cosine ${pr.cosine.toFixed(2)})`);
  return { warnings, phrases, pairs };
}

// Load and normalise the motif allowlist (lowercased phrases; "#" comments).
export function loadAllowlist(file = join(HERE, "diversity-allow.txt")) {
  let raw;
  try { raw = readFileSync(file, "utf8"); } catch { return []; }
  return raw.split("\n")
    .map((l) => l.replace(/#.*$/, "").trim().toLowerCase())
    .filter(Boolean);
}

// ---- CLI: standalone report (matrix + flagged phrases) ----
const isCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
  const ROOT = resolve(HERE, "..");
  const EP_DIR = join(ROOT, "episodes");
  const args = process.argv.slice(2);
  let files = args;
  if (!files.length) {
    const manifest = JSON.parse(readFileSync(join(EP_DIR, "manifest.json"), "utf8"));
    files = manifest.episodes.filter((e) => !e.locked && e.file).map((e) => join(EP_DIR, e.file));
  }
  const episodes = files.map((f) => JSON.parse(readFileSync(f, "utf8")));
  if (episodes.length < 2) { console.log("need >= 2 episodes to compare"); process.exit(0); }
  if (!DIVERSITY.enabled) { console.log("diversity check disabled (diversity-config.mjs: enabled=false)"); process.exit(0); }

  const { warnings, phrases, pairs } = checkDiversity(episodes, DIVERSITY, loadAllowlist());
  const names = episodes.map((e) => e.id || e.title);

  console.log(`\nopening similarity (TF-IDF cosine, warn >= ${DIVERSITY.openingWarnAt}):`);
  const w = Math.max(6, ...names.map((n) => n.length));
  const pad = (s) => String(s).padStart(w);
  const score = new Map(pairs.map((p) => [`${p.a}|${p.b}`, p.cosine]));
  console.log("  " + pad("") + " " + names.map(pad).join(" "));
  for (let i = 0; i < names.length; i++) {
    const row = names.map((_, j) => {
      if (i === j) return pad("-");
      const c = score.get(`${names[i]}|${names[j]}`) ?? score.get(`${names[j]}|${names[i]}`) ?? 0;
      return pad((c >= DIVERSITY.openingWarnAt ? c.toFixed(2) + "!" : c.toFixed(2)));
    });
    console.log("  " + pad(names[i]) + " " + row.join(" "));
  }

  console.log(`\nshared distinctive phrases (${DIVERSITY.shingleN}-grams in >= ${DIVERSITY.phraseMinEpisodes} episodes):`);
  if (!phrases.length) console.log("  (none)");
  for (const p of phrases) console.log(`  "${p.phrase}"  -> ${p.episodes.join(", ")}`);

  console.log(`\n${warnings.length} advisory warning(s).`);
  process.exit(0);
}
