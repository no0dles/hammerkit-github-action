# Hammerkit - GitHub Action

Installs [hammerkit](https://github.com/no0dles/hammerkit) so later steps can run
`hammerkit`. It installs with npm, so it needs Node.js on the runner — GitHub's
hosted runners have it; use `actions/setup-node` to pick the version.

## Usage

```yaml
name: ci
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - uses: no0dles/hammerkit-github-action@v1
        with:
          version: 1.7.0   # pin it; defaults to latest
      - run: hammerkit run build
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `version` | `latest` | A hammerkit version (`1.7.0`) or npm dist-tag (`latest`, `rc`). |

Pin a version so a hammerkit release never changes your build unannounced.

For running an existing pipeline on hammerkit, see the
[CI migration guide](https://no0dles.gitbook.io/hammerkit/).
