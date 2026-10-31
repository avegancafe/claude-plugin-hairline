# hairline

Hairline figures for Claude Code: isometric line drawings, built from rounded
solids in a single stroke, that answer the pointer. Each figure ships as one
self-contained HTML file.

The skills are Lucas Marques' [`@lucasmarkes/hairline`](https://hairline.lucasmarkes.com)
skills, MIT-licensed and vendored here with one namespacing fix and an added
video renderer. See [`UPSTREAM.md`](UPSTREAM.md) and [`LICENSE`](LICENSE).

It lives in its own repo, [`avegancafe/claude-plugin-hairline`](https://github.com/avegancafe/claude-plugin-hairline),
and is listed in [`avegancafe-marketplace`](https://github.com/avegancafe/avegancafe-marketplace).

## Install

```bash
/plugin marketplace add avegancafe/avegancafe-marketplace
/plugin install hairline@avegancafe-marketplace
```

Restart Claude Code afterwards; plugins load at session start.

## Skills

| Skill | Purpose |
|-------|---------|
| `hairline:hairline-create` | Draws a new figure from an idea: offers concepts, writes the figure against the fixed engine (`kernel.js`) and page (`bench.html`), then builds, validates and looks at it (`build.mjs`, `validate.mjs`, `look.mjs`). On request, renders it to MP4 or GIF (`render.mjs`, needs `ffmpeg`). Needs `node`. |
| `hairline:hairline-adopt` | Takes an SVG (an icon, a logo, an illustration), reads it (`read.mjs`) and hands off to `hairline-create` to rebuild its object as a figure with a gesture. |

## Extras

`extras/viewer.template.html` is not part of upstream. It wraps a built
`hairline-<name>.html` in a frame that fills the window and names the figure's
slider. To use it, copy it next to the figure, rename the figure to
`figure.html`, replace `__TITLE__` and `__NAME__`, stamp `__VER__` with a short
hash of the built page (so a republish never serves a stale cached figure), and
add the figure's slider label and formatter to the `SLIDERS` table.

## Contributing

Change the skills here and open a PR. Keep `kernel.js`, `bench.html` and
`examples/` byte-identical to upstream, and record any other change from
upstream in [`UPSTREAM.md`](UPSTREAM.md). List a new skill in the table above and
bump `version` in [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json)
(minor for a new skill or feature, patch for a fix). CI runs
`claude plugin validate .`, checks every skill is listed here, and checks every
script parses.

## Releasing

Merging a `plugin.json` version bump to `main` is the release.
[`release.yml`](.github/workflows/release.yml) then sends a `plugin-released` event to
`avegancafe-marketplace`, whose sync workflow updates this plugin's entry there.

It needs the `MARKETPLACE_DISPATCH_TOKEN` repo secret: a fine-grained PAT scoped to
`avegancafe/avegancafe-marketplace` only, with Contents read & write.

```bash
gh secret set MARKETPLACE_DISPATCH_TOKEN -R avegancafe/claude-plugin-hairline
```

Without it the release run fails and the marketplace entry stops tracking new versions.
