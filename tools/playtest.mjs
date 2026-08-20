#!/usr/bin/env node
// playtest.mjs — automated playthroughs of every episode in the REAL engine.
//
// This does not simulate the runtime: it builds dist/index.html, opens it in
// headless Chromium (Playwright), boots the CRT, deep-links each episode by
// hash, clicks the actual choice buttons, and scrapes what a player would see.
// The solver (tools/validate.mjs) is used only as a route planner — it emits
// the shortest survivable action list to every reachable ending — and every
// prediction it makes (which node we land on, which choices are clickable,
// the final sanity) is verified against the live engine state. Any mismatch
// is engine/solver drift and fails the run hard.
//
// Per episode it records, into traces/<id>.txt (committed golden transcripts;
// a PR diff on an episode shows exactly how its playthroughs changed):
//   - one transcript per reachable ending (shortest survivable route)
//   - the shortest route into madness, when one exists
//   - a "tour": a greedy revisit-heavy walk that maximises room coverage,
//     decided live from the page (this is the trace that exercises returning
//     to rooms after state changed)
//
// Deterministic checks (warn tier, stdout): first-arrival prose replaying on a
// revisit. Engine/planner mismatches are hard errors (exit 1).
//
// Optional LLM continuity read (advisory, never gates anything):
//   node tools/playtest.mjs --judge
// sends each episode's transcript once to a cheap model (default
// claude-haiku-4-5; override with PLAYTEST_MODEL) and prints contradictions it
// finds between prose and ground-truth state. Needs @anthropic-ai/sdk and an
// Anthropic credential (ANTHROPIC_API_KEY or an `ant auth login` profile).
// Verdicts are cached in .playtest-cache.json keyed on the transcript hash, so
// unchanged episodes cost nothing to re-run.
//
// Usage:  node tools/playtest.mjs [--judge] [--no-build] [episodes/foo.json ...]
//         (no file args -> every non-locked episode in the manifest, chapters included)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { solve } from "./validate.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EPISODES_DIR = join(ROOT, "episodes");
const TRACES_DIR = join(ROOT, "traces");
const DIST = join(ROOT, "dist", "index.html");
const CACHE_FILE = join(ROOT, ".playtest-cache.json");
const JUDGE_MODEL = process.env.PLAYTEST_MODEL || "claude-haiku-4-5";
const PROMPT_VERSION = "v1"; // bump to invalidate all cached judge verdicts

const TOUR_STEP_CAP = 40;    // hard ceiling on tour length
const TOUR_STALE_CAP = 6;    // tour ends after this many steps with nothing new
const TOUR_SANITY_FLOOR = 10; // tour never takes a step that could land at or below this
const C = { red: "\x1b[31m", yellow: "\x1b[33m", green: "\x1b[32m", dim: "\x1b[2m", bold: "\x1b[1m", reset: "\x1b[0m" };

let ITEM_NAMES = {};
try { ITEM_NAMES = JSON.parse(readFileSync(join(ROOT, "engine", "item-names.json"), "utf8")); } catch {}

// ---- targets: same manifest walk as the validator, but chapters keep their
// adventure context so the driver can unlock them the way the engine does ----
function loadTargets(files) {
  if (files.length) {
    return files.map((f) => {
      const ep = JSON.parse(readFileSync(f, "utf8"));
      return { ep, ...chapterContext(ep.id) };
    });
  }
  const manifest = JSON.parse(readFileSync(join(EPISODES_DIR, "manifest.json"), "utf8"));
  const targets = [];
  for (const e of manifest.episodes) {
    if (e.anomaly || e.locked) continue;
    if (e.adventure) {
      const chapters = (e.chapters || []).map((ch) => ({ decl: ch, ep: JSON.parse(readFileSync(join(EPISODES_DIR, ch.file), "utf8")) }));
      chapters.forEach(({ decl, ep }, i) => {
        targets.push({ ep, chapter: { advId: e.adventure, idx: i, decl, prev: i > 0 ? chapters[i - 1] : null } });
      });
      continue;
    }
    if (e.file) targets.push({ ep: JSON.parse(readFileSync(join(EPISODES_DIR, e.file), "utf8")) });
  }
  return targets;
}

function chapterContext(id) {
  const manifest = JSON.parse(readFileSync(join(EPISODES_DIR, "manifest.json"), "utf8"));
  for (const e of manifest.episodes || []) {
    if (!e.adventure) continue;
    const chapters = (e.chapters || []).map((ch) => ({ decl: ch, ep: JSON.parse(readFileSync(join(EPISODES_DIR, ch.file), "utf8")) }));
    const i = chapters.findIndex((c) => c.ep.id === id);
    if (i >= 0) return { chapter: { advId: e.adventure, idx: i, decl: chapters[i].decl, prev: i > 0 ? chapters[i - 1] : null } };
  }
  return {};
}

// A later chapter only unlocks off a recorded completion of the previous one.
// Synthesise the minimal record that satisfies its unlock (mirrors the engine's
// chapterUnlocked/carriedFlags), and derive the flags the engine would then
// import — those seed the planner so plan and engine agree.
export function chapterSeed(chapter) {
  if (!chapter || chapter.idx === 0) return null;
  const { decl, prev } = chapter;
  const u = decl.unlock;
  const prevEndings = Object.entries(prev.ep.nodes).filter(([, n]) => n.ending);
  let node, type;
  if (u && u.ending) { node = u.ending; type = (prev.ep.nodes[u.ending] || {}).ending?.type || "escape"; }
  else if (u && u.type) { [node] = prevEndings.filter(([, n]) => n.ending.type === u.type).map(([id]) => id).sort(); type = u.type; }
  else { [node] = prevEndings.filter(([, n]) => n.ending.type === "escape").map(([id]) => id).sort(); type = "escape"; }
  const flags = u && u.flag ? [u.flag] : [];
  const record = { type, node: node || "unknown", flags };
  const carried = new Set([...flags, `prior_${type}`, ...(node ? [`prior_end_${node}`] : [])]);
  const imports = (decl.imports || []).filter((f) => carried.has(f));
  return { record, prevId: prev.ep.id, imports };
}

// ---- planner: turn the solver's structured runs into a trace list ----
export function buildPlan(ep, seedFlags = []) {
  const sol = solve(ep, true, seedFlags);
  const rank = { escape: 0, dead: 1, madness: 2 };
  const endingIds = [...sol.endingRuns.keys()].sort((a, b) =>
    (rank[ep.nodes[a].ending.type] - rank[ep.nodes[b].ending.type]) || (a < b ? -1 : 1));
  const traces = endingIds.map((id) => {
    const run = sol.endingRuns.get(id);
    return { name: `${ep.nodes[id].ending.type} via "${id}"`, kind: "ending", acts: run.acts, expect: { node: id, sanity: run.sanity } };
  });
  if (sol.madnessRun && sol.madnessRun.acts.length) {
    traces.push({ name: "madness (sanity 0)", kind: "madness", acts: sol.madnessRun.acts, expect: { sanity: 0 } });
  }
  return { solver: sol, traces };
}

// ---- deterministic check: first-arrival prose must not replay on a revisit ----
const FIRST_VISIT_RE = /\b(for the first time|you wake|you come to|jolts? awake|you open your eyes)\b/i;
export function checkRevisitProse(trace) {
  const warns = [];
  const seen = new Set();
  for (const s of trace.steps) {
    if (seen.has(s.id) && FIRST_VISIT_RE.test(s.prose)) {
      const m = s.prose.match(FIRST_VISIT_RE);
      warns.push(`node "${s.id}": first-arrival prose ("${m[0]}") shown again on a revisit (trace "${trace.name}", step ${s.n})`);
    }
    seen.add(s.id);
  }
  return warns;
}

// ---- transcript rendering ----
const fmtList = (a) => (a.length ? a.join(", ") : "(none)");
export function formatTrace(tr) {
  const out = [`=== TRACE: ${tr.name} (${tr.steps.length} steps${tr.end && tr.end.sanity !== undefined ? `, final sanity ${tr.end.sanity}` : ""}) ===`, ""];
  const seen = new Set();
  for (const s of tr.steps) {
    const revisit = seen.has(s.id) ? " (revisit)" : "";
    seen.add(s.id);
    out.push(`[step ${s.n}] node "${s.id}"${revisit} | SANITY ${s.sanity} | INV: ${fmtList(s.inv)} | FLAGS: ${fmtList(s.flags)}`);
    if (s.title) out.push(`LOC // ${s.title}`);
    out.push(s.prose.trim(), "");
    if (s.choices.length) {
      out.push("choices shown:");
      for (const c of s.choices) out.push(c.locked ? `  [locked] ${c.text}` : `  [${c.idx}] ${c.text}`);
    }
    out.push(`ACTION: ${s.action}`, "");
  }
  if (tr.end) {
    out.push(`[ending] node "${tr.end.node}" | SANITY ${tr.end.sanity} | type: ${tr.end.type}`);
    out.push(tr.end.stamp, "", tr.end.prose.trim());
  } else {
    out.push(`[tour ends] ${tr.stop}`);
  }
  out.push("", "");
  return out.join("\n");
}

export function formatEpisodeFile(ep, traces) {
  const items = Object.keys(ITEM_NAMES).filter((k) => JSON.stringify(ep).includes(`"${k}"`));
  const head = [
    `WAKE ALONE playthrough transcripts - episode "${ep.id}" (${ep.title})`,
    `Generated by tools/playtest.mjs against dist/index.html (real engine, headless browser).`,
    `Do not edit by hand; regenerate with: npm run playtest`,
    items.length ? `item labels: ${items.map((k) => `${k} = "${ITEM_NAMES[k]}"`).join(", ")}` : "",
    "", "",
  ].filter((l, i, a) => l !== "" || i >= a.length - 2).join("\n");
  return head + traces.map(formatTrace).join("");
}

// ---- browser driver ----
async function launchBrowser() {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { throw new Error(`playwright is not installed - run: npm install`); }
  try { return await chromium.launch(); }
  catch (err) {
    if (existsSync("/opt/pw-browsers/chromium")) return chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
    throw new Error(`could not launch Chromium (${err.message}) - run: npx playwright install chromium`);
  }
}

const scrapeStep = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  return {
    id: state.current,
    sanity: state.sanity,
    inv: [...state.inventory],
    flags: Object.keys(state.flags).filter((f) => state.flags[f]).sort(),
    title: q(".nodetitle") ? q(".nodetitle").textContent : "",
    prose: q(".prose") ? q(".prose").innerText : "",
    choices: [...document.querySelectorAll(".sc .choice")].map((el) => ({
      locked: el.tagName !== "BUTTON",
      idx: el.tagName === "BUTTON" ? Number((el.getAttribute("onclick").match(/\d+/) || [NaN])[0]) : null,
      text: el.innerText,
    })),
    medgel: !!q(".medbtn"),
  };
});

const scrapeEnding = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const stampEl = q(".ending .stamp");
  return {
    node: state.current,
    sanity: state.sanity,
    stamp: stampEl ? stampEl.textContent : "",
    type: stampEl ? ["escape", "dead", "madness"].find((t) => stampEl.classList.contains(t)) || "?" : "?",
    prose: q(".ending .prose") ? q(".ending .prose").innerText : "",
  };
});

async function openEpisode(context, distUrl, epId) {
  const page = await context.newPage();
  // domcontentloaded: the engine boots on script execution; "load" would stall on
  // slow/unreachable externals (the menu font) for many seconds per page.
  await page.goto(`${distUrl}#${epId}`, { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Enter"); // wake press; reduced-motion boot is already at the prompt
  await page.waitForSelector(".prose", { timeout: 15000 });
  return page;
}

const drift = (epId, traceName, n, msg) => new Error(`${epId} / "${traceName}" step ${n}: engine/planner drift - ${msg}`);

async function runPlanned(context, distUrl, ep, trace) {
  const page = await openEpisode(context, distUrl, ep.id);
  const steps = [];
  let expected = ep.start;
  for (let i = 0; i < trace.acts.length; i++) {
    const act = trace.acts[i];
    const s = await scrapeStep(page);
    const n = i + 1;
    if (s.id !== expected) throw drift(ep.id, trace.name, n, `engine is at node "${s.id}", planner expected "${expected}"`);
    if (act.kind === "gel") {
      if (!s.medgel) throw drift(ep.id, trace.name, n, `planner wants med-gel but the button is not shown`);
      steps.push({ ...s, n, action: "use med-gel [+25]" });
      await page.click(".medbtn", { force: true });
    } else {
      const shown = s.choices.find((c) => !c.locked && c.idx === act.idx);
      if (!shown) throw drift(ep.id, trace.name, n, `planner wants choice[${act.idx}] but it is not clickable (shown: ${s.choices.map((c) => (c.locked ? "locked" : c.idx)).join(", ")})`);
      steps.push({ ...s, n, action: `[${act.idx}] ${shown.text}` });
      expected = ep.nodes[expected].choices[act.idx].to;
      await page.click(`.sc button.choice[onclick="choose(${act.idx})"]`, { force: true });
    }
  }
  await page.waitForSelector(".ending .stamp", { timeout: 15000 });
  const end = await scrapeEnding(page);
  if (trace.kind === "ending" && end.node !== trace.expect.node)
    throw drift(ep.id, trace.name, steps.length, `ended at "${end.node}", planner expected "${trace.expect.node}"`);
  if (end.sanity !== trace.expect.sanity)
    throw drift(ep.id, trace.name, steps.length, `ended at sanity ${end.sanity}, planner expected ${trace.expect.sanity}`);
  await page.close();
  return { name: trace.name, steps, end };
}

// The tour is played blind against the live page: at every step it asks the
// engine itself (episode data + its own meets()) what is open, then greedily
// walks toward rooms it has not seen, never taking a step that could drop
// sanity to the floor and never entering an ending. Revisits are the point.
async function runTour(context, distUrl, ep) {
  const page = await openEpisode(context, distUrl, ep.id);
  const steps = [];
  const visits = new Map();
  let stale = 0, stop = "step cap reached";
  for (let n = 1; n <= TOUR_STEP_CAP; n++) {
    const s = await scrapeStep(page);
    visits.set(s.id, (visits.get(s.id) || 0) + 1);
    if (s.medgel && s.sanity <= 30) {
      steps.push({ ...s, n, action: "use med-gel [+25]" });
      await page.click(".medbtn", { force: true });
      continue;
    }
    const cand = await page.evaluate(() => (episode.nodes[state.current].choices || []).map((c, idx) => ({
      idx,
      to: c.to,
      open: !!(c.to !== undefined && episode.nodes[c.to] && meets(c.requires)),
      ending: !!(c.to !== undefined && episode.nodes[c.to] && episode.nodes[c.to].ending),
      cost: ((c.effects && c.effects.sanity) || 0) +
        ((c.to !== undefined && episode.nodes[c.to] && episode.nodes[c.to].onEnter && !state.entered[c.to]) ? (episode.nodes[c.to].onEnter.sanity || 0) : 0),
    })));
    const safe = cand.filter((c) => c.open && !c.ending && s.sanity + c.cost > TOUR_SANITY_FLOOR);
    if (!safe.length) { stop = "no safe onward choice"; steps.push({ ...s, n, action: "(tour ends)" }); break; }
    const fresh = safe.filter((c) => !visits.has(c.to));
    stale = fresh.length ? 0 : stale + 1;
    if (stale >= TOUR_STALE_CAP) { stop = "nothing new reachable"; steps.push({ ...s, n, action: "(tour ends)" }); break; }
    const pick = (fresh.length ? fresh : safe).reduce((a, b) => ((visits.get(b.to) || 0) < (visits.get(a.to) || 0) ? b : a));
    const shown = s.choices.find((c) => !c.locked && c.idx === pick.idx);
    steps.push({ ...s, n, action: `[${pick.idx}] ${shown ? shown.text : "?"}` });
    await page.click(`.sc button.choice[onclick="choose(${pick.idx})"]`, { force: true });
  }
  await page.close();
  return { name: "tour (greedy coverage walk)", steps, end: null, stop };
}

async function playTarget(browser, distUrl, target) {
  const ep = target.ep;
  const seed = chapterSeed(target.chapter);
  const plan = buildPlan(ep, seed ? seed.imports : []);
  if (plan.solver.truncated) console.log(`  ${C.yellow}warn ${C.reset} solver state space truncated; traces may be incomplete`);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.route(/^https?:/, (r) => r.abort()); // hermetic: dist is self-contained except webfonts
  if (seed) {
    const progress = { [target.chapter.advId]: { [seed.prevId]: seed.record } };
    await context.addInitScript(`localStorage.setItem("skein_progress_v1", ${JSON.stringify(JSON.stringify(progress))})`);
  }
  const traces = [];
  try {
    for (const t of plan.traces) traces.push(await runPlanned(context, distUrl, ep, t));
    traces.push(await runTour(context, distUrl, ep));
  } finally {
    await context.close();
  }
  const covered = new Set(traces.flatMap((t) => t.steps.map((s) => s.id).concat(t.end ? [t.end.node] : [])));
  const reachable = plan.solver.nodeMinSanity.size;
  return { traces, seed, coverage: { covered: covered.size, reachable } };
}

// ---- LLM continuity judge (advisory) ----
const JUDGE_SYSTEM = `You are a continuity checker for a deterministic sci-fi horror text adventure.
You receive complete playthrough transcripts of one episode. Every step shows ground-truth
game state (SANITY 0-100, INV = inventory item ids, FLAGS = story events that have happened),
then the exact prose the player saw, the choices offered, and the action taken. Steps marked
(revisit) are rooms the player has entered before in that same playthrough.

Report ONLY clear continuity contradictions between prose and state or history:
1. Prose describing an item as still present or takeable after INV shows the player took it.
2. Prose on a revisit contradicting an event that already happened (per FLAGS or earlier
   steps in the same trace) - e.g. a door described as sealed after it was opened, power
   described as dead after it was restored.
3. First-arrival narration (waking up, noticing something for the first time) on a revisit.
4. Prose asserting the player holds or uses an item that is not in INV.
5. An ending whose text plainly contradicts the choice or state that led to it.

Do NOT report style, tone, pacing, ambiguity, or deliberate wrongness: hallucinated or
distorted perception is intentional at low SANITY (<= 40), and vague dread is the house
style. Only report contradictions a careful reader would call a bug. Judge each trace on
its own; different traces are independent playthroughs. If there are none, return [].

Respond with ONLY a JSON array:
[{"trace":"<trace heading>","step":<number>,"node":"<node id>","issue":"<one sentence>","quote":"<the contradicting prose fragment>"}]`;

function loadCache() { try { return JSON.parse(readFileSync(CACHE_FILE, "utf8")); } catch { return {}; } }

async function judgeEpisode(client, epId, transcript, cache) {
  const key = createHash("sha256").update(`${PROMPT_VERSION}\n${JUDGE_MODEL}\n${transcript}`).digest("hex");
  if (cache[epId] && cache[epId].key === key) return { findings: cache[epId].findings, cached: true };
  const res = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 3000,
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: transcript }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let findings;
  try { findings = JSON.parse(text.replace(/^```(json)?\s*|\s*```$/g, "")); }
  catch { findings = [{ trace: "(judge)", step: 0, node: "?", issue: "judge returned unparseable output", quote: text.slice(0, 200) }]; }
  if (!Array.isArray(findings)) findings = [];
  cache[epId] = { key, findings };
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + "\n");
  return { findings, cached: false };
}

// ---- CLI ----
const isCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
  const args = process.argv.slice(2);
  const judge = args.includes("--judge");
  const noBuild = args.includes("--no-build");
  const files = args.filter((a) => !a.startsWith("--"));

  if (!noBuild) {
    const r = spawnSync(process.execPath, [join(ROOT, "tools", "build.mjs")], { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status || 1);
  }
  if (!existsSync(DIST)) { console.error(`${C.red}ERROR${C.reset} ${DIST} not found - run npm run build`); process.exit(1); }

  const targets = loadTargets(files);
  mkdirSync(TRACES_DIR, { recursive: true });
  const distUrl = pathToFileURL(DIST).href;

  let judgeClient = null;
  if (judge) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      judgeClient = new Anthropic();
    } catch (err) { console.error(`${C.red}ERROR${C.reset} --judge needs @anthropic-ai/sdk (npm install): ${err.message}`); process.exit(1); }
  }
  const cache = judge ? loadCache() : null;

  const browser = await launchBrowser();
  let hardFail = 0, warnCount = 0;
  try {
    for (const target of targets) {
      const ep = target.ep;
      console.log(`\n${C.bold}${ep.id}${C.reset}${target.chapter ? ` ${C.dim}(chapter ${target.chapter.idx + 1} of "${target.chapter.advId}")${C.reset}` : ""}`);
      let played;
      try { played = await playTarget(browser, distUrl, target); }
      catch (err) { hardFail++; console.log(`  ${C.red}ERROR${C.reset} ${err.message}`); continue; }
      const { traces, coverage, seed } = played;
      const transcript = formatEpisodeFile(ep, traces);
      writeFileSync(join(TRACES_DIR, `${ep.id}.txt`), transcript);
      const endings = traces.filter((t) => t.end).length;
      console.log(`${C.dim}  ${endings} ending trace(s) + tour · node coverage ${coverage.covered}/${coverage.reachable}${seed ? ` · unlocked via synthetic "${seed.record.type}" record${seed.imports.length ? `, imports: ${seed.imports.join(", ")}` : ", no imports"}` : ""} -> traces/${ep.id}.txt${C.reset}`);
      for (const t of traces) for (const w of checkRevisitProse(t)) { warnCount++; console.log(`  ${C.yellow}warn ${C.reset} ${w}`); }
      if (judgeClient) {
        try {
          const { findings, cached } = await judgeEpisode(judgeClient, ep.id, transcript, cache);
          console.log(`${C.dim}  judge (${JUDGE_MODEL}${cached ? ", cached" : ""}): ${findings.length} finding(s)${C.reset}`);
          for (const f of findings) { warnCount++; console.log(`  ${C.yellow}warn ${C.reset} [judge] ${f.trace} step ${f.step}, node "${f.node}": ${f.issue}${f.quote ? `  << "${f.quote}"` : ""}`); }
        } catch (err) { console.log(`  ${C.yellow}warn ${C.reset} judge call failed: ${err.message}`); }
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${hardFail ? C.red : C.green}${targets.length - hardFail}/${targets.length} episodes played${C.reset}${warnCount ? ` ${C.yellow}(${warnCount} advisory warning(s))${C.reset}` : ""}\n`);
  process.exit(hardFail ? 1 : 0);
}
