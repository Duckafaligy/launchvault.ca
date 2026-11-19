/* LaunchVault sections owned by the pages coder: the claim-vs-Stripe line race (#check), ticker mini charts on blog cards,
   and the Wayback timeline reveal. Loaded once per page from the blog cards block; guarded so a second copy does nothing.
   DATA (all real, nothing interpolated into the record):
   - DM Champ verified revenue per month: TrustMRR public profile trustmrr.com/startup/dm-champ.md, "Monthly revenue timeline",
     read from Stripe, synced 2026-11-17T21:34Z. Nov 2026 is a partial month and is left out.
   - DM Champ claim: ~$10,000 a month, Starter Story interview, Mar 2026 (Claimed).
   - Postiz: the series already on the site (founder posts and case study = Claimed; Nov 17 2026 TrustMRR = Verified). */
(() => {
  if (window.__lvPages) return; window.__lvPages = 1;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, NS = "http://www.w3.org/2000/svg";
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const money = v => "$" + Math.round(v).toLocaleString("en-US");
  const onView = (node, fn, t = .35) => { if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, {threshold: t}); io.observe(node); };
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  /* ---------------- #check: the line race ---------------- */
  const race = document.getElementById("race");
  if (race) {
    const V = [["Dec 2025",12263],["Jan 2026",6700],["Feb 2026",9117],["Mar 2026",10310],["Apr 2026",8275],["May 2026",7123],
               ["Jun 2026",8094],["Jul 2026",6998],["Aug 2026",6241],["Sep 2026",9936],["Oct 2026",28426]];
    const CLAIM = 10000, C0 = 3, N = V.length - 1, MAX = 30000;
    const plot = race.querySelector(".rc-plot"), svg = plot.querySelector("svg"), rv = race.querySelector("[data-rv]"), rc = race.querySelector("[data-rc]"),
          rm = race.querySelector("[data-rm]"), lead = race.querySelector("[data-lead]"), cap = race.querySelector("[data-cap]"), replay = race.querySelector(".rc-replay");
    const CAPS = i => i < C0 ? "TrustMRR's public record starts in Dec 2025. No interview yet."
      : i === C0 ? "The interview said about $10K a month. Stripe that month: $10,310. Neck and neck."
      : i < N - 1 ? "The claim stays at ~$10K. Stripe dips under it: " + money(V[i][1]) + " in " + V[i][0].split(" ")[0] + "."
      : i === N - 1 ? "Sep 2026: " + money(V[i][1]) + ". Stripe is right on the claim again."
      : "Oct 2026: Stripe overtakes. $28,426, about 2.8 times the claim.";
    let G = null, shown = -1, cur = reduce ? N : 0, anim = null, scrubbing = false;
    // monotone cubic (Fritsch-Carlson): smooth, passes through every real point, never overshoots between them
    const mono = P => {
      if (P.length < 2) return P.length ? `M${P[0][0]} ${P[0][1]}` : "";
      const n = P.length, dx = [], m = [], t = [];
      for (let i = 0; i < n - 1; i++) { dx[i] = P[i + 1][0] - P[i][0]; m[i] = dx[i] ? (P[i + 1][1] - P[i][1]) / dx[i] : 0; }
      t[0] = m[0]; t[n - 1] = m[n - 2];
      for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
      let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
      for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3;
        d += ` C${(P[i][0] + h).toFixed(1)} ${(P[i][1] + t[i] * h).toFixed(1)} ${(P[i + 1][0] - h).toFixed(1)} ${(P[i + 1][1] - t[i + 1] * h).toFixed(1)} ${P[i + 1][0].toFixed(1)} ${P[i + 1][1].toFixed(1)}`; }
      return d;
    };
    const draw = () => {
      const W = Math.max(280, plot.clientWidth), narrow = W < 560, H = narrow ? 250 : 330, L = narrow ? 44 : 56, R = narrow ? 18 : 28, T = 22, B = 34;
      const X = i => L + i / N * (W - L - R), Y = v => T + (1 - v / MAX) * (H - T - B), yc = Y(CLAIM), y0 = Y(0);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H); svg.innerHTML = "";
      const defs = el("defs", {}, svg);
      // tints between the two lines: green where Verified is above the claim, pop red where it is below; both fade toward the claim line
      const gUp = el("linearGradient", {id: "rcup", gradientUnits: "userSpaceOnUse", x1: 0, x2: 0, y1: T, y2: yc}, defs);
      el("stop", {offset: 0, "stop-color": "#34D399", "stop-opacity": .36}, gUp); el("stop", {offset: 1, "stop-color": "#34D399", "stop-opacity": .06}, gUp);
      const gDn = el("linearGradient", {id: "rcdn", gradientUnits: "userSpaceOnUse", x1: 0, x2: 0, y1: yc, y2: y0}, defs);
      el("stop", {offset: 0, "stop-color": "#E11D48", "stop-opacity": .42}, gDn); el("stop", {offset: .55, "stop-color": "#E11D48", "stop-opacity": .1}, gDn); el("stop", {offset: 1, "stop-color": "#E11D48", "stop-opacity": 0}, gDn);
      const xc = X(C0);
      el("rect", {x: xc, y: 0, width: W, height: yc}, el("clipPath", {id: "rcca"}, defs));
      el("rect", {x: xc, y: yc, width: W, height: H}, el("clipPath", {id: "rccb"}, defs));
      // scrub mask: full strength left of the cursor, ~25% to the right, with a soft edge
      const mg = el("linearGradient", {id: "rcmg", gradientUnits: "userSpaceOnUse", x1: 0, x2: W, y1: 0, y2: 0}, defs);
      const m1 = el("stop", {offset: 1, "stop-color": "#fff", "stop-opacity": 1}, mg), m2 = el("stop", {offset: 1, "stop-color": "#fff", "stop-opacity": .25}, mg);
      el("rect", {x: 0, y: 0, width: W, height: H, fill: "url(#rcmg)"}, el("mask", {id: "rcm", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: W, height: H}, defs));
      [0, 10000, 20000, 30000].forEach(v => { el("line", {x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: v ? "gl" : "gl b"}, svg);
        el("text", {x: L - 10, y: Y(v) + 4, "text-anchor": "end", class: "ax"}, svg).textContent = v ? "$" + v / 1000 + "K" : "$0"; });
      V.forEach((p, i) => { if (narrow ? ![0, 3, 6, N].includes(i) : i % 2 && i !== N) return;
        el("text", {x: X(i), y: H - 10, "text-anchor": i === 0 ? "start" : i === N ? "end" : "middle", class: "ax"}, svg).textContent = p[0].slice(0, 3) + " " + (narrow ? "'" + p[0].slice(-2) : p[0].slice(-4)); });
      const fg = el("g", {}, svg);
            const up = el("path", {fill: "url(#rcup)", "clip-path": "url(#rcca)"}, fg), dn = el("path", {fill: "url(#rcdn)", "clip-path": "url(#rccb)"}, fg);
      const cl = el("path", {class: "cl"}, fg), vl = el("path", {class: "vl"}, fg);
      const dots = V.map((p, i) => el("circle", {cx: X(i), cy: Y(p[1]), r: 3.5, class: "vd"}, fg));
      const hc = el("g", {class: "hc"}, fg); el("circle", {r: 5.5}, hc);
      const hv = el("g", {class: "hv"}, fg); el("circle", {r: 6.5}, hv);
      const cross = el("line", {y1: T - 6, y2: y0, class: "cx"}, svg);
      const tv = el("text", {class: "pv v", "text-anchor": "middle"}, svg);
      // short in-chart labels (provenance lives in the legend): claim label above the line where Verified sits below it; end value left of the end dot
      const lc = el("text", {x: X(narrow ? 5 : 5.5), y: yc - 12, "text-anchor": "middle", class: "lab c"}, svg); lc.textContent = "Claimed ~$10K";
      const lv = el("text", {x: X(N) - 18, y: Y(V[N][1]) + 5, "text-anchor": "end", class: "lab v"}, svg); lv.textContent = money(V[N][1]);
      const ov = el("g", {class: "ovk"}, svg); el("circle", {cx: X(N), cy: Y(V[N][1]), r: 7}, ov);
      const hit = el("rect", {x: L, y: T, width: W - L - R, height: y0 - T, fill: "transparent"}, svg);
      hit.addEventListener("pointermove", e => { if (anim) return; const r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width; scrub(Math.max(0, Math.min(N, Math.round((mx - L) / (W - L - R) * N)))); });
      hit.addEventListener("pointerleave", () => { if (!anim) unscrub(); });
      G = {X, Y, W, yc, y0, up, dn, cl, vl, dots, cross, hc, hv, tv, ov, lc, lv, fg, m1, m2};
      render(cur); if (scrubbing) unscrub();
    };
    const render = t => {
      const {X, Y, yc, y0, up, dn, cl, vl, dots, hc, hv, ov} = G, i = Math.floor(t), f = t - i;
      const pts = V.slice(0, i + 1).map((p, k) => [X(k), Y(p[1])]);
      if (f > 0 && i < N) pts.push([X(i + f), Y(V[i][1] + (V[i + 1][1] - V[i][1]) * f)]);
      const d = mono(pts), hx = pts.at(-1)[0].toFixed(1);
      vl.setAttribute("d", d);
      if (t >= C0) {
        const band = d + ` L${hx} ${yc.toFixed(1)} L${pts[0][0]} ${yc.toFixed(1)} Z`;   // clipped to x >= Mar 2026, then split at the claim line
        up.setAttribute("d", band); dn.setAttribute("d", band);
        cl.setAttribute("d", `M${X(C0)} ${yc} L${hx} ${yc}`); hc.setAttribute("transform", `translate(${hx},${yc})`); hc.style.opacity = 1;
      } else { up.setAttribute("d", ""); dn.setAttribute("d", ""); cl.setAttribute("d", ""); hc.style.opacity = 0; }
      dots.forEach((c, k) => c.classList.toggle("on", k <= t));
      const head = pts.at(-1); hv.setAttribute("transform", `translate(${head[0]},${head[1]})`);
      ov.classList.toggle("on", t >= N); G.lc.classList.toggle("on", t >= C0 + 1.5); G.lv.classList.toggle("on", t >= N);
    };
    // scrub: the whole chart stays drawn; right of the cursor fades to ~25%; the month's point carries its value
    const scrub = i => {
      const {X, Y, W, fg, m1, m2, cross, hv, tv, lv} = G;
      if (!scrubbing) { scrubbing = true; cur = N; render(N); fg.setAttribute("mask", "url(#rcm)"); }
      const x = X(i); m1.setAttribute("offset", Math.min(1, (x + 4) / W)); m2.setAttribute("offset", Math.min(1, (x + 26) / W));
      cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.style.opacity = 1;
      hv.setAttribute("transform", `translate(${x},${Y(V[i][1])})`);
      tv.setAttribute("x", x); tv.setAttribute("y", Y(V[i][1]) - 14); tv.setAttribute("text-anchor", i === 0 ? "start" : i === N ? "end" : "middle"); tv.textContent = money(V[i][1]); tv.style.opacity = 1;
      lv.style.opacity = i === N ? 0 : "";
      set(i);
    };
    const unscrub = () => { const {fg, cross, tv, lv} = G; scrubbing = false; fg.removeAttribute("mask"); cross.style.opacity = 0; tv.style.opacity = 0; lv.style.opacity = ""; render(N); set(N); };
    const tween = (node, to, pre = "") => { const from = +node.dataset.v || 0; node.dataset.v = to; if (reduce || !to || !from) { node.textContent = to ? pre + money(to) : "Not yet"; return; }
      const t0 = performance.now(); const st = now => { const k = Math.min(1, (now - t0) / 220); node.textContent = pre + money(from + (to - from) * k); if (k < 1) requestAnimationFrame(st); }; requestAnimationFrame(st); };
    const set = i => {
      if (i === shown) return; shown = i;
      const v = V[i][1], c = i >= C0 ? CLAIM : 0;
      rm.textContent = V[i][0]; tween(rv, v); if (c) tween(rc, c, "~"); else { rc.dataset.v = 0; rc.textContent = "Not yet"; }
      const gap = v - c, close = c && Math.abs(gap) / c < .05;
      lead.className = "rc-lead " + (!c ? "none" : close ? "tie" : gap > 0 ? "v" : "c");
      lead.textContent = !c ? "No claim yet" : close ? "Within " + Math.round(Math.abs(gap) / c * 100) + "%: neck and neck" : gap > 0 ? "Stripe ahead by " + money(gap) : "Claim ahead by " + money(-gap);
      if (cap) cap.textContent = CAPS(i);
      race.classList.toggle("over", i === N);
    };
    const run = () => { if (reduce) { set(N); return; } cancelAnimationFrame(anim); const t0 = performance.now(), DUR = 5200; race.classList.add("running");
      const step = now => { const k = Math.min(1, (now - t0) / DUR), t = ease(k) * N; cur = t; render(t); set(Math.min(N, Math.floor(t + .02)));
        if (k < 1) anim = requestAnimationFrame(step); else { anim = null; race.classList.remove("running"); set(N); } };
      anim = requestAnimationFrame(step); };
    draw(); set(reduce ? N : 0);
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 80); });
    if (replay) replay.addEventListener("click", () => { if (scrubbing) unscrub(); shown = -1; cur = 0; run(); });
    onView(race, run, .4);
  }

  /* ---------------- ticker mini charts on blog cards ---------------- */
  $$(".tkr[data-series]").forEach(box => {
    let S; try { S = JSON.parse(box.dataset.series); } catch { return; }
    const svg = box.querySelector("svg.tk-c"), val = box.querySelector(".tk-v b"), dt = box.querySelector(".tk-d"), unit = box.dataset.unit || "";
    const LB = {v: "Verified", c: "Claimed", x: "Sources differ"};
    const W = 300, H = 84, P = 6, max = Math.max(...S.map(s => s[1])) * 1.06, n = S.length - 1;
    const xs = S.map((s, i) => s[3] ?? i), X = i => P + (xs[i] - xs[0]) / (xs[n] - xs[0]) * (W - 2 * P), Y = v => H - 4 - v / max * (H - 12);
    const near = fx => { let b = 0; xs.forEach((x, i) => { if (Math.abs(X(i) / W - fx) < Math.abs(X(b) / W - fx)) b = i; }); return b; };
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("preserveAspectRatio", "none");
    const d = S.map((s, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(s[1]).toFixed(1)).join(" ");
    el("path", {d: d + ` L${X(n)} ${H} L${X(0)} ${H} Z`, class: "ar"}, svg);
    el("path", {d, class: "ln", pathLength: 1}, svg);
    const rule = el("line", {y1: 0, y2: H, class: "rl"}, svg);
    const dot = box.querySelector(".tk-dot"), last = S[n];
    const put = (i, hover) => { const s = S[i];
      dot.style.left = X(i) / W * 100 + "%"; dot.style.top = Y(s[1]) / H * 100 + "%"; dot.dataset.k = s[2];
      val.textContent = money(s[1]); dt.innerHTML = `${s[0]} · <span class="lb ${s[2]}">${LB[s[2]]}</span>`;
      rule.setAttribute("x1", X(i)); rule.setAttribute("x2", X(i)); rule.style.opacity = hover ? 1 : 0; box.classList.toggle("hov", !!hover); };
    put(n);
    const plot = box.querySelector(".tk-plot");
    plot.addEventListener("pointermove", e => { const r = plot.getBoundingClientRect(); put(near((e.clientX - r.left) / r.width), true); });
    plot.addEventListener("pointerleave", () => put(n));
    if (reduce) box.classList.add("drawn"); else onView(box, () => box.classList.add("drawn"), .5);
  });

  /* ---------------- Wayback timeline + comparison bars: reveal once ---------------- */
  $$(".wbt, .tk-bars").forEach(t => reduce ? t.classList.add("in") : onView(t, () => t.classList.add("in"), .25));
})();
