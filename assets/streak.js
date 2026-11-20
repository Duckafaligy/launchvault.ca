// Site streak (spacefs-style): thousands of tiny red-to-orange particles drifting along an S-shaped wave.
// One fixed full-screen canvas behind every page's content.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches, small = innerWidth < 760, LANES = 34;
  const A = [225, 29, 72], B = [255, 138, 0], CQ = 16, AQ = 10, STY = [];             // #E11D48 -> #FF8A00, pre-built colour x alpha styles
  for (let c = 0; c < CQ; c++) for (let a = 0; a < AQ; a++) { const k = c / (CQ - 1), m = i => A[i] + (B[i] - A[i]) * k | 0; STY.push(`rgba(${m(0)},${m(1)},${m(2)},${((a + 1) / AQ).toFixed(2)})`); }
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;      // ~[-1,1], dense in the middle

  // cv: canvas, box(): its CSS size, n: dot count, live(): whether to keep animating
  const wave = (cv, box, n, live) => {
    const ctx = cv.getContext("2d"), P = [], bins = STY.map(() => []);
    for (let i = 0; i < n; i++) P.push({ x: Math.random(), lane: Math.floor(Math.random() * LANES), j: gauss() * .35, v: .00004 + Math.random() * .00008, a: Math.random() });
    let W, H, dpr, t0 = performance.now(), running = false;
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); [W, H] = box(); cv.width = W * dpr; cv.height = H * dpr; };
    const frame = now => {
      const t = (now - t0) / 1000 + scrollY * .0015;                                     // scrolling nudges the wave too
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const band = Math.min(H * .34, 320), d = Math.max(1, 1.1 * dpr) / dpr;
      for (const b of bins) b.length = 0;
      for (const p of P) {
        if (!still) p.x = (p.x + p.v) % 1;
        const x = p.x, sx = x * W;
        const off = ((p.lane + .5) / LANES - .5) * 2 + p.j;                              // lanes give the fine striations
        const cy = H * (1.02 - .74 * x) + Math.sin(x * 5.4 + t * .22) * H * .09;          // S-curve rising left to right, slow sway
        const y = cy + off * band * (.75 + .25 * Math.sin(x * 3.1 + 1 + t * .15)) + Math.sin(x * 40 + p.lane) * 2;
        const edge = Math.min(1, x / .06, (1 - x) / .06), core = 1 - Math.min(1, Math.abs(off));
        const al = edge * core * (.45 + .55 * p.a);
        if (al < .03) continue;
        bins[Math.min(CQ - 1, x * CQ | 0) * AQ + Math.min(AQ - 1, al * AQ | 0)].push(sx, y);
      }
      for (let i = 0; i < bins.length; i++) { const b = bins[i]; if (!b.length) continue; ctx.fillStyle = STY[i]; for (let j = 0; j < b.length; j += 2) ctx.fillRect(b[j], b[j + 1], d, d); }
      if (!still && live() && !document.hidden) requestAnimationFrame(frame); else running = false;
    };
    const kick = () => { if (still) return frame(performance.now()); if (!running && live()) { running = true; requestAnimationFrame(frame); } };
    size(); addEventListener("resize", () => { size(); if (still) frame(performance.now()); });
    if (still) addEventListener("scroll", () => frame(performance.now()), { passive: true });
    document.addEventListener("visibilitychange", kick);
    return kick;
  };

  const make = cls => { const c = document.createElement("canvas"); c.className = cls; c.setAttribute("aria-hidden", "true"); return c; };

  const foot = document.querySelector("footer.foot");
  // the background wave rests (frozen, still drawn) once the footer covers most of the screen, so only one wave animates at a time
  const bgLive = () => scrollY < innerHeight;   // the wave sits at the top of the page (site.css masks it to the first screen), so it rests once that has scrolled away
  const bg = make("streak"); document.body.prepend(bg);
  const kickBg = wave(bg, () => [innerWidth, innerHeight], small ? 9400 : 34300, bgLive); kickBg();
  addEventListener("scroll", kickBg, { passive: true });

})();
