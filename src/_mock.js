
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

  // ---------- nav: 80% -> 64% on scroll; links fold into the menu (owner rule) ----------
  const nav = $("#nav"), mb = $("#menubtn");
  const setMenu = o => { nav.classList.toggle("open", o); mb.setAttribute("aria-expanded", o); };
  addEventListener("scroll", () => { nav.classList.toggle("small", scrollY > 8); if (scrollY <= 8 && innerWidth > 1100) setMenu(false); }, {passive: true});
  mb.addEventListener("click", e => { e.stopPropagation(); setMenu(!nav.classList.contains("open")); });
  document.addEventListener("click", e => { if (!e.target.closest("#nav")) setMenu(false); });
  $$("#menuc a").forEach(a => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", e => { if (e.key === "Escape") { setMenu(false); $$(".scell.open").forEach(c => { c.classList.remove("open"); c.setAttribute("aria-expanded", "false"); }); } });

  // ---------- hero chart: data from homepage-prototype.html (P, ALT, EVT); facts in breakdowns/postiz.html ----------
  const P = [[8,700,"c","Superframeworks case study"],[18,6523,"c","Founder, Dev.to"],[19,12648,"c","Founder, Dev.to"],[22,14000,"c","Founder, Dev.to"],
             [26,21000,"x","Superframeworks case study"],[27,80000,"c","Superframeworks case study"],[29,118000,"c","Superframeworks case study"],
             [30,145000,"c","Founder, via Superframeworks"],[32,186713,"c","Founder's Stripe chart"],[34,423707,"v","TrustMRR, read from Stripe"]];
  const ALT = [26.4, 45000, "x", "Founder, Mixergy interview, Mar 11 2026"];
  const EVT = [[0,"Jan 2024","Starts building Postiz","After dropping his first product, Gitroom.","c"],
               [5,"2024","$12K on SEO, little traffic","A brand-new domain, so he cut the channel.","c"],
               [8,"Sep 2024","Open-sources it","Launch weeks on Hacker News, Reddit, Dev.to and Product Hunt.","c"],
               [17,"2025","n8n node, API, affiliates","Builds for the people who automate their posting.","c"],
               [22,"Nov 2025","$14K a month, burned out","Over a year of slow growth after going open source.","c"],
               [25,"Early 2026","Ready for the OpenClaw wave","An MCP server, a command-line tool and an OpenClaw skill.","c"],
               [32,"Sep 2026","Weekly X content system","One idea a week: a video, clips, then a long article.","c"],
               [34,"Nov 16 2026","$423,707 a month","Read from Stripe by TrustMRR.","v"]];
  const TURN = 5, NS = "http://www.w3.org/2000/svg";
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mlabel = m => m >= 34 ? "Nov 16 2026" : MON[Math.floor(m) % 12] + " " + (2024 + Math.floor(m / 12));
  const LB = {v:["v","Verified"], c:["c","Claimed"], x:["x","Sources differ"]};
  const pill = k => `<span class="lb ${LB[k][0]}">${LB[k][1]}</span>`;
  const money = v => "$" + v.toLocaleString("en-US");
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
  const svg = $("#chart"), plot = $("#plot"), tip = $("#tip"), movesEl = $("#moves");
  let G = null;

  movesEl.innerHTML = EVT.map((e, i) => `<li><button type="button" class="mv${i === TURN ? " turn" : ""}" data-i="${i}"><span class="n">${i + 1}</span><span><b>${e[2]}</b><small>${e[3]}</small></span><span class="w">${e[1]}</span></button></li>`).join("");

  function draw() {
    const W = Math.max(260, plot.clientWidth - 12), narrow = W < 520, H = narrow ? 230 : 262;
    const L = 46, R = 14, T = 12, B = 50, TAG = narrow ? 14 : 16;
    const X = m => L + m / 34 * (W - L - R), Y = v => T + (1 - v / 450000) * (H - T - B);
    svg.innerHTML = ""; svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H);
    const defs = el("defs", {}, svg), gr = el("linearGradient", {id: "ga", x1: 0, x2: 0, y1: 0, y2: 1}, defs);
    el("stop", {offset: 0, "stop-color": "#2563EB", "stop-opacity": .14}, gr); el("stop", {offset: 1, "stop-color": "#2563EB", "stop-opacity": 0}, gr);
    [0, 100000, 200000, 300000, 400000].forEach(v => {                     // PB#14: horizontal gridlines only
      el("line", {x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: "#EEF0F3"}, svg);
      el("text", {x: L - 8, y: Y(v) + 4, "text-anchor": "end"}, svg).textContent = v === 0 ? "$0" : "$" + v / 1000 + "k";
    });
    // x labels: keep a 10-month gap before the end label so "Nov 2026" never collides
    const xt = narrow ? [0, 12, 24, 34] : [0, 6, 12, 18, 24, 34];
    xt.forEach((m, i) => el("text", {x: X(m), y: H - 6, "text-anchor": i === 0 ? "start" : i === xt.length - 1 ? "end" : "middle"}, svg).textContent = m === 34 ? "Nov 2026" : mlabel(m));
    if (!narrow) { const t = el("text", {x: X(0) + 2, y: Y(0) - 8, fill: "#9CA3AF"}, svg); t.textContent = "No public revenue numbers before Sep 2024"; }
    el("line", {x1: X(0), x2: X(8), y1: Y(0), y2: Y(0), stroke: "#CBD5E1", "stroke-dasharray": "2 3"}, svg);
    const pts = P.map(p => [X(p[0]), Y(p[1])]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    el("path", {d: `${line} L${pts.at(-1)[0]} ${Y(0)} L${pts[0][0]} ${Y(0)} Z`, fill: "url(#ga)"}, svg);
    el("path", {d: line, fill: "none", stroke: "#2563EB", "stroke-width": 2, "stroke-linejoin": "round"}, svg);
    const vline = el("line", {y1: T, y2: H - B, stroke: "#9CA3AF", "stroke-dasharray": "3 3", opacity: 0}, svg);
    P.forEach((p, i) => {
      if (p[2] === "v") el("circle", {cx: pts[i][0], cy: pts[i][1], r: 4.5, fill: "#10B981", stroke: "#fff", "stroke-width": 2}, svg);
      else el("circle", {cx: pts[i][0], cy: pts[i][1], r: 3, fill: "#fff", stroke: p[2] === "x" ? "#E5533D" : "#2563EB", "stroke-width": 1.5}, svg);
    });
    const ax = X(ALT[0]), ay = Y(ALT[1]);
    el("rect", {x: ax - 3.5, y: ay - 3.5, width: 7, height: 7, fill: "#E5533D", transform: `rotate(45 ${ax} ${ay})`}, svg);
    const hl = el("circle", {r: 5.5, fill: "none", stroke: "#0B1220", "stroke-width": 1.5, opacity: 0}, svg);
    const tags = EVT.map((e, i) => {               // decorative mirror of the list (the list is the accessible control)
      const g = el("g", {class: "tag" + (i === TURN ? " turn" : ""), "aria-hidden": "true"}, svg);
      const cx = Math.min(Math.max(X(e[0]), L + TAG / 2), W - R - TAG / 2) + (i === 6 ? -3 : i === 7 ? 3 : 0);
      el("rect", {x: cx - TAG / 2, y: H - B + 8, width: TAG, height: TAG, rx: 4}, g);
      el("text", {x: cx, y: H - B + 8 + TAG / 2 + 3.5, "text-anchor": "middle"}, g).textContent = i + 1;
      g.addEventListener("pointerenter", () => showEvent(i)); g.addEventListener("pointerleave", showDefault);
      return g;
    });
    const hit = el("rect", {x: L, y: T, width: W - L - R, height: H - B - T, fill: "transparent"}, svg);
    G = {X, Y, W, H, B, vline, hl, tags};
    hit.addEventListener("pointermove", ev => {
      const r = svg.getBoundingClientRect(), mx = (ev.clientX - r.left) * W / r.width;
      let best = null, bd = 1e9;
      [...P, ALT].forEach(p => { const d = Math.abs(X(p[0]) - mx); if (d < bd) { bd = d; best = p; } });
      showPoint(best);
    });
    hit.addEventListener("pointerleave", showDefault);
    showDefault();
  }
  function place(px, py, html) {
    tip.innerHTML = html;
    const ox = 6 + px * ((plot.clientWidth - 12) / G.W), oy = 6 + py, w = tip.offsetWidth, h = tip.offsetHeight;
    let left = ox + 14; if (left + w > plot.clientWidth - 4) left = ox - w - 14;
    tip.style.left = Math.max(4, left) + "px"; tip.style.top = Math.min(Math.max(4, oy - h / 2), plot.clientHeight - h - 4) + "px";
  }
  function mark(x, y) { G.vline.setAttribute("x1", x); G.vline.setAttribute("x2", x); G.vline.setAttribute("opacity", 1);
    if (y == null) G.hl.setAttribute("opacity", 0); else { G.hl.setAttribute("cx", x); G.hl.setAttribute("cy", y); G.hl.setAttribute("opacity", 1); } }
  function setActive(i) { G.tags.forEach((g, k) => g.classList.toggle("on", k === i)); movesEl.querySelectorAll(".mv").forEach((b, k) => b.classList.toggle("on", k === i)); }
  function showPoint(p) {
    const x = G.X(p[0]), y = G.Y(p[1]); mark(x, y); setActive(-1);
    place(x, y, `<div class="d">${p === ALT ? "Mar 2026, second source" : mlabel(p[0])}</div><div class="tv">${money(p[1])}<span class="d" style="font:500 12px var(--fd)"> /mo</span></div><div class="s">${pill(p[2])}<span>${p[3]}</span></div>`);
  }
  function showEvent(i) {
    const e = EVT[i], x = G.X(e[0]), p = P.find(q => q[0] === e[0]);
    mark(x, p ? G.Y(p[1]) : null); setActive(i);
    place(x, p ? G.Y(p[1]) : (G.H - G.B) * .55, `<div class="d">Move ${i + 1} · ${e[1]}</div><div class="tt">${e[2]}</div><div>${e[3]}</div><div class="s">${pill(e[4])}</div>`);
  }
  function showDefault() { showPoint(P[P.length - 1]); }   // B: tooltip pinned on the latest verified point
  movesEl.addEventListener("pointerover", ev => { const b = ev.target.closest(".mv"); if (b) showEvent(+b.dataset.i); });
  movesEl.addEventListener("pointerleave", showDefault);
  movesEl.addEventListener("click", ev => { const b = ev.target.closest(".mv"); if (b) showEvent(+b.dataset.i); });
  movesEl.addEventListener("focusin", ev => { const b = ev.target.closest(".mv"); if (b) showEvent(+b.dataset.i); });
  draw();
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 80); });

  // ---------- sources popovers: hover on desktop, tap to toggle ----------
  $$(".scell").forEach(c => c.addEventListener("click", e => { e.stopPropagation(); const o = !c.classList.contains("open");
    $$(".scell").forEach(x => { x.classList.remove("open"); x.setAttribute("aria-expanded", "false"); }); c.classList.toggle("open", o); c.setAttribute("aria-expanded", o); }));
  document.addEventListener("click", () => $$(".scell.open").forEach(x => { x.classList.remove("open"); x.setAttribute("aria-expanded", "false"); }));

  // ---------- small interactions ----------
  $$(".chip").forEach(c => c.addEventListener("click", () => $$(".chip").forEach(x => x.setAttribute("aria-pressed", x === c))));
  $$(".part").forEach(c => c.addEventListener("click", () => $$(".part").forEach(x => x.setAttribute("aria-selected", x === c))));
  const cks = $$(".ck"), prog = $("#prog");
  cks.forEach(c => c.addEventListener("click", () => { c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") !== "true");
    prog.textContent = cks.filter(x => x.getAttribute("aria-pressed") === "true").length + " of " + cks.length + " ticked"; }));
  $$("[data-b]").forEach(b => b.addEventListener("click", () => {
    $$("[data-b]").forEach(x => x.setAttribute("aria-pressed", x === b));
    const y = b.dataset.b === "y";
    $("#fullpr").innerHTML = (y ? "$4" : "$5") + "<small>/month</small>";
    $("#fullsub").textContent = y ? "$48 billed once a year. Cancel anytime." : "Billed monthly. Cancel anytime."; }));
  $(".tr.has-read").addEventListener("click", e => { if (!e.target.closest("a")) location.hash = "#lib"; });

  // ---------- quiz (C), paths from homepage-prototype.html ----------
  const PATHS = {
    "Nothing, just my time": [["Postiz", "Give a free version away and post every update."], ["Stencil AI", "No audience needed. Start with one real problem."], ["Gojiberry", "Ask for payment early. A waitlist isn't revenue."]],
    "Under $100": [["Stencil AI", "Start with a problem someone close to you has."], ["Postiz", "Post where your users already are, every time you ship."], ["Windmill Growth", "Offer a service you can do now, like running a local shop's Instagram."]],
    "A few hundred dollars": [["Windmill Growth", "Started with $250, he says. A service earns before an app would."], ["Postiz", "Spent about $12,000 on SEO for a new site and got little traffic. Skip it."], ["DM Champ", "A cheap AppSumo deal brought testers, not buyers. Price for real buyers."]]
  };
  const ARW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const showPath = a => { $("#pathfor").textContent = a;
    $("#pathlist").innerHTML = PATHS[a].map((p, i) => `<li><a href="#lib"><span class="pn2">${i + 1}</span><span><b>${p[0]}</b><small>${p[1]}</small></span>${ARW}</a></li>`).join(""); };
  $$("#opts .opt").forEach(o => o.addEventListener("click", () => { $$("#opts .opt").forEach(x => x.setAttribute("aria-pressed", x === o)); showPath(o.textContent.trim()); }));
  showPath("Under $100");

  // ---------- magnetic buttons (C): within 12px the button eases toward the pointer, max 8px, no overshoot ----------
  if (!reduce) {
    const REACH = 12, PULL = .28, MAX = 8, IN = .16, OUT = .1, st = new Map(); let mx = -999, my = -999, running = false;
    const frame = () => { let moving = false;
      $$(".btn").forEach(b => { let q = st.get(b); if (!q) { q = {x: 0, y: 0}; st.set(b, q); } const r = b.getBoundingClientRect(); if (!r.width) return;
        const l = r.left - q.x, t = r.top - q.y, cx = l + r.width / 2, cy = t + r.height / 2;
        const near = Math.hypot(Math.max(l - mx, 0, mx - (l + r.width)), Math.max(t - my, 0, my - (t + r.height))) <= REACH;
        const tx = near ? Math.max(-MAX, Math.min(MAX, (mx - cx) * PULL)) : 0, ty = near ? Math.max(-MAX, Math.min(MAX, (my - cy) * PULL)) : 0, f = near ? IN : OUT;
        q.x += (tx - q.x) * f; q.y += (ty - q.y) * f;
        if (Math.abs(tx - q.x) < .05 && Math.abs(ty - q.y) < .05) { q.x = tx; q.y = ty; } else moving = true;
        b.style.setProperty("--px", q.x.toFixed(2) + "px"); b.style.setProperty("--py", q.y.toFixed(2) + "px"); });
      running = moving; if (moving) requestAnimationFrame(frame); };
    const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
    addEventListener("pointermove", e => { if (e.pointerType !== "mouse") return; mx = e.clientX; my = e.clientY; kick(); }, {passive: true});
    document.documentElement.addEventListener("pointerleave", () => { mx = my = -999; kick(); });
  }

  // ---------- Studio cursor: dot on the pointer, ring follows (lerp .2); "Read" bubble on rows/posts; dims on dark; mouse only ----------
  if (!reduce) {
    const LABELS = [[".tr.has-read, .post, .feat", "Read"]];
    const labelFor = t => { for (const [sel, l] of LABELS) if (t.closest(sel)) return l; return ""; };
    const dot = document.createElement("div"), ring = document.createElement("div"), lab = document.createElement("b");
    dot.className = "cur"; ring.className = "cur-ring"; ring.append(lab); document.body.append(dot, ring);
    const H = document.documentElement, lerp = (a, b, t) => a + (b - a) * t;
    let mx = -100, my = -100, rx = -100, ry = -100, run = false;
    const loop = () => { rx = lerp(rx, mx, .2); ry = lerp(ry, my, .2);
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`; ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      run = Math.abs(rx - mx) > .1 || Math.abs(ry - my) > .1; if (run) requestAnimationFrame(loop); };
    const go = () => { if (!run) { run = true; requestAnimationFrame(loop); } };
    const off = () => H.classList.remove("cur-on", "cur-show", "cur-lbl", "cur-text", "cur-dark");
    addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") { off(); return; }
      if (!H.classList.contains("cur-on")) { rx = mx = e.clientX; ry = my = e.clientY; }
      mx = e.clientX; my = e.clientY; H.classList.add("cur-on", "cur-show"); go();
      const t = e.target, txt = t.closest("input"), l = txt ? "" : labelFor(t),
            hov = !txt && !l && t.closest("a, button, summary, [role=button], [role=tab]");
      H.classList.toggle("cur-text", !!txt); H.classList.toggle("cur-lbl", !!l); H.classList.toggle("cur-dark", !!t.closest(".dk, footer"));
      ring.classList.toggle("lbl", !!l); ring.classList.toggle("hov", !!hov); if (l) lab.textContent = l;
    }, {passive: true});
    addEventListener("pointerdown", e => { if (e.pointerType === "mouse") ring.classList.add("down"); }, {passive: true});
    addEventListener("pointerup", () => ring.classList.remove("down"), {passive: true});
    H.addEventListener("pointerleave", () => H.classList.remove("cur-show"));
  }
})();
