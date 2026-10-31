# hairline

Hairline figures for Claude Code: isometric line drawings, built from rounded
solids in a single stroke, that answer the pointer. Each figure ships as one
self-contained HTML file.

The skills are Lucas Marques' [`@lucasmarkes/hairline`](https://hairline.lucasmarkes.com)
skills, MIT-licensed and vendored here with one namespacing fix and an added
video renderer. See [`UPSTREAM.md`](UPSTREAM.md) and [`LICENSE`](LICENSE).

## Install

```bash
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
