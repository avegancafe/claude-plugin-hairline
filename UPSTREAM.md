# Upstream

`skills/hairline-create/` and `skills/hairline-adopt/` are copied from
[`lucasmarkes/hairline`](https://github.com/lucasmarkes/hairline) (`skills/`),
MIT-licensed, copyright (c) 2026 Lucas Marques. See [`LICENSE`](LICENSE).

- **Upstream commit:** `37d2e78dcb333ab30c3338e28ed4a690364ea014` (2026-10-14)
- **Copied:** 2026-10-30
- **Changes from upstream:**
  - `hairline-adopt/SKILL.md` invokes `/hairline:hairline-create` instead of
    `/hairline-create`, because skills in a plugin are namespaced by the plugin name.
  - Added `hairline-create/render.mjs` (renders a built figure to MP4 or GIF) and
    the "Save as video" subsection of `hairline-create/SKILL.md` that documents it.

`kernel.js`, `bench.html` and `examples/` are upstream's own files and the skill
forbids editing them; keep them byte-identical to upstream.

## Syncing from upstream

```bash
git clone --depth 1 https://github.com/lucasmarkes/hairline.git /tmp/hairline
rsync -a --delete /tmp/hairline/skills/hairline-create/ skills/hairline-create/
rsync -a --delete /tmp/hairline/skills/hairline-adopt/ skills/hairline-adopt/
```

Then reapply the changes above (`rsync --delete` removes `render.mjs`, so restore it from git), update the commit here, and bump
`version` in `.claude-plugin/plugin.json`.

`extras/` is not from upstream; see [`README.md`](README.md).
