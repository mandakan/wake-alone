# Contributing to WAKE ALONE

Thanks for adding to the anthology. This repo is an anthology of deterministic
horror choose-your-own-adventure episodes played by a single static HTML engine
(*skein*). Most contributions are new episodes; some touch the engine or tooling.

## Setup

Node 18+ (CI runs Node 22), no runtime dependencies for the engine itself.

```bash
npm ci          # installs wrangler (the only dev dependency)
npm run build   # validate every episode, then inline -> dist/index.html
open dist/index.html
```

## The one rule that matters

**An episode is not done until `npm run validate` exits 0.** `ERROR` lines are
hard failures; `warn` lines are advisory. Never open a PR with validation errors,
and never weaken `tools/validate.mjs` to make an episode pass.

## Adding an episode

```bash
npm run new -- --id <slug> --title "<TITLE>" --byline "<one line>"
```

1. Author the nodes. The authoritative schema lives at the bottom of
   `engine/template.html`; `CLAUDE.md` carries the same schema plus the creative
   bible (voice, length, sanity economy, gating).
2. For every new inventory item id, add a label to `engine/item-names.json`.
3. `npm run validate` and fix all errors.
4. `npm run build`, then open `dist/index.html` and play at least one path to an
   escape ending. Confirm sanity on the intended "good" path stays above 0.

Keep episodes consistent with the creative bible in `CLAUDE.md`: second person,
sparse, dread over gore. ~10-16 nodes, one hub, a gated exit, at least one
`escape` and one `dead` ending.

## Commits: Conventional Commits

Releases are automated by [release-please](https://github.com/googleapis/release-please),
which reads commit messages. Use the [Conventional Commits](https://www.conventionalcommits.org)
format:

```
<type>: <summary>
```

| Type | Effect on release | Use for |
|------|-------------------|---------|
| `feat:` | minor bump (0.x.0) | a new episode, a new engine capability |
| `fix:` | patch bump (0.0.x) | fixing a broken episode, engine, or tool |
| `docs:` | none | README, this file, comments |
| `chore:` | none | tooling, deps, housekeeping |
| `ci:` | none | workflow / deploy config |
| `refactor:`, `test:`, `style:` | none | internal changes |

A `!` after the type (e.g. `feat!:`) or a `BREAKING CHANGE:` footer signals a
breaking change. Only `feat:` and `fix:` produce a release entry; everything else
ships to staging but stays out of the changelog.

## Pull requests

1. Branch from `main`, make your change, run `npm run build` (it validates).
2. Open a PR with a conventional-commit-style title.
3. CI does not gate the PR yet, but `main` deploys on merge, so a green local
   build is the bar. Don't merge an episode that fails validation.

## How deploys and releases work

- **Staging** (`wake-alone-staging.long-sun-fac0.workers.dev`) redeploys on every
  push to `main`.
- **Production** (`wake.urdr.dev`) deploys when a release-please **Release PR** is
  merged. release-please keeps that PR open and up to date as `feat:`/`fix:`
  commits land; merging it cuts the tag, the GitHub Release, and the prod deploy.

So the normal loop is: merge your work to `main` (it hits staging), then merge the
Release PR when you want it live in production.

## Don't

- Don't add story content to `engine/template.html` or `dist/`.
- Don't introduce a runtime LLM call -- the engine is deterministic by design.
- Don't weaken `tools/validate.mjs` to pass an episode.
