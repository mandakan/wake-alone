# Adversarial Craft-Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fresh-eyes craft reviewer that reads a finished episode cold and reports judgment-tier craft-lesson violations, complementing (not replacing) the deterministic validator.

**Architecture:** A `review-episode` skill defines four parallel review lenses, a structured findings format, and merge/triage rules. It runs standalone (`/review-episode <id>`) and is reused by author-episode as a post-build step 6.5. Reviewers report only - they never edit the episode. No new `tools/` code; craft review is judgment-tier and lives as skill prose.

**Tech Stack:** Claude Code skills (markdown), parallel sub-agent dispatch via the Agent tool. No runtime code, no new tests in `tools/`.

---

## File structure

| File | Responsibility | Action |
|------|----------------|--------|
| `.claude/skills/review-episode/SKILL.md` | Single source of truth: lenses, findings schema, dispatch, merge, triage, report output | Create |
| `.claude/skills/author-episode/SKILL.md` | Add step 6.5 that invokes review-episode in auto mode after build | Modify |
| `docs/craft-lessons.md` | (No change in this work; reviewer references it as rubric) | - |

There is intentionally no change to `tools/`. The validator stays the only exit-0 gate.

---

### Task 1: Create the `review-episode` skill

**Files:**
- Create: `.claude/skills/review-episode/SKILL.md`

- [ ] **Step 1: Write the skill file**

Full content is authored in this task (see the committed file). It must contain, in order:

1. Frontmatter: `name: review-episode`, a `description` that triggers on "review episode",
   "craft review", "/review-episode", re-reading a shipped episode for craft.
2. **Purpose** - craft reviewer that complements the validator; owns judgment-tier
   craft-lessons (L2, L4, gestalt, voice, tension feel); never re-reports what
   `validate`/`prose-lint` already catch; never edits the episode.
3. **The four lenses**, each with an explicit, paste-ready sub-agent prompt:
   - Ending legibility (L2)
   - Gestalt + hint calibration (L4)
   - Slop beyond the linter
   - Tension feel + branch/hub coherence
4. **Findings schema** (severity / lesson / location / problem / fix / proposedLesson).
5. **Dispatch**: read the episode + `CLAUDE.md` + `docs/craft-lessons.md`; run the four
   lenses as parallel sub-agents in a single message; each returns a findings array.
6. **Merge + dedupe** by (location, lesson, problem).
7. **Triage / severity** meaning (block / craft-warn / nit) and that none of it is a CI gate.
8. **Modes**: standalone (report inline + copy to `~/.claude-tmp/`) vs auto (author loops
   its validate-fix cycle until block/craft-warn addressed or justified).
9. **Ledger routing**: `proposedLesson` surfaces to the human with drafted text; never
   auto-append to `docs/craft-lessons.md`.
10. **Hard constraints**: report-only; don't duplicate the validator; don't auto-append
    lessons; no runtime LLM.

- [ ] **Step 2: Verify the file is well-formed**

Run: `head -4 .claude/skills/review-episode/SKILL.md`
Expected: valid YAML frontmatter with `name: review-episode`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/review-episode/SKILL.md
git commit -m "feat: add review-episode craft-review skill"
```

---

### Task 2: Wire author-episode step 6.5

**Files:**
- Modify: `.claude/skills/author-episode/SKILL.md` (Procedure section, after step 6 "Build and report")

- [ ] **Step 1: Insert step 6.5**

Add a step after the build step that, in auto mode, invokes the `review-episode` logic:
dispatch the panel, merge findings, then loop the existing validate-fix cycle until every
`block` and `craft-warn` finding is addressed or explicitly justified, before the final
report. It must reference the `review-episode` skill as the source of truth for the lenses
and findings format (do not restate them), so there is one definition.

- [ ] **Step 2: Verify cross-reference**

Run: `grep -n "review-episode" .claude/skills/author-episode/SKILL.md`
Expected: at least one line referencing the skill.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/author-episode/SKILL.md
git commit -m "feat: author-episode runs craft review after build"
```

---

### Task 3: Smoke-test both modes

**Files:** none (manual verification)

- [ ] **Step 1: Positive control - review a known-good episode**

Run `/review-episode derelict` (the canonical validated episode). Read the merged report.
Expected: a coherent report; no false "violates L2" against the canonical example. A few
`nit`s are acceptable; a `block` against derelict is a signal the lens prompt is miscalibrated.

- [ ] **Step 2: Negative control - catch a real defect**

Temporarily muddy one ending in a scratch copy (e.g. `cp episodes/vigil.json
~/.claude-tmp/muddied.json` and obscure an ending's causal chain), then review it.
Expected: the L2 lens flags the muddied ending. Confirms the panel detects, not just passes.

- [ ] **Step 3: Confirm report output location**

Expected: standalone run wrote a copy under `~/.claude-tmp/`; nothing committed to the repo
by the review itself.

---

## Self-review

- **Spec coverage:** lenses (Task 1.3), findings format (1.4), report-only authority (1.7-1.8),
  not-a-gate (1.7), ledger routing (1.9), two entry points (Task 1 + Task 2), report output
  (1.8, Task 3.3). All spec sections map to a task.
- **Placeholders:** none - the substantive content is the skill file authored in Task 1.
- **Consistency:** "review-episode" skill name, four lens names, and the findings field
  names match across spec and both skill files.
