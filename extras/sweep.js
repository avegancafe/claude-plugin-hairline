/**
 * Sweep: brute force and a pruned search on twin boards, same points, same probe, one clock.
 * Brute force measures every point; pruned checks 36 cells, then only points in reach. A board
 * that has finished draws its ring solid; the slider sets how many points. The example for a computation shown step by step: one brute-force pass (PASS) fits inside
 * one tour stop (the kernel's DWELL), so a stranger watching the lap sees a side finish.
 */
const {
  Cam, clamp, circ, facing, fit, flatDot, place, poly, prism, proj, ringAt, rings, seg, unproj, spring, stepS,
  tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const EXT = 90, GAP = 22, D = EXT + GAP, PB = 4, TL = 7, TT = 1, DOT = 0.4, PASS = 900, REST = [70, 30];
const STEM = 1.8, DISC = 6, PH = 24, DT = 2.5, R = 14, SETTLE = 100;

/** Points, from a fixed seed: a town, a hamlet and a thin scatter, none closer than 1.7, shuffled so any first N keep the same shape. */
function points() {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const out = [], groups = [[26, 63, 11, 265], [68, 27, 8, 118], [0, 0, 0, 117]];
  for (const [cx, cy, sd, n] of groups) {
    let made = 0, tries = 0;
    while (made < n && tries++ < 200000) {
      const x = sd ? cx + gauss() * sd : 5 + rnd() * (EXT - 10), y = sd ? cy + gauss() * sd : 5 + rnd() * (EXT - 10);
      if (x < 4 || y < 4 || x > EXT - 4 || y > EXT - 4 || out.some((p) => Math.hypot(p.x - x, p.y - y) < 1.7)) continue;
      out.push({ x, y }); made++;
    }
  }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
const POINTS = points();

/** One board at world offset (ox, oy), cut n × n, with the schedule its search follows. */
function board(parent, C, P, front, ox, oy, n) {
  const g = mk("g", {}, parent), cs = EXT / n, unit = circ(1, 40);
  const [br, bi] = rings(ox - 5, oy - 5, ox + EXT + 5, oy + EXT + 5, 8, 1.8);
  put(solid(g), prism(P, front, br, bi, -PB, 0));
  const cells = [], order = [];
  for (let s = 0; s <= 2 * (n - 1); s++) for (let i = 0; i < n; i++) {
    const j = s - i, x0 = i * cs, y0 = j * cs;
    if (j < 0 || j >= n) continue;
    const [r0, r1] = rings(ox + x0 + 0.7, oy + y0 + 0.7, ox + x0 + cs - 0.7, oy + y0 + cs - 0.7, 2.2, 0.7);
    // The brute-force board is one cell, always in play: it has nothing to skip.
    cells.push({ x0, y0, x1: x0 + cs, y1: y0 + cs, r0, r1, tw: tween(n === 1 ? TL : 0), el: solid(g), drawn: NaN, pegs: [] });
  }
  const pegs = POINTS.map((m, i) => {
    const cell = cells.find((c) => m.x >= c.x0 && m.x <= c.x1 && m.y >= c.y0 && m.y <= c.y1);
    const p = { ...m, i, cell, top: null, drawn: NaN };
    return cell.pegs.push(p), p;
  });
  for (const c of cells) {
    g.appendChild(c.el.g); order.push({ g: c.el.g, key: c.x0 + c.y0 });
    for (const p of c.pegs.sort((a, b) => a.x + a.y - (b.x + b.y))) {
      p.top = flatDot(g, C, DOT, "dot off"); order.push({ g: p.top, key: p.x + p.y });
    }
  }
  const pin = mk("g", {}, g), ring = mk("path", { class: "dash nf" }, pin), line = mk("path", { class: "dash nf" }, pin);
  const stem = solid(pin), disc = solid(pin);
  let pinAfter = null, pinDrawn = "", steps = [], done = 0, lit = null, measured = 0;
  const zOf = (x, y) => (cells.find((c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) || cells[0]).drawn + TT;

  function drawPin(x, y) {
    const z = zOf(x, y), key = [x, y, z].map((v) => v.toFixed(2)).join();
    if (key === pinDrawn) return;
    pinDrawn = key;
    let after = order[0].g;
    for (const o of order) if (o.key < x + y) after = o.g;
    if (after !== pinAfter) { pinAfter = after; after.after(pin); }
    const X = ox + x, Y = oy + y;
    ring.setAttribute("d", poly(ringAt(P, unit.map((q) => ({ ...q, u: X + q.u * R, v: Y + q.v * R })), TL + TT)));
    const [s0, s1] = rings(X - STEM, Y - STEM, X + STEM, Y + STEM, STEM, 0.5);
    put(stem, prism(P, front, s0, s1, z, z + PH));
    const [d0, d1] = rings(X - DISC, Y - DISC, X + DISC, Y + DISC, DISC, 1.2);
    put(disc, prism(P, front, d0, d1, z + PH, z + PH + DT));
  }

  function light(el) { if (lit === el) return; if (lit) lit.classList.remove("hi"); lit = el; if (lit) lit.classList.add("hi"); }

  let active = POINTS.length;
  return {
    /** Shows the first k points; the rest are off the board. */
    show(k) { active = k; for (const p of pegs) p.top.setAttribute("display", p.i < k ? "inline" : "none"); },
    /** A new question: every cell drops and every point goes back to untested; the schedule is rebuilt. */
    plan(x, y, now) {
      steps = []; done = 0; measured = 0; light(null); line.setAttribute("d", ""); ring.setAttribute("class", "dash nf");
      for (const c of cells) {
        if (n === 1) continue;
        const dx = Math.max(c.x0 - x, 0, x - c.x1), dy = Math.max(c.y0 - y, 0, y - c.y1);
        tset(c.tw, 0, now, 0); steps.push({ c, on: Math.hypot(dx, dy) <= R });
      }
      const tested = (n > 1 ? steps.filter((s) => s.on).flatMap((s) => s.c.pegs) : pegs.slice().sort((a, b) => a.x + a.y - (b.x + b.y))).filter((p) => p.i < active);
      for (const p of pegs) p.top.setAttribute("class", "dot off");
      for (const p of tested) steps.push({ p, on: Math.hypot(p.x - x, p.y - y) <= R });
    },
    /** Plays the schedule up to step k; returns the steps taken and whether any remain. */
    run(k, x, y) {
      for (; done < Math.min(k, steps.length); done++) {
        const s = steps[done];
        if (s.c) { if (s.on) tset(s.c.tw, TL, performance.now(), 0); continue; }
        measured++;
        s.p.top.setAttribute("class", s.on ? "dot" : "dot m");
      }
      const cur = steps[done];
      if (!cur) { light(null); line.setAttribute("d", ""); ring.setAttribute("class", "nf"); return { taken: steps.length, measured, left: false }; }
      light(cur.c ? cur.c.el.sil : null);
      line.setAttribute("d", cur.p ? seg(P(ox + x, oy + y, zOf(x, y)), P(ox + cur.p.x, oy + cur.p.y, cur.p.cell.drawn + TT)) : "");
      return { taken: done, measured, left: true };
    },
    /** Advances every tween to now and redraws what changed; returns whether anything still moves. */
    tick(now, x, y) {
      let m = false;
      for (const c of cells) {
        const z = tval(c.tw, now);
        if (!tdone(c.tw, now)) m = true;
        if (z !== c.drawn) { c.drawn = z; put(c.el, prism(P, front, c.r0, c.r1, 0, z + TT)); }
      }
      for (const p of pegs) {
        const z = p.cell.drawn + TT;
        if (z !== p.drawn) { p.drawn = z; place(p.top, P(ox + p.x, oy + p.y, z)); }
      }
      drawPin(x, y);
      return m;
    },
  };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.22);
  // Brute force on the left (+y runs down-left), pruned on the right (+x runs down-right): equal depth, side by side.
  const A = [0, D], Bo = [D, 0];
  fit(C, [[-5, D - 5, -PB], [EXT + 5, D + EXT + 5, -PB], [D + EXT + 5, EXT + 5, -PB], [D - 5, -5, -PB], [D - 5, -5, PH + DT + TL], [-5, D - 5, PH + DT + TL]], 200, 166);
  const P = proj(C), front = facing(C);
  // One step costs the same on both boards; the brute-force pass, every point, always takes PASS ms.
  let N = Math.round(value), ms = PASS / N, over = null, t0 = performance.now() + SETTLE, planned = false;

  const g = mk("g", {}, svg);
  const naive = board(g, C, P, front, A[0], A[1], 1), pruned = board(g, C, P, front, Bo[0], Bo[1], 6);
  naive.show(N); pruned.show(N);
  const px = spring(REST[0]), py = spring(REST[1]);

  const B = register(stage, (dt, now) => {
    let m = false;
    if (stepS(px, dt)) m = true;
    if (stepS(py, dt)) m = true;
    const [x, y] = [px.t, py.t];
    // The searches start only once the probe has settled: a question is asked where the hand rests.
    if (now >= t0) {
      if (!planned) { planned = true; naive.plan(x, y, now); pruned.plan(x, y, now); }
      const k = Math.floor((now - t0) / ms) + 1, a = naive.run(k, x, y), b = pruned.run(k, x, y);
      if (a.left || b.left) m = true;
      read.textContent = over ? `brute ${a.taken}${a.left ? "" : " done"} · pruned ${b.taken}${b.left ? "" : " done"}` : "rest";
    } else m = true;
    if (naive.tick(now, px.x, py.x)) m = true;
    if (pruned.tick(now, px.x, py.x)) m = true;
    return m;
  });
  bag.add(B.unregister);

  /** Each move moves the probe's target and restarts the searches once it settles. */
  function retarget() {
    const [x, y] = over || REST;
    if (x === px.t && y === py.t && planned) return;
    px.t = x; py.t = y; planned = false; t0 = performance.now() + SETTLE;
    if (!over) read.textContent = "rest";
    B.wake();
  }

  /** The pointer on either board, as a point in that board's own coordinates; null between them. */
  function local([sx, sy]) {
    const w = unproj(C, sx, sy, 0);
    for (const o of [A, Bo]) {
      const x = w[0] - o[0], y = w[1] - o[1];
      if (x > -8 && y > -8 && x < EXT + 8 && y < EXT + 8) return [clamp(x, 5, EXT - 5), clamp(y, 5, EXT - 5)];
    }
    return null;
  }

  bag.add(pointer(stage, {
    move: (p) => { over = local(p); retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());
  read.textContent = "rest";

  return {
    set: (v) => { N = Math.round(v); ms = PASS / N; naive.show(N); pruned.show(N); planned = false; t0 = performance.now() + SETTLE; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "sweep",
  means: "Two searches on one clock: brute force measures every point, pruned checks 36 cells first. More points, bigger gap.",
  rules: [1, 2, 7, 8],
  range: [60, 200, 500],
  tour: [[295, 204], [332, 175], [265, 173], null],
  mount,
});
