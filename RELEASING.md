# Releasing `@gabvdl/ui`

Canonical remote is the homelab Gitea (`origin`); GitHub
([GabrielVidal1/design-system](https://github.com/GabrielVidal1/design-system))
is a push mirror that also runs CI and the npm release workflow
(`.github/workflows/publish.yml`). See **CI auth** below for the credential it
needs — that part has a sharp edge.

## Public npm release (on tag)

```bash
# 1. bump the version
$EDITOR packages/ui/package.json        # e.g. 0.0.14 → 0.0.15

# 2. update CHANGELOG.md — move the [Unreleased] section's entries under a new
#    `## [0.0.15] - YYYY-MM-DD` heading (leave [Unreleased] empty above it),
#    and add the compare/release links at the bottom. Do this before tagging,
#    not after — the tag should point at the commit the changelog describes.
$EDITOR CHANGELOG.md

# 3. commit and push BOTH remotes
git add -A && git commit -m "release: @gabvdl/ui 0.0.15"
git push origin main
git push github main

# 4. tag — the tag must equal the package version (CI enforces it)
git tag v0.0.15
git push github v0.0.15
```

CI then builds, typechecks, publishes to npm with `--provenance`, and creates a
GitHub Release. Pre-release tags (`v1.0.0-rc.1`) publish under the `next`
dist-tag, never `latest`.

If a release fails, fix it and **move the tag** rather than re-running the job
(a re-run replays the workflow file as it was at the tagged commit):

```bash
git tag -d v0.0.14 && git push github :v0.0.14      # drop the bad tag
git tag v0.0.14    && git push github v0.0.14       # re-tag the fixed commit
```

## CI auth: the `EOTP` trap

npm demands two-factor auth on publish, and **classic "Automation" tokens no
longer exist** (npm removed all legacy tokens in November 2025). A token without
a 2FA bypass makes the job fail with `npm error code EOTP` — *"This operation
requires a one-time password from your authenticator"* — which no CI job can
answer. Two ways to authenticate:

**A granular access token, with "Bypass two-factor authentication" ticked.**
npmjs.com → Access Tokens → Generate New Token → Granular. Give it read+write on
`@gabvdl/*`, tick **Bypass 2FA** (this is the box that matters — untick it and
you get `EOTP`), then:

```bash
gh secret set NPM_TOKEN -R GabrielVidal1/design-system
```

Note npm now caps write-token lifetime at 90 days, so this secret expires and
has to be rotated.

**Trusted publishing (OIDC) — no token, nothing to rotate. Prefer this.** It
can't do a package's *first* publish (npm requires the package to exist before
you can register a publisher), so once `@gabvdl/ui` is on npm:

1. npmjs.com → the package → **Settings / Access** → add a trusted publisher:
   repo `GabrielVidal1/design-system`, workflow `publish.yml`.
2. `gh secret delete NPM_TOKEN -R GabrielVidal1/design-system`.

The workflow already handles both: it exports `NODE_AUTH_TOKEN` only when the
secret exists, and otherwise authenticates over OIDC from the job's `id-token`.
(An *empty but present* `NODE_AUTH_TOKEN` would make npm try token auth and skip
OIDC — hence the conditional.)

## Private verdaccio (dev builds)

For homelab work-in-progress — no tag, no public release:

```bash
# from the homelab repo root, registry profile up (make up.registry)
./services/registry/publish.sh
```

Same rule: bump `packages/ui/package.json` first, verdaccio rejects
re-publishing an existing version.
