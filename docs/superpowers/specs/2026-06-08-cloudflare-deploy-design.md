# Cloudflare Workers deploy + release-please — design

Date: 2026-06-08

## Goal

Deploy the built static site (`dist/index.html`) to Cloudflare Workers in two
environments — staging and production — with releases managed by release-please.

## Hosting

Cloudflare Workers Static Assets (assets-only Worker, no server script). The
existing `npm run build` validates every episode and inlines them into a single
standalone `dist/index.html`; the Worker just serves that directory.

Two Workers from one `wrangler.jsonc`:
- `wake-alone` — production (top-level config)
- `wake-alone-staging` — staging (`env.staging` override)

Cloudflare account: `e1854db8e2a989281305b1b229319c31` (admin@hedvigholding.se).

## Trigger model

- **Staging** — every push to `main` builds and deploys to `wake-alone-staging`
  (`.github/workflows/deploy-staging.yml`).
- **Production** — release-please keeps a Release PR open on `main`. Merging it
  cuts a release; the same job then builds and deploys to `wake-alone`
  (`.github/workflows/release-please.yml`). Deploying in the same job avoids
  needing a PAT — the default `GITHUB_TOKEN` suffices.

Releases are driven by conventional commits (`feat:`, `fix:`, ...). Version is
bumped in `package.json` and recorded in `CHANGELOG.md` (release-type `node`,
manifest mode seeded at `0.1.0`).

## CI deploy mechanics

Workflows call `npx wrangler deploy [--env staging]` directly (wrangler pinned
via `package-lock.json`) rather than a third-party action. Auth via the
`CLOUDFLARE_API_TOKEN` GitHub secret; account id lives in `wrangler.jsonc`.

## Manual operator setup (not automatable from here)

The local wrangler login is an interactive OAuth token that CI cannot use. Before
CI can deploy, a repo admin must, in GitHub repo settings:
1. Create a scoped Cloudflare API token (Edit Workers) in the CF dashboard.
2. Add it as the `CLOUDFLARE_API_TOKEN` Actions secret.

(`CLOUDFLARE_ACCOUNT_ID` is not required as a secret because the account id is in
`wrangler.jsonc`; it can be added as a secret instead if the id should not be in
source.)

## Files

- `wrangler.jsonc` — Worker config, prod + staging.
- `.github/workflows/deploy-staging.yml` — staging on push to main.
- `.github/workflows/release-please.yml` — release management + prod deploy.
- `release-please-config.json`, `.release-please-manifest.json` — release config.
- `package.json` — adds `wrangler` devDep and `deploy` / `deploy:staging` scripts.
- `package-lock.json` — generated so `npm ci` works in CI.
