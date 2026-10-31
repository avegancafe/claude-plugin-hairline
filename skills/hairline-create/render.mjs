#!/usr/bin/env node
/**
 * Render a built hairline page (hairline-<name>.html) to a saved MP4 or GIF.
 *
 *   node render.mjs hairline-sweep.html out.mp4 [options]
 *   node render.mjs hairline-sweep.html out.gif --seconds 20
 *
 * Options
 *   --seconds N     video length (default 30)
 *   --fps N         frame rate (default 60 for MP4, 50 for GIF)
 *   --speed X       page time per video time: 1 = the page's own pace (default), 0.5 = half speed
 *   --scale N       pixel density of the capture (default 3)
 *   --width N       output width in px (default 2560 for MP4, 1280 for GIF)
 *   --start MS      skip this much page time first (default 2100: the lap's first stop)
 *   --intensity X   slider position 0..1 (default: the page's default, 0.5)
 *   --no-play       hold the rest pose instead of playing the tour
 *   --at X,Y        hold the pointer at a viewBox point instead of playing
 *   --full          keep the whole plate instead of cropping to the read-out and the drawing
 *   --verify        also record 20 s of the page in real time and compare frame-to-frame motion
 *
 * Why it works this way
 *   - The page clock is installed and then PAUSED. Playwright's clock otherwise keeps running in
 *     real time, so each screenshot (~100 ms at scale 3) leaks into page time and the video plays
 *     many times too fast. Paused, each frame advances the page by exactly 1000 / fps * speed ms.
 *   - A GIF stores frame delays in hundredths of a second. Only 50, 25, 20 or 10 fps keep their pace
 *     (30 fps rounds to 3/100 s and plays ~10% fast), and browsers will not play faster than 50.
 *
 * Needs ffmpeg on PATH and playwright-core, which look.mjs installs once into its cache folder.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, renameSync } from "node:fs";
import { tmpdir, homedir, platform } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const [page, out] = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] || "").match(/^--(seconds|fps|speed|scale|width|start|intensity|at)$/));
if (!page || !out || !/\.(mp4|gif)$/.test(out)) {
  console.error("usage: node render.mjs hairline-<name>.html out.(mp4|gif) [options]");
  process.exit(2);
}
const opt = (k, d) => { const i = args.indexOf("--" + k); return i < 0 ? d : args[i + 1]; };
const flag = (k) => args.includes("--" + k);
const gif = out.endsWith(".gif");
const fps = Number(opt("fps", gif ? 50 : 60));
if (gif && 100 % (100 / fps) !== 0 && ![50, 25, 20, 10].includes(fps)) console.warn(`warning: a ${fps} fps GIF will not keep its pace; use 50, 25, 20 or 10`);
const seconds = Number(opt("seconds", 30)), speed = Number(opt("speed", 1)), scale = Number(opt("scale", 3));
const width = Number(opt("width", gif ? 1280 : 2560)), start = Number(opt("start", 2100));

const cache = process.env.HAIRLINE_LOOK_CACHE || (platform() === "darwin" ? join(homedir(), "Library/Caches/hairline-look")
  : platform() === "win32" ? join(process.env.LOCALAPPDATA || homedir(), "hairline-look") : join(homedir(), ".cache/hairline-look"));
let chromium;
try { ({ chromium } = createRequire(join(cache, "package.json"))("playwright-core")); }
catch { console.error(`playwright-core not found in ${cache}: run look.mjs once to install it`); process.exit(2); }

const q = new URLSearchParams({ w: "1200" });
if (opt("intensity")) q.set("intensity", opt("intensity"));
if (opt("at")) q.set("at", opt("at")); else if (!flag("no-play")) q.set("play", "1");
const url = pathToFileURL(resolve(page)).href + "?" + q;

async function launch() {
  try { return await chromium.launch({ channel: "chrome" }); } catch { return await chromium.launch(); }
}

const browser = await launch();
const dir = mkdtempSync(join(tmpdir(), "hairline-render-"));
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: scale });
  await p.clock.install();
  await p.goto(url);
  await p.clock.pauseAt(Date.now() + 200); // from here the page clock moves only when advanced
  // The plate, and inside it the read-out row and the drawing's own box.
  const box = await p.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const plate = r(document.querySelector(".plate")), read = r(document.getElementById("read"));
    const svg = document.querySelector("#stage svg"), g = svg.firstElementChild || svg;
    const bb = g.getBBox(), m = svg.getScreenCTM();
    const a = new DOMPoint(bb.x, bb.y).matrixTransform(m), z = new DOMPoint(bb.x + bb.width, bb.y + bb.height).matrixTransform(m);
    return { plate, readBottom: read.y + read.h, draw: { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y } };
  });
  for (let t = 0; t + 16 < start; t += 16) await p.clock.runFor(16);
  const n = Math.round(seconds * fps), step = 1000 / fps * speed;
  const clip = { x: box.plate.x, y: box.plate.y, width: box.plate.w, height: box.plate.h };
  for (let i = 0; i < n; i++) {
    await p.clock.runFor(step);
    await p.screenshot({ path: join(dir, String(i).padStart(6, "0") + ".png"), clip });
    if (i % fps === 0) process.stdout.write(`\rframes ${i}/${n}`);
  }
  process.stdout.write(`\rframes ${n}/${n}\n`);

  // Crop to the read-out row stacked over the drawing (the tour moves the drawing; the box is
  // taken at rest, so pad it), unless --full.
  const px = (v) => Math.max(0, Math.round(v * scale / 2) * 2);
  let crop = "null";
  if (!flag("full")) {
    const pad = 16, top = px(box.readBottom - box.plate.y + 8);
    const y0 = px(Math.max(box.draw.y - box.plate.y - pad - 30, 0)), y1 = px(Math.min(box.draw.y + box.draw.h - box.plate.y + pad, box.plate.h));
    crop = `split[a][b];[a]crop=iw:${top}:0:0[t];[b]crop=iw:${y1 - y0}:0:${y0}[d];[t][d]vstack`;
  }
  const input = ["-loglevel", "error", "-y", "-framerate", String(fps), "-i", join(dir, "%06d.png")];
  const tmp = out + ".part" + (gif ? ".gif" : ".mp4");
  if (gif) {
    execFileSync("ffmpeg", [...input, "-filter_complex", `[0]${crop},scale=${width}:-2:flags=lanczos,split[x][y];[x]palettegen=max_colors=32[p];[y][p]paletteuse=dither=none`, "-loop", "0", tmp]);
  } else {
    execFileSync("ffmpeg", [...input, "-filter_complex", `[0]${crop},scale=${width}:-2:flags=lanczos`, "-r", String(fps), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", tmp]);
  }
  renameSync(tmp, out);
  console.log(`wrote ${out}: ${seconds} s at ${fps} fps, ${n} frames, speed ${speed}x`);

  if (flag("verify")) {
    // Frame-to-frame motion of the drawing, at 25 fps, for the page in real time and for the file.
    const motion = (src, cropf) => {
      const meta = execFileSync("ffmpeg", ["-loglevel", "error", "-i", src, "-vf", `${cropf}scale=600:-2,format=gray,fps=25,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`, "-f", "null", "-"], { maxBuffer: 1 << 26 }).toString();
      const v = meta.split("\n").filter((l) => l.includes("YAVG")).map((l) => Number(l.split("=")[1])).sort((a, b) => a - b);
      return { mean: v.reduce((s, x) => s + x, 0) / v.length, p50: v[v.length >> 1], p90: v[Math.floor(v.length * 0.9)] };
    };
    const rec = mkdtempSync(join(tmpdir(), "hairline-real-"));
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, recordVideo: { dir: rec, size: { width: 1280, height: 1000 } } });
    const live = await ctx.newPage();
    await live.goto(url);
    await live.waitForTimeout(20000);
    await ctx.close();
    const webm = join(rec, readdirSync(rec).find((f) => f.endsWith(".webm")));
    const d = box.draw, pl = box.plate;
    const real = motion(webm, `crop=${Math.round(pl.w)}:${Math.round(d.h + 32)}:${Math.round(pl.x)}:${Math.round(d.y - 16)},`);
    const file = motion(out, "");
    const f = (m) => `mean ${m.mean.toFixed(3)}  p50 ${m.p50.toFixed(3)}  p90 ${m.p90.toFixed(3)}`;
    console.log(`motion, page in real time: ${f(real)}\nmotion, ${out}${" ".repeat(Math.max(0, 14 - out.length))}: ${f(file)}`);
    console.log(`ratio ${(file.mean / real.mean / speed).toFixed(2)} (about 1.0 when the file keeps the page's pace; frames include the read-out row, so expect some spread)`);
    rmSync(rec, { recursive: true, force: true });
  }
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
