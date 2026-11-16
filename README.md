# Hammerkit - GitHub Action

Installs [hammerkit](https://github.com/no0dles/hammerkit) so later steps can run
`hammerkit`. It downloads hammerkit's single-file binary from the
[GitHub release](https://github.com/no0dles/hammerkit/releases) for the runner's
platform — Linux, macOS and Windows, x64 and arm64 — and puts it on `PATH`. That
takes a few seconds; v1 ran `npm install --global`, which took 20–50 s.

The binary needs no Node.js, so there is no `actions/setup-node` step for it.

## Usage

```yaml
name: ci
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: no0dles/hammerkit-github-action@v2
        with:
          version: 2.0.0   # pin it; defaults to latest
      - run: hammerkit build
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `version` | `latest` | A hammerkit version (`2.0.0`) or an npm dist-tag (`latest`, `next`). |

- **An exact version** (`2.0.0`, `2.1.0-next.6`) is installed as it is. Pin one so a
  hammerkit release never changes your build unannounced.
- **`latest`** is the newest stable release.
- **`next`** follows the next channel, hammerkit's prereleases.

A dist-tag is resolved with the npm registry (`registry.npmjs.org/hammerkit/<tag>`); the
npm CLI isn't needed for it.

## Outputs

| Output | Description |
|---|---|
| `version` | The version put on `PATH`, with a dist-tag resolved (`next` → `2.1.0-next.6`). |
| `cache-hit` | `true` if the binary came from the runner's tool cache instead of a download. |

```yaml
      - id: hammerkit
        uses: no0dles/hammerkit-github-action@v2
        with:
          version: next
      - run: echo "hammerkit ${{ steps.hammerkit.outputs.version }}"
```

## Caching on self-hosted runners

The binary is kept in the runner's tool cache, in the layout of
[`@actions/tool-cache`](https://github.com/actions/toolkit/tree/main/packages/tool-cache):
`$RUNNER_TOOL_CACHE/hammerkit/<version>/<arch>/`, with a `<arch>.complete` marker next to
it once the download has finished. A self-hosted runner keeps its tool cache between jobs
(by default `_work/_tool`), so it downloads each version once; later jobs take it from
there. An exact version is found there without any network request. GitHub-hosted runners
start every job with an empty tool cache, so they download it each time.

## Versions without a binary

Some older releases, such as 1.12.0 to 1.23.0, have no binaries, and there are none for a
platform other than x64 and arm64. For those the action falls back to
`npm install --global hammerkit@<version>`, with a notice in the log. Only that fallback
needs Node.js and npm on `PATH`: GitHub's hosted runners have them, and
`actions/setup-node` picks the version.

## v1

`@v1` still installs with `npm install --global` and needs Node.js on the runner. Moving
to `@v2` only takes dropping the `actions/setup-node` step, if it was there for hammerkit
alone.

For running an existing pipeline on hammerkit, see the
[CI migration guide](https://hammerkit.dev/docs/guides/migrate-ci).
