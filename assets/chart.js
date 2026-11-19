/* LaunchVault story chart: one renderer for the app reader and the generated blog posts.
   Data comes from the story JSON (design/data/stories/<slug>.json), embedded as <script type="application/json" class="lvchart-data">.
   Monotone curve through the REAL points (no invented values), label-styled points, numbered move markers on the axis,
   a fixed-size readout above the plot (nothing shifts on hover), keyboard + touch, reduced-motion safe. */
(() => {
  const NS = "http://www.w3.org/2000/svg", MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const mi = ym => { const [y, m] = ym.split("-").map(Number); return y * 12 + m - 1; };
  const mlab = i => MON[i % 12] + " " + Math.floor(i / 12);
  const money = v => "$" + Math.round(v).toLocaleString("en-US");
  const LBC = {"Verified": "v", "Live": "l", "Wayback": "w", "Claimed": "c", "Sources differ": "x", "Couldn't verify": "n", "Estimate": "e"};
  const chip = l => l ? `<span class="lb ${LBC[l] || "n"}">${l}</span>` : "";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  // Fritsch-Carlson monotone cubic: smooth, never overshoots between two real points
  const monotone = pts => {
    const n = pts.length; if (n < 2) return pts.length ? `M${pts[0][0]} ${pts[0][1]}` : "";
    if (n === 2) return `M${pts[0][0]} ${pts[0][1]}L${pts[1][0]} ${pts[1][1]}`;
    const dx = [], dy = [], s = [], m = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; s[i] = dy[i] / dx[i]; }
    m[0] = s[0]; m[n - 1] = s[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / s[i - 1] + (dx[i] + 2 * dx[i - 1]) / s[i]);
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3;
      d += `C${(pts[i][0] + h).toFixed(1)} ${(pts[i][1] + m[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)} ${(pts[i + 1][1] - m[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`; }
    return d;
  };
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  const short = v => v >= 1e6 ? "$" + +(v / 1e6).toFixed(1) + "M" : v >= 1000 ? "$" + +(v / 1000).toFixed(v >= 1e5 ? 0 : 1) + "K" : "$" + v;

  window.LVChart = function (root, D, hooks = {}) {
    const plot = root.querySelector(".plot"), svg = plot.querySelector("svg"), ro = root.querySelector(".readout");
    const S = D.series, pts = S.points.map(p => ({x: mi(p[0]), v: p[1], l: p[2] || S.label, s: p[3] || "", d: ((S.kind || {})[p[0]] ? S.kind[p[0]] + " · " : "") + ((S.point_dates || {})[p[0]] || mlab(mi(p[0]))), k: (S.kind || {})[p[0]]}));
    const alt = (S.alt || []).map(p => ({x: mi(p[0]) + .4, v: p[1], l: p[2] || "Sources differ", s: p[3] || "", d: mlab(mi(p[0])) + ", second source", alt: 1}));
    const x0 = Math.min(S.start ? mi(S.start) : Infinity, pts[0].x), x1 = pts.at(-1).x;
    // only moves inside the chart's months get an axis marker (earlier moves stay in the list)
    const moves = (D.moves || []).map((m, i) => ({...m, i, x: m.at ? mi(m.at) : NaN})).filter(m => m.x >= x0 && m.x <= x1);
    const top = nice(Math.max(...pts.map(p => p.v), ...alt.map(p => p.v)) * 1.05);
    let G = null, cur = -1;
    const draw = () => {
      const W = Math.max(280, plot.clientWidth), narrow = W < 560, H = narrow ? 230 : 300, L = 48, R = 12, T = 12, B = moves.length ? 54 : 30;
      const X = x => L + (x - x0) / Math.max(1, x1 - x0) * (W - L - R), Y = v => T + (1 - v / top) * (H - T - B);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H); svg.innerHTML = "";
      [0, .25, .5, .75, 1].forEach(f => { const v = top * f; el("line", {x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "gl"}, svg);
        el("text", {x: L - 8, y: Y(v) + 4, "text-anchor": "end", class: "ax"}, svg).textContent = short(v); });
      const yrs = []; for (let y = Math.ceil(x0 / 12) * 12; y <= x1; y += 12) yrs.push(y);
      yrs.forEach(x => el("text", {x: X(x), y: H - 4, "text-anchor": "middle", class: "ax"}, svg).textContent = narrow ? String(x / 12) : "Jan " + x / 12);
      if (S.empty_note && pts[0].x - x0 > 4 && !narrow) el("text", {x: X(x0) + 4, y: Y(0) - 8, class: "note"}, svg).textContent = S.empty_note;
      const P = pts.map(p => [X(p.x), Y(p.v)]), line = monotone(P);
      const area = el("path", {class: "area", d: line + `L${P.at(-1)[0].toFixed(1)} ${Y(0)}L${P[0][0].toFixed(1)} ${Y(0)}Z`}, svg);
      const ln = el("path", {class: "line", d: line}, svg);
      const cross = el("line", {y1: T, y2: H - B, class: "cross"}, svg);
      const all = pts.concat(alt);
      all.forEach(p => { const k = LBC[p.l] || "c", cx = X(p.x), cy = Y(p.v);
        if (k === "x") el("rect", {x: cx - 4, y: cy - 4, width: 8, height: 8, class: "pt x", transform: `rotate(45 ${cx} ${cy})`}, svg);
        else el("circle", {cx, cy, r: k === "v" ? 5 : 3.2, class: "pt" + (k === "v" ? " v" : "") + (p.k ? " kd" : "")}, svg);
        if (p.k) el("text", {x: cx - 8, y: cy - 10, "text-anchor": "end", class: "ax kdl"}, svg).textContent = p.k; });
      const hl = el("circle", {r: 7, class: "hl"}, svg);
      const mks = moves.map((m, i) => { const g = el("g", {class: "mk" + (m.turn ? " turn" : ""), tabindex: "-1", "aria-hidden": "true"}, svg);
        const cx = Math.min(Math.max(X(m.x), L + 9), W - R - 9) + (moves[i - 1] && Math.abs(X(moves[i - 1].x) - X(m.x)) < 18 ? 9 : 0);
        el("rect", {x: cx - 9, y: H - B + 8, width: 18, height: 18, rx: 4}, g); el("text", {x: cx, y: H - B + 21, "text-anchor": "middle"}, g).textContent = m.i + 1;
        g.addEventListener("pointerenter", () => showMove(i)); g.addEventListener("click", () => showMove(i)); return g; });
      const hit = el("rect", {x: L, y: T, width: W - L - R, height: H - B - T, fill: "transparent"}, svg);
      hit.addEventListener("pointermove", ev => { const r = svg.getBoundingClientRect(), mx = (ev.clientX - r.left) * W / r.width;
        let b = 0; all.forEach((p, i) => { if (Math.abs(X(p.x) - mx) < Math.abs(X(all[b].x) - mx)) b = i; }); showPoint(all[b]); });
      hit.addEventListener("pointerleave", () => showDefault());
      G = {X, Y, cross, hl, mks, area, ln, H, B};
      // the line is visible by default (print, screenshots, no IntersectionObserver); it only replays a draw-in once, when first scrolled into view
      if (!reduce && !root.dataset.drawn && "IntersectionObserver" in window) { root.dataset.drawn = 1;
        const io = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; io.disconnect(); const l = G.ln, a = G.area, len = l.getTotalLength(); if (!len) return;
          l.style.transition = "none"; l.style.strokeDasharray = len; l.style.strokeDashoffset = len; a.style.transition = "none"; a.style.opacity = 0;
          requestAnimationFrame(() => requestAnimationFrame(() => { l.style.transition = "stroke-dashoffset 1.2s cubic-bezier(.65,0,.35,1)"; l.style.strokeDashoffset = 0;
            a.style.transition = "opacity .6s ease .7s"; a.style.opacity = 1; setTimeout(() => { l.style.strokeDasharray = ""; }, 1400); })); }, {threshold: .35});
        io.observe(plot); }
      showDefault();
    };
    const setRO = (a, b, c) => { ro.innerHTML = `<b>${a}</b><span class="rd-d">${b}</span><span class="rd-s">${c}</span>`; };
    const mark = (x, y) => { G.cross.setAttribute("x1", x); G.cross.setAttribute("x2", x); G.cross.style.opacity = 1;
      if (y == null) G.hl.style.opacity = 0; else { G.hl.setAttribute("cx", x); G.hl.setAttribute("cy", y); G.hl.style.opacity = 1; } };
    const activate = i => { cur = i; G.mks.forEach((g, k) => g.classList.toggle("on", k === i)); if (hooks.move) hooks.move(i < 0 ? -1 : moves[i].i); };
    function showPoint(p) { mark(G.X(p.x), G.Y(p.v)); activate(-1); setRO(money(p.v) + (S.unit || ""), p.d, chip(p.l) + " " + esc(p.s)); }
    function showMove(i) { const m = moves[i], p = pts.find(q => q.x === m.x); mark(G.X(m.x), p ? G.Y(p.v) : null); activate(i);
      setRO(`Move ${m.i + 1}`, esc(m.when), `<span style="color:#0B1220;font-weight:600">${esc(m.text)}</span> · ${esc(m.detail || "")} ${chip(m.label)}`); }
    function showDefault() { const p = pts.at(-1); G.cross.style.opacity = 0; G.hl.style.opacity = 0; activate(-1);
      setRO(money(p.v) + (S.unit || ""), p.d, chip(p.l) + " " + esc(p.s)); }
    draw();
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 100); });
    return {showMove: n => { const k = moves.findIndex(m => m.i === n); if (k >= 0) showMove(k); else { const m = (D.moves || [])[n]; if (m) { activate(-1); G.cross.style.opacity = 0; G.hl.style.opacity = 0; setRO(`Move ${n + 1}`, esc(m.when), `<span style="color:#0B1220;font-weight:600">${esc(m.text)}</span> ${chip(m.label)}`); } } }, showDefault, moves};
  };

  // auto-mount every chart block on the page
  document.querySelectorAll(".lvchart").forEach(root => {
    let D; try { D = JSON.parse(root.querySelector(".lvchart-data").textContent); } catch { return; }
    const list = root.querySelector(".moves"), band = root.querySelector(".pband");
    const api = LVChart(root, D, {move: i => { if (list) list.querySelectorAll("button").forEach((b, k) => b.classList.toggle("on", k === i)); }});
    if (list) { list.addEventListener("pointerover", e => { const b = e.target.closest("button[data-i]"); if (b) api.showMove(+b.dataset.i); });
      list.addEventListener("focusin", e => { const b = e.target.closest("button[data-i]"); if (b) api.showMove(+b.dataset.i); });
      list.addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (b) api.showMove(+b.dataset.i); });
      list.addEventListener("pointerleave", () => api.showDefault()); }
    if (band) band.addEventListener("click", e => { const b = e.target.closest("button[data-ph]"); if (!b) return;
      band.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
      const t = document.getElementById("ph" + b.dataset.ph); if (t && !t.closest("[hidden]")) t.scrollIntoView({behavior: reduce ? "auto" : "smooth", block: "start"}); });
  });
})();
