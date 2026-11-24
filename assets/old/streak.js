// Site streak (spacefs-style): thousands of tiny red-to-orange particles drifting along an S-shaped wave.
// One fixed full-screen canvas behind the light sections only; dark sections and the footer cover it.
// 2026-11-21 smoothness pass (owner views over a remote-desktop stream): ~30 fps cap, 1x pixels on big/dense
// screens, pauses when hidden or covered, rebuilds only after a resize settles (the old frame stretches meanwhile).
(() => {
  if (document.querySelector(".welcome")) return;                                       // sign-in page covers the whole window: nothing would show
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches, small = innerWidth < 760, LANES = 34, STEP = 1000 / 30 - 2;
  const A = [225, 29, 72], B = [255, 138, 0], CQ = 16, AQ = 10, STY = [];             // #E11D48 -> #FF8A00, pre-built colour x alpha styles
  for (let c = 0; c < CQ; c++) for (let a = 0; a < AQ; a++) { const k = c / (CQ - 1), m = i => A[i] + (B[i] - A[i]) * k | 0; STY.push(`rgba(${m(0)},${m(1)},${m(2)},${((a + 1) / AQ).toFixed(2)})`); }
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;      // ~[-1,1], dense in the middle
  const ratio = () => { const d = devicePixelRatio || 1; return innerWidth > 1600 || d > 1.5 ? 1 : Math.min(d, 1.5); };

  // cv: canvas, n: dot count, live(): whether to keep animating
  const wave = (cv, n, live) => {
    const ctx = cv.getContext("2d"), P = [], bins = STY.map(() => []);
    for (let i = 0; i < n; i++) P.push({ x: Math.random(), lane: Math.floor(Math.random() * LANES), j: gauss() * .35, v: .00004 * 2 + Math.random() * .00008 * 2, a: Math.random() });  // 2x speed per frame at half the frames
    let W, H, dpr, sy = scrollY, t0 = performance.now(), last = 0, running = false;
    const size = () => { dpr = ratio(); W = innerWidth; H = innerHeight; cv.width = Math.max(1, W * dpr | 0); cv.height = Math.max(1, H * dpr | 0); };
    const draw = now => {
      const t = (now - t0) / 1000 + sy * .0015;                                          // scrolling nudges the wave too
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const band = Math.min(H * .36, 340), d = Math.max(1.35, 1.85 * dpr) / dpr;
      for (const b of bins) b.length = 0;
      for (const p of P) {
        if (!still) p.x = (p.x + p.v) % 1;
        const x = p.x, sx = x * W;
        const off = ((p.lane + .5) / LANES - .5) * 2 + p.j;                              // lanes give the fine striations
        const cy = H * (.96 - .68 * x) + Math.sin(x * 5.4 + t * .22) * H * .09;          // S-curve rising left to right, slow sway
        const y = cy + off * band * (.75 + .25 * Math.sin(x * 3.1 + 1 + t * .15)) + Math.sin(x * 40 + p.lane) * 2;
        const edge = Math.min(1, x / .06, (1 - x) / .06), core = 1 - Math.min(1, Math.abs(off));
        const al = edge * core * (.55 + .45 * p.a);
        if (al < .03) continue;
        bins[Math.min(CQ - 1, x * CQ | 0) * AQ + Math.min(AQ - 1, al * AQ | 0)].push(sx, y);
      }
      for (let i = 0; i < bins.length; i++) { const b = bins[i]; if (!b.length) continue; ctx.fillStyle = STY[i]; for (let j = 0; j < b.length; j += 2) ctx.fillRect(b[j], b[j + 1], d, d); }
    };
    const frame = now => {
      if (still || !live() || document.hidden) { running = false; return; }
      if (now - last >= STEP) { last = now; draw(now); }                                 // ~30 fps: half the paint work, still smooth for a slow drift
      requestAnimationFrame(frame);
    };
    let queued = false;
    const kick = () => { if (still) { if (!queued) { queued = true; requestAnimationFrame(n => { queued = false; draw(n); }); } return; } if (!running && live() && !document.hidden) { running = true; requestAnimationFrame(frame); } };
    size();
    let rz = 0;                                                                          // live window drag: keep the old (stretched) frame, rebuild once it settles
    addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { size(); if (still) draw(performance.now()); else last = 0; }, 150); });
    addEventListener("scroll", () => { sy = scrollY; if (still) kick(); }, { passive: true });
    document.addEventListener("visibilitychange", kick);
    return kick;
  };

  const make = cls => { const c = document.createElement("canvas"); c.className = cls; c.setAttribute("aria-hidden", "true"); return c; };

  // the footer covers the canvas once its top passes the top quarter of the window: watched by an observer, not read per frame
  const foot = document.querySelector("footer.foot");
  let covered = false, kickBg = () => {};
  if (foot && "IntersectionObserver" in window) new IntersectionObserver(es => { covered = es[es.length - 1].isIntersecting; if (!covered) kickBg(); }, { rootMargin: "0px 0px -75% 0px" }).observe(foot);
  const bg = make("streak"); document.body.prepend(bg);
  kickBg = wave(bg, small ? 8800 : 28800, () => !covered); kickBg();
  // Dark sections (.dk) and the footer are opaque, so they cover the wave: dots show on light sections only (owner's call).
})();
