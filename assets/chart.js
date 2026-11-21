/* LaunchVault story chart: one renderer for the app reader and the generated blog posts.
   Data comes from the story JSON (data/stories/<slug>.json), embedded as <script type="application/json" class="lvchart-data">.
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
    const before = (D.moves || []).filter(m => m.w === "before").length;   // moves dated before the first month: counted at the left edge, listed below
    const top = nice(Math.max(...pts.map(p => p.v), ...alt.map(p => p.v)) * 1.05);
    let G = null, cur = -1, pinned = null, glide = false, tw = 0;
    const turnI = (moves.find(m => m.turn) || {i: -1}).i;   // the move shown when nothing is pinned (-1: show the latest point)
    const draw = () => { cancelAnimationFrame(tw);
      const W = Math.max(280, plot.clientWidth), narrow = W < 560, H = narrow ? 230 : 300, L = 48, R = 12, T = 30, B = moves.length || before ? 54 : 30;
      const X = x => L + (x - x0) / Math.max(1, x1 - x0) * (W - L - R), Y = v => T + (1 - v / top) * (H - T - B);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H); svg.innerHTML = "";
      const defs = el("defs", {}, svg);
      const gr = el("linearGradient", {id: "lvcg", x1: 0, x2: 0, y1: 0, y2: 1}, defs);
      el("stop", {offset: 0, "stop-color": "#2563EB", "stop-opacity": .2}, gr); el("stop", {offset: 1, "stop-color": "#2563EB", "stop-opacity": 0}, gr);
      const mg = el("linearGradient", {id: "lvmask-g", gradientUnits: "userSpaceOnUse", x1: 0, x2: W, y1: 0, y2: 0}, defs);
      const ms1 = el("stop", {offset: 1, "stop-color": "#fff", "stop-opacity": 1}, mg), ms2 = el("stop", {offset: 1, "stop-color": "#fff", "stop-opacity": .26}, mg);
      el("rect", {x: 0, y: 0, width: W, height: H, fill: "url(#lvmask-g)"}, el("mask", {id: "lvmask", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: W, height: H}, defs));
      [0, .25, .5, .75, 1].forEach(f => { const v = top * f; el("line", {x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "gl"}, svg);
        el("text", {x: L - 8, y: Y(v) + 4, "text-anchor": "end", class: "ax"}, svg).textContent = short(v); });
      // x axis: the first and last month are always named; a January in between is added where there is room
      el("text", {x: X(x0), y: H - 4, "text-anchor": "start", class: "ax"}, svg).textContent = mlab(x0);
      if (x1 > x0) el("text", {x: X(x1), y: H - 4, "text-anchor": "end", class: "ax"}, svg).textContent = mlab(x1);
      for (let y = Math.ceil(x0 / 12) * 12; y <= x1; y += 12) if (X(y) - X(x0) > 110 && X(x1) - X(y) > 110) el("text", {x: X(y), y: H - 4, "text-anchor": "middle", class: "ax"}, svg).textContent = narrow ? String(y / 12) : "Jan " + y / 12;
      if (before) { const g = el("g", {class: "bf", "aria-hidden": "true"}, svg); el("rect", {x: L, y: H - B + 8, width: 34, height: 18, rx: 4}, g);
        el("text", {x: L + 17, y: H - B + 21, "text-anchor": "middle"}, g).textContent = "← " + before; el("title", {}, g).textContent = `${before} move${before > 1 ? "s" : ""} before ${mlab(x0)}`; }
      if (S.empty_note && pts[0].x - x0 > 4 && !narrow) el("text", {x: X(x0) + 4, y: Y(0) - 8, class: "note"}, svg).textContent = S.empty_note;
      const P = pts.map(p => [X(p.x), Y(p.v)]), line = monotone(P);
      const fg = el("g", {mask: "url(#lvmask)"}, svg);
      const area = el("path", {class: "area", fill: "url(#lvcg)", d: line + `L${P.at(-1)[0].toFixed(1)} ${Y(0)}L${P[0][0].toFixed(1)} ${Y(0)}Z`}, fg);
      const ln = el("path", {class: "line", d: line}, fg);
      const cross = el("line", {y1: T, y2: H - B, class: "cross"}, svg);
      const tsPill = el("g", {class: "tspill", opacity: 0}, svg);
      const tsRect = el("rect", {y: 0, height: 18, rx: 5, fill: "#0B1220"}, tsPill);
      const tsTxt = el("text", {y: 12.5, "text-anchor": "middle", fill: "#fff", "font-size": "12", "font-weight": "600"}, tsPill);
      const all = pts.concat(alt);
      all.forEach(p => { const k = LBC[p.l] || "c", cx = X(p.x), cy = Y(p.v);
        if (k === "x") el("rect", {x: cx - 4, y: cy - 4, width: 8, height: 8, class: "pt x", transform: `rotate(45 ${cx} ${cy})`}, fg);
        else el("circle", {cx, cy, r: k === "v" ? 5 : 3.2, class: "pt" + (k === "v" ? " v" : "") + (p.k ? " kd" : "")}, fg);
        if (p.k) el("text", {x: cx - (cy < 48 ? 12 : 8), y: cy < 48 ? cy + 4 : cy - 10, "text-anchor": "end", class: "ax kdl"}, fg).textContent = p.k; });
      const hl = el("circle", {r: 7, class: "hl"}, svg);
      const mks = moves.map((m, i) => { const g = el("g", {class: "mk" + (m.turn ? " turn" : ""), tabindex: "-1", "aria-hidden": "true"}, svg);
        const cx = Math.min(Math.max(X(m.x), L + (before ? 48 : 9)), W - R - 9) + (moves[i - 1] && Math.abs(X(moves[i - 1].x) - X(m.x)) < 18 ? 9 : 0);
        el("rect", {x: cx - 9, y: H - B + 8, width: 18, height: 18, rx: 4}, g); el("text", {x: cx, y: H - B + 21, "text-anchor": "middle"}, g).textContent = m.i + 1;
        g.addEventListener("pointerenter", () => showMove(i)); g.addEventListener("click", () => pin(m.i, true)); return g; });
      const hit = el("rect", {x: L, y: T, width: W - L - R, height: H - B - T, fill: "transparent"}, svg);
      hit.addEventListener("pointermove", ev => { const r = svg.getBoundingClientRect(), mx = (ev.clientX - r.left) * W / r.width;
        let b = 0; all.forEach((p, i) => { if (Math.abs(X(p.x) - mx) < Math.abs(X(all[b].x) - mx)) b = i; }); showPoint(all[b]); });
      hit.addEventListener("pointerleave", () => showDefault());
      G = {X, Y, W, cross, hl, mks, area, ln, H, B, ms1, ms2, tsPill, tsRect, tsTxt};
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
    // stepping glides the guide line, pill and mask from the last checkpoint; hover jumps straight there
    // while a move is pinned, the guide line, pill and mask stay on it (they always match the stepper); hovering only moves the ring
    const mark = (x, y, label) => { cancelAnimationFrame(tw);
      const hx = x, pm = pinned != null && moves.find(m => m.i === pinned);
      if (pinned != null && !pm) { G.hl.setAttribute("cx", x); G.hl.style.opacity = y == null ? 0 : 1; if (y != null) G.hl.setAttribute("cy", y); return; }   // pinned move sits before the chart: no line, no pill
      if (pm) { x = G.X(pm.x); label = pm.when; }
      const fx = G.mx, fy = G.my; G.mx = x; G.my = y;
      if (!glide || reduce || fx == null || fx === x) return place(x, y, label, hx);
      const t0 = performance.now(), f = now => { const k = Math.min(1, (now - t0) / 360), e = 1 - (1 - k) ** 3, mx = fx + (x - fx) * e;
        place(mx, y == null || fy == null ? y : fy + (y - fy) * e, label, mx); if (k < 1) tw = requestAnimationFrame(f); };
      f(t0);
    };
    const place = (x, y, label, hx) => {
      G.cross.setAttribute("x1", x); G.cross.setAttribute("x2", x); G.cross.style.opacity = 1;
      if (G.ms1 && G.ms2) { G.ms1.setAttribute("offset", Math.min(1, (x + 2) / G.W)); G.ms2.setAttribute("offset", Math.min(1, (x + 18) / G.W)); }
      if (G.tsPill && label) {
        G.tsTxt.textContent = label;
        const pw = Math.max(56, label.length * 6.5 + 14), px = Math.max(pw / 2 + 2, Math.min(G.W - pw / 2 - 2, x));
        G.tsRect.setAttribute("x", px - pw / 2); G.tsRect.setAttribute("width", pw); G.tsTxt.setAttribute("x", px);
        G.tsPill.setAttribute("opacity", 1);
      } else if (G.tsPill) G.tsPill.setAttribute("opacity", 0);
      if (y == null) G.hl.style.opacity = 0; else { G.hl.setAttribute("cx", hx); G.hl.setAttribute("cy", y); G.hl.style.opacity = 1; }
    };
    const activate = i => {
      cur = i;
      G.mks.forEach((g, k) => { g.classList.toggle("on", k === i); g.classList.toggle("future", i >= 0 && k > i); });
      if (hooks.move) hooks.move(i < 0 ? -1 : moves[i].i);
    };
    function showPoint(p) { mark(G.X(p.x), G.Y(p.v), p.d); activate(-1); setRO(money(p.v) + (S.unit || ""), p.d, chip(p.l) + " " + esc(p.s)); }
    function showMove(i) { const m = moves[i], p = pts.find(q => q.x === m.x); mark(G.X(m.x), p ? G.Y(p.v) : null, m.when); activate(i);
      setRO(`Move ${m.i + 1}`, esc(m.when), `<span style="color:#0B1220;font-weight:600">${esc(m.text)}</span> · ${esc(m.detail || "")} ${chip(m.label)}`); }
    // n indexes D.moves (the full list); moves before the chart's months only fill the readout
    function showN(n) { const k = moves.findIndex(m => m.i === n); if (k >= 0) return showMove(k); const m = (D.moves || [])[n]; if (!m) return;
      activate(-1); G.cross.style.opacity = 0; G.hl.style.opacity = 0; G.tsPill.setAttribute("opacity", 0); G.ms1.setAttribute("offset", 1); G.ms2.setAttribute("offset", 1); G.mx = null;
      setRO(`Move ${n + 1}`, esc(m.when), `<span style="color:#0B1220;font-weight:600">${esc(m.text)}</span> ${chip(m.label)}`); }
    function pin(n, g) { pinned = n; glide = !!g; showDefault(); glide = false; if (hooks.pin) hooks.pin(); }
    function showDefault() {
      if (pinned != null) return showN(pinned);
      const turnIdx = moves.findIndex(m => m.turn);
      if (turnIdx >= 0) { showMove(turnIdx); return; }
      const p = pts.at(-1); G.cross.style.opacity = 0; G.hl.style.opacity = 0; G.mx = null;
      if (G.ms1 && G.ms2) { G.ms1.setAttribute("offset", 1); G.ms2.setAttribute("offset", 1); }
      if (G.tsPill) G.tsPill.setAttribute("opacity", 0);
      activate(-1);
      setRO(money(p.v) + (S.unit || ""), p.d, chip(p.l) + " " + esc(p.s));
    }
    draw();
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 100); });
    return {showMove: showN, showDefault, moves, pin, cur: () => pinned ?? turnI, N: (D.moves || []).length};
  };

  // the chart could not be drawn: say so and point at the table (it is plain HTML and always there)
  const fail = root => { const pl = root.querySelector(".plot"); if (!pl || root.querySelector(".cfail")) return; pl.hidden = true;
    pl.insertAdjacentHTML("afterend", '<div class="cfail" role="status"><span>The chart didn\'t load. Reload, or read the table.</span><button class="btn btn-s" type="button">Show the table</button></div>');
    root.querySelector(".cfail button").addEventListener("click", () => { const d = root.querySelector(".ctab"); if (d) { d.open = true; d.scrollIntoView({block: "nearest"}); } }); };
  // checkpoint stepper above the moves list: Prev / Next (and ←/→ anywhere in the chart) walk the pinned move 1 → N;
  // Auto-play steps every 1.8s and stops at the last move (left out under reduced motion); any manual input stops it
  const tri = d => `<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
  const stepper = (root, list, api, M, hooks) => {
    list.insertAdjacentHTML("beforebegin", `<div class="mstep" role="group" aria-label="Step through the moves"><button type="button" class="ms-b" data-d="-1" aria-label="Previous move">${tri("M7 1 2 5l5 4z")}Prev</button><span class="ms-t" aria-live="polite"></span><button type="button" class="ms-b" data-d="1" aria-label="Next move">Next${tri("M3 1l5 4-5 4z")}</button>${reduce ? "" : '<button type="button" class="ms-play" aria-pressed="false">Auto-play</button>'}</div>`);
    const ms = list.previousElementSibling, [pv, nx] = ms.querySelectorAll(".ms-b"), tx = ms.querySelector(".ms-t"), pl = ms.querySelector(".ms-play"), N = api.N;
    let auto = 0;
    const sync = () => { const i = api.cur(), t = i < 0 ? `${N} moves · tap Next` : `Move ${i + 1} of ${N} · ${M[i].when.replace(/ /g, " ")}`, f = document.activeElement;
      if (tx.textContent !== t) tx.textContent = t; pv.disabled = i <= 0; nx.disabled = i >= N - 1;
      if (f === nx && nx.disabled && !pv.disabled) pv.focus(); else if (f === pv && pv.disabled && !nx.disabled) nx.focus(); };
    const stop = () => { if (!auto) return; clearInterval(auto); auto = 0; pl.setAttribute("aria-pressed", "false"); pl.textContent = "Auto-play"; };
    const step = d => { const i = Math.max(0, Math.min(N - 1, api.cur() + d)); if (i !== api.cur()) api.pin(i, true); };
    hooks.pin = sync; sync();
    ms.addEventListener("click", e => { const b = e.target.closest(".ms-b"); if (b) { stop(); step(+b.dataset.d); } });
    if (pl) pl.addEventListener("click", () => { if (auto) return stop();
      pl.setAttribute("aria-pressed", "true"); pl.textContent = "Pause"; api.pin(0, true);
      auto = setInterval(() => { step(1); if (api.cur() >= N - 1) stop(); }, 1800); if (N < 2) stop(); });
    root.addEventListener("pointerdown", e => { if (!e.target.closest(".ms-play")) stop(); });
    root.addEventListener("keydown", e => { const d = {ArrowLeft: -1, ArrowRight: 1}[e.key];
      if (!d) { if (!e.target.closest(".ms-play")) stop(); return; }
      if (e.target.closest("input,textarea,select,[role=tablist],[role=slider]")) return;
      e.preventDefault(); stop(); step(d); });
  };
  // auto-mount every chart block on the page
  document.querySelectorAll(".lvchart").forEach(root => { try {
    const D = JSON.parse(root.querySelector(".lvchart-data").textContent);
    const list = root.querySelector(".moves"), band = root.querySelector(".pband");
    const hooks = {move: i => { if (list) list.querySelectorAll("button").forEach((b, k) => { b.classList.toggle("on", k === i); b.classList.toggle("future", i >= 0 && k > i); }); }};
    const api = LVChart(root, D, hooks);
    if (list) { list.addEventListener("pointerover", e => { const b = e.target.closest("button[data-i]"); if (b) api.showMove(+b.dataset.i); });
      list.addEventListener("focusin", e => { const b = e.target.closest("button[data-i]"); if (b) api.showMove(+b.dataset.i); });
      list.addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (b) api.pin(+b.dataset.i, true); });
      list.addEventListener("pointerleave", () => api.showDefault()); }
    if (list && api.N) stepper(root, list, api, D.moves, hooks);
    if (band) band.addEventListener("click", e => { const b = e.target.closest("button[data-ph]"); if (!b) return;
      band.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
      const t = document.getElementById("ph" + b.dataset.ph); if (t && !t.closest("[hidden]")) t.scrollIntoView({behavior: reduce ? "auto" : "smooth", block: "start"}); });
  } catch (e) { fail(root); } });
})();
