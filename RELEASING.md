# Releasing `@gabvdl/ui`

Canonical remote is the homelab Gitea (`origin`); GitHub
([GabrielVidal1/design-system](https://github.com/GabrielVidal1/design-system))
is a push mirror that also runs CI and the npm release workflow
(`.github/workflows/publish.yml` — needs the `NPM_TOKEN` repo secret).

## Public npm release (on tag)

```bash
# 1. bump the version
$EDITOR packages/ui/package.json        # e.g. 0.0.14 → 0.0.15

# 2. commit and push BOTH remotes
git add -A && git commit -m "release: @gabvdl/ui 0.0.15"
git push origin main
git push github main

# 3. tag — the tag must equal the package version (CI enforces it)
git tag v0.0.15
git push github v0.0.15
```

CI then builds, typechecks, publishes to npm with `--provenance`, and creates a
GitHub Release. Pre-release tags (`v1.0.0-rc.1`) publish under the `next`
dist-tag, never `latest`.

## Private verdaccio (dev builds)

For homelab work-in-progress — no tag, no public release:

```bash
# from the homelab repo root, registry profile up (make up.registry)
./services/registry/publish.sh
```

Same rule: bump `packages/ui/package.json` first, verdaccio rejects
re-publishing an existing version.
