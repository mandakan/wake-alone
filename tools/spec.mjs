// spec.mjs — the generation dials, in one place. Both the validator (as
// thresholds) and the scaffolder / author-episode skill (as a brief) read this,
// so a story is generated against the same numbers it is later checked against.
//
// An episode opts in by declaring an optional top-level "spec":
//   "spec": { "size": "standard", "punishment": "standard" }
// build.mjs strips it before inlining -- it is authoring metadata, not runtime.

// size -> node-count budget (hard) + advisory play-time minutes range.
export const SIZES = {
  short:    { minNodes: 6,  maxNodes: 10, minMinutes: 3,  maxMinutes: 8 },
  standard: { minNodes: 10, maxNodes: 16, minMinutes: 7,  maxMinutes: 16 },
  long:     { minNodes: 16, maxNodes: 24, minMinutes: 15, maxMinutes: 30 },
};

// punishment -> death-ratio floor + minimum nasty (dead) endings + whether the
// run should actually be losable to madness. deadMin is chosen so that
// deadMin / (deadMin + 1) >= deathRatioFloor, i.e. the floor is reachable with
// one escape ending.
export const PUNISHMENTS = {
  gentle:   { deathRatioFloor: 0.34, deadMin: 2, expectMadness: false },
  standard: { deathRatioFloor: 0.50, deadMin: 2, expectMadness: false },
  cruel:    { deathRatioFloor: 0.66, deadMin: 3, expectMadness: true  },
};

// escape -> whether a survivable "happy" ending is required. "forbidden" makes
// a no-way-out story (every path ends in death/madness) and still validates.
export const ESCAPE_MODES = ["required", "forbidden"];

// traces -> how hard the death-evidence bites (the L17 register ladder).
// All rungs must pass the read-aloud test (innocent surface, horrific
// inference); the dial moves how far the implication reaches, never how much
// is shown. The enum is validated here; conformance to the declared rung is
// judgment (author-episode writes to it, the reviewer's gestalt lens checks it).
//   absent     - deliberate Mary Celeste mode: no death-evidence on purpose
//   restrained - counter-facts: the evidence states what happened, no forward motion
//   forward    - the systems are still mid-task: a request pending, a setting
//                offered to the player, an answer that poisons an earlier line
export const TRACE_MODES = ["absent", "restrained", "forward"];

// sanityRegister -> which grammar the sanityText degrade runs on (the L18 dial).
// The enum is validated here; the guardrails (lucid cold read, one concrete
// anchor, one delusional move, standalone + state-true) are judgment -- L18 in
// docs/craft-lessons.md, checked by author-episode's final-read register pass.
//   wrong     - default. The Gilman degrade: same objects, re-read as off, then
//               wrong. What the episodes already do.
//   psychotic - the interior-collapse ladder: reference (fires high), record
//               (mid), command (low). Opt-in only, never the house default.
export const SANITY_REGISTERS = ["wrong", "psychotic"];

export const DEFAULT_SIZE = "standard";
export const DEFAULT_PUNISHMENT = "standard";
export const DEFAULT_ESCAPE = "required";

// Resolve an episode's `spec` into concrete thresholds. Returns null when no
// spec is declared, or { error } when a dial value is unknown.
export function resolveSpec(spec) {
  if (!spec || typeof spec !== "object") return null;
  const out = { size: spec.size ?? null, punishment: spec.punishment ?? null, escape: spec.escape ?? null, traces: spec.traces ?? null, sanityRegister: spec.sanityRegister ?? null };
  if (out.size == null && out.punishment == null && out.escape == null && out.traces == null && out.sanityRegister == null) return null;
  if (out.size != null) {
    if (!SIZES[out.size]) return { error: `unknown size "${out.size}" (use ${Object.keys(SIZES).join("/")})` };
    Object.assign(out, SIZES[out.size]);
  }
  if (out.punishment != null) {
    if (!PUNISHMENTS[out.punishment]) return { error: `unknown punishment "${out.punishment}" (use ${Object.keys(PUNISHMENTS).join("/")})` };
    Object.assign(out, PUNISHMENTS[out.punishment]);
  }
  if (out.escape != null && !ESCAPE_MODES.includes(out.escape)) {
    return { error: `unknown escape "${out.escape}" (use ${ESCAPE_MODES.join("/")})` };
  }
  if (out.traces != null && !TRACE_MODES.includes(out.traces)) {
    return { error: `unknown traces "${out.traces}" (use ${TRACE_MODES.join("/")})` };
  }
  if (out.sanityRegister != null && !SANITY_REGISTERS.includes(out.sanityRegister)) {
    return { error: `unknown sanityRegister "${out.sanityRegister}" (use ${SANITY_REGISTERS.join("/")})` };
  }
  return out;
}

// Rough play-time estimate, derived from prose volume + the solver's optimal
// path. ~200 wpm reading, ~8s deliberation per step on the winning path.
export function estimateMinutes(totalWords, optimalSteps = 0) {
  const reading = totalWords / 200;
  const deliberation = (optimalSteps * 8) / 60;
  return Math.round((reading + deliberation) * 10) / 10;
}

// A human-readable brief for the scaffolder / skill.
export function describeBrief(resolved) {
  if (!resolved || resolved.error) return "";
  const bits = [];
  if (resolved.size) bits.push(`size=${resolved.size} (${resolved.minNodes}-${resolved.maxNodes} nodes, ~${resolved.minMinutes}-${resolved.maxMinutes} min)`);
  if (resolved.punishment) bits.push(`punishment=${resolved.punishment} (>=${resolved.deadMin} dead endings, death ratio >=${Math.round(resolved.deathRatioFloor * 100)}%${resolved.expectMadness ? ", madness reachable" : ""})`);
  if (resolved.escape === "forbidden") bits.push(`escape=forbidden (no way out -- every path ends in death)`);
  if (resolved.traces) bits.push(`traces=${resolved.traces} (death-evidence register, L17 - judgment-checked)`);
  if (resolved.sanityRegister) bits.push(`sanityRegister=${resolved.sanityRegister} (sanityText register, L18 - judgment-checked)`);
  return bits.join("; ");
}
