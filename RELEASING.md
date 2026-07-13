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

**Trusted publishing (OIDC) — no token, nothing to rotate. This is what v0.1.0
shipped with.** It can't do a package's *first* publish (npm requires the package
to exist before you can register a publisher), so once `@gabvdl/ui` is on npm:

1. npmjs.com → the package → **Settings / Access** → add a trusted publisher:
   repo `GabrielVidal1/design-system`, workflow `publish.yml`, **environment
   blank** (the job declares none — set one here and the exchange fails).
2. `gh secret delete NPM_TOKEN -R GabrielVidal1/design-system`.

The workflow handles both paths: with a secret it writes the `_authToken` line
itself, otherwise it authenticates over OIDC from the job's `id-token`.

### Two traps, both hit on the 0.1.0 cut

**Do not give `actions/setup-node` a `registry-url:`.** It writes an `.npmrc`
holding `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`; with no token
that line expands to an *empty* credential, npm sends blank auth, and the
registry answers **404 on the PUT** instead of falling back to OIDC. Removing
the input is what makes trusted publishing reachable at all — not exporting
`NODE_AUTH_TOKEN` isn't sufficient, the `.npmrc` file is.

**A failed OIDC exchange is silent.** npm reports only `ENEEDAUTH` ("you need to
run npm login"), which reads like a missing token. Re-run the publish with
`--loglevel verbose` and the real answer appears:

```
npm http fetch POST 404 …/-/npm/v1/oidc/token/exchange/package/@gabvdl%2fui
npm verbose oidc Failed token exchange request …: OIDC token exchange error - package not found
```

`package not found` there does **not** mean the package is missing (it is public
and exists) — it means **no trusted-publisher config matches**. Fix the entry in
step 1 above, then just re-run the job; the tag needn't move, since the workflow
file at the tagged commit is already correct. A healthy exchange logs
`POST 201 … Successfully retrieved and set token`.

## Private verdaccio (dev builds)

For homelab work-in-progress — no tag, no public release:

```bash
# from the homelab repo root, registry profile up (make up.registry)
./services/registry/publish.sh
```

Same rule: bump `packages/ui/package.json` first, verdaccio rejects
re-publishing an existing version.
