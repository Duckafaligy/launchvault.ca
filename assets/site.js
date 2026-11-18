/* LaunchVault site: nav, reveal + count-up, chart, source cards, tabs + filters, accordion, quiz, pricing, magnetic buttons, Studio cursor.
   Postiz numbers: TrustMRR (Stripe) read Nov 17 2026; earlier points are Claimed (breakdowns/postiz). Components: see COMPONENTS.md. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
                  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const H = document.documentElement;
  const IO = "IntersectionObserver" in window;

  // ---------- nav: 80% -> 64% on scroll; links fold into the menu ----------
  const nav = $("#nav"), mb = $("#menubtn");
  if (nav && mb) {
    const setMenu = o => { nav.classList.toggle("open", o); mb.setAttribute("aria-expanded", o); };
    const onScroll = () => { nav.classList.toggle("small", scrollY > 8); if (scrollY <= 8 && innerWidth > 1100) setMenu(false); };
    addEventListener("scroll", onScroll, {passive: true}); onScroll();
    mb.addEventListener("click", e => { e.stopPropagation(); setMenu(!nav.classList.contains("open")); if (nav.classList.contains("open")) { const f = $("#menuc a"); if (f) f.focus(); } });
    document.addEventListener("click", e => { if (!e.target.closest("#nav")) setMenu(false); });
    $$("#menuc a").forEach(a => a.addEventListener("click", () => setMenu(false)));
    nav.addEventListener("keydown", e => {
      if (!nav.classList.contains("open") || e.key !== "Tab") return;
      const f = [mb, ...$$("#menuc a")].filter(x => x.getClientRects().length), i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    addEventListener("keydown", e => { if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); mb.focus(); } });
  }

  // ---------- homepage scroll-spy: the nav tab for the section you're reading is highlighted ----------
  if (IO && location.pathname === "/" && nav) {
    const links = $$('#nav a[href^="/#"]'), map = {stories: "stories", "moves-sec": "stories", inside: "stories", sources: "sources", sourced: "sources", check: "sources", pricing: "pricing", faq: "faq"};
    const vis = new Map();
    const paint = () => { let best = null, bh = 0; vis.forEach((h, id) => { if (h > bh) { bh = h; best = id; } });
      const key = best && map[best]; links.forEach(a => { if (key && a.getAttribute("href") === "/#" + key) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); }); };
    const sio = new IntersectionObserver(es => { es.forEach(e => vis.set(e.target.id, e.isIntersecting ? e.intersectionRect.height : 0)); paint(); }, {threshold: [0, .1, .25, .5, .75, 1], rootMargin: "-80px 0px -35% 0px"});
    Object.keys(map).forEach(id => { const el = document.getElementById(id); if (el) sio.observe(el); });
  }

  // ---------- preview forms: nothing is sent; say so plainly ----------
  $$("form.pv").forEach(f => f.addEventListener("submit", e => {
    e.preventDefault();
    let m = f.nextElementSibling; if (!m || !m.classList.contains("fmsg")) { m = document.createElement("p"); m.className = "fmsg"; m.setAttribute("role", "status"); f.after(m); }
    m.textContent = "Sign-ups open soon. This is a preview."; m.classList.add("on");
  }));
  // ?plan=pro|builder|full on /signup/ shows the plan note; .pname (if present) gets the plan's name
  const plan = new URLSearchParams(location.search).get("plan"), pn = $("#plannote");
  if (pn && plan && /^(pro|builder|full)$/.test(plan)) { pn.hidden = false; const nm = pn.querySelector(".pname"); if (nm) nm.textContent = plan === "builder" ? "Builder" : "Pro"; }
  $$("a.parentmail").forEach(a => { const url = location.origin + "/#pricing";
    a.href = "mailto:?subject=" + encodeURIComponent("LaunchVault") + "&body=" + encodeURIComponent("Can you look at this? Pro is $5 a month (or $4 a month billed yearly), cancel anytime, and payments go through Stripe: " + url); });

  // ---------- scroll reveal: rise + fade, staggered within each batch ----------
  if (IO && !reduce) {
    const targets = new Set();
    const add = el => { if (!el || el.hasAttribute("data-noreveal") || el.matches("script, style")) return;
      if (getComputedStyle(el).display === "contents") { [...el.children].forEach(add); return; }
      if (el.hasAttribute("data-stagger")) { [...el.children].forEach(c => { if (!c.hasAttribute("data-noreveal")) targets.add(c); }); return; }
      targets.add(el); };
    $$("main section .wrap > *").forEach(add);
    $$("main [data-stagger]").forEach(g => [...g.children].forEach(c => targets.add(c)));
    $$("main [data-reveal]").forEach(el => targets.add(el));
    H.classList.add("rv-on");
    const io = new IntersectionObserver(es => {
      es.filter(e => e.isIntersecting).map(e => e.target)
        .sort((a, b) => a.compareDocumentPosition(b) & 4 ? -1 : 1)
        .forEach((el, i) => { el.style.setProperty("--rd", Math.min(i * 70, 420) + "ms"); el.classList.add("in"); io.unobserve(el);
          setTimeout(() => el.style.removeProperty("--rd"), 1400); });
    }, {rootMargin: "0px 0px -6% 0px"});
    targets.forEach(el => { el.classList.add("rv"); io.observe(el); });
  }

  // ---------- count-up: 0 -> the number already in the text, on first view ----------
  const countUp = el => {
    const txt = el.textContent, m = txt.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s);
    if (!m || el.children.length) return;
    const [, pre, num, post] = m, dec = (num.split(".")[1] || "").length, val = parseFloat(num.replace(/,/g, "")), comma = num.includes(",");
    const fmt = v => pre + (comma ? v.toLocaleString("en-US", {minimumFractionDigits: dec, maximumFractionDigits: dec}) : v.toFixed(dec)) + post;
    const t0 = performance.now(), D = 1300;
    const step = t => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k < 1 ? fmt(val * e) : txt; if (k < 1) requestAnimationFrame(step); };
    el.textContent = fmt(0); requestAnimationFrame(step);
  };
  if (IO && !reduce) {
    const cio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { cio.unobserve(e.target); countUp(e.target); } }), {threshold: .5});
    $$("[data-count], .kpi .kv").forEach(el => cio.observe(el));
    const bars = $("#bars"); if (bars) { const bio = new IntersectionObserver(es => { if (es[0].isIntersecting) { bars.classList.add("in"); bio.disconnect(); } }, {threshold: .35}); bio.observe(bars); }
  } else { const bars = $("#bars"); if (bars) bars.classList.add("in"); }

  // ---------- segmented controls + filters: a sliding indicator under the selected button ----------
  const segs = $$(".seg, .filters");
  const placeInd = g => { const ind = g.querySelector(":scope > .ind"), on = g.querySelector(':scope > [aria-pressed="true"], :scope > [aria-selected="true"]');
    if (!ind) return; if (!on || !on.offsetWidth) { ind.style.width = "0"; return; }
    ind.style.width = on.offsetWidth + "px"; ind.style.transform = `translateX(${on.offsetLeft}px)`; };
  segs.forEach(g => { const ind = document.createElement("i"); ind.className = "ind"; ind.setAttribute("aria-hidden", "true"); g.prepend(ind); g.classList.add("has-ind");
    if (reduce) ind.style.transition = "none"; else { ind.style.transition = "none"; requestAnimationFrame(() => requestAnimationFrame(() => ind.style.transition = "")); }
    placeInd(g); new MutationObserver(() => placeInd(g)).observe(g, {attributes: true, subtree: true, attributeFilter: ["aria-pressed", "aria-selected"]}); });
  let rsz; addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => segs.forEach(placeInd), 60); });
  if (document.fonts) document.fonts.ready.then(() => segs.forEach(placeInd));

  // ---------- story filters: the container right after .filters; ?f=saas preselects where data-url="1" ----------
  $$(".filters").forEach(g => {
    const chips = $$(".chip", g), box = g.nextElementSibling; if (!box) return;
    const items = $$("[data-cat]", box), empty = box.querySelector(".empty");
    const apply = c => { chips.forEach(x => x.setAttribute("aria-pressed", x === c)); const f = c.dataset.f || "all"; let n = 0;
      items.forEach(r => { const on = f === "all" || r.dataset.cat.split(" ").includes(f); r.hidden = !on; if (on) { n++; if (!reduce && r.animate) r.animate([{opacity: 0, transform: "translateY(8px)"}, {opacity: 1, transform: "none"}], {duration: 380, easing: "cubic-bezier(.16,1,.3,1)", delay: n * 40, fill: "backwards"}); } });
      if (empty) empty.classList.toggle("on", n === 0);
      c.scrollIntoView && g.scrollWidth > g.clientWidth && g.scrollTo({left: c.offsetLeft - 16, behavior: reduce ? "auto" : "smooth"}); };
    chips.forEach(c => c.addEventListener("click", () => apply(c)));
    const q = new URLSearchParams(location.search).get("f"), pre = q && chips.find(c => c.dataset.f === q);
    if (pre && g.dataset.url === "1") apply(pre);
  });

  // ---------- tabs: [data-tabs] buttons with aria-controls switch their panels ----------
  $$("[data-tabs]:not(.parts)").forEach(g => { // .parts (homepage #inside) is driven by home.js
    const tabs = $$('[role="tab"]', g);
    const select = (t, focus) => { tabs.forEach(x => { const on = x === t; x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1;
        const p = document.getElementById(x.getAttribute("aria-controls")); if (p) p.hidden = !on; });
      if (focus) t.focus(); const nm = $("#cropname"); if (nm && g.classList.contains("parts")) nm.textContent = t.querySelector("b").textContent; };
    tabs.forEach((t, i) => { t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", e => { const d = {ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1}[e.key]; if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); } }); });
    const cur = tabs.find(t => t.getAttribute("aria-selected") === "true") || tabs[0]; if (cur) select(cur);
  });

  // ---------- Postiz chart (hero window + breakdown page) ----------
  const svg = $("#chart");
  let redraw = null, chartAPI = null;
  if (svg) {
    const P = [[8,700,"c","Superframeworks case study"],[18,6523,"c","Founder, Dev.to"],[19,12648,"c","Founder, Dev.to"],[22,14000,"c","Founder, Dev.to"],
               [26,21000,"x","Superframeworks case study"],[27,80000,"c","Superframeworks case study"],[29,118000,"c","Superframeworks case study"],
               [30,145000,"c","Founder, via Superframeworks"],[32,186713,"c","Founder's Stripe chart"],[34,430896,"v","TrustMRR, read from Stripe"]];
    const ALT = [26.4, 45000, "x", "Founder, Mixergy interview, Mar 11 2026"];
    const EVT = [[0,"Jan 2024","Starts building Postiz","After dropping his first product, Gitroom.","c"],
                 [5,"2024","$12K on SEO, little traffic","A brand-new domain, so he cut the channel.","c"],
                 [8,"Sep 2024","Open-sources it","Launch weeks on Hacker News, Reddit, Dev.to and Product Hunt.","c"],
                 [17,"2025","n8n node, API, affiliates","Builds for the people who automate their posting.","c"],
                 [22,"Nov 2025","$14K a month, burned out","Over a year of slow growth after going open source.","c"],
                 [25,"Early 2026","Ready for the OpenClaw wave","An MCP server, a command-line tool and an OpenClaw skill.","c"],
                 [32,"Sep 2026","Weekly X content system","One idea a week: a video, clips, then a long article.","c"],
                 [34,"Nov 17 2026","$430,896 a month","Read from Stripe by TrustMRR.","v"]];
    const TURN = 5, NS = "http://www.w3.org/2000/svg";
    const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const mlabel = m => m >= 34 ? "Nov 17 2026" : MON[Math.floor(m) % 12] + " " + (2024 + Math.floor(m / 12));
    const LB = {v:["v","Verified"], c:["c","Claimed"], x:["x","Sources differ"]};
    const pill = k => `<span class="lb ${LB[k][0]}">${LB[k][1]}</span>`;
    const money = v => "$" + v.toLocaleString("en-US");
    const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
    const plot = $("#plot"), tip = $("#tip"), movesEl = $("#moves"), size = plot.dataset.size, inHero = !!plot.closest(".win");
    let G = null, M0 = 0, animate = !reduce && IO, pinned = null;
    movesEl.innerHTML = EVT.map((e, i) => `<li><button type="button" class="mv${i === TURN ? " turn" : ""}" data-i="${i}"><span class="n">${i + 1}</span><span><b>${e[2]}</b><small>${e[3]}</small></span><span class="w">${e[1]}</span></button></li>`).join("");
    function draw() {
      const W = Math.max(260, plot.clientWidth - 12), narrow = W < 520, H = narrow ? 230 : size === "big" ? 320 : inHero ? 218 : 262;
      const L = 46, R = 14, T = 12, B = 50, TAG = narrow ? 14 : 16, span = 34 - M0;
      const X = m => L + Math.max(0, m - M0) / span * (W - L - R), Y = v => T + (1 - v / 450000) * (H - T - B);
      svg.innerHTML = ""; svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H);
      const defs = el("defs", {}, svg), gr = el("linearGradient", {id: "ga", x1: 0, x2: 0, y1: 0, y2: 1}, defs);
      el("stop", {offset: 0, "stop-color": "#2563EB", "stop-opacity": .14}, gr); el("stop", {offset: 1, "stop-color": "#2563EB", "stop-opacity": 0}, gr);
      [0, 100000, 200000, 300000, 400000].forEach(v => {
        el("line", {x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: "#EEF0F3"}, svg);
        el("text", {x: L - 8, y: Y(v) + 4, "text-anchor": "end"}, svg).textContent = v === 0 ? "$0" : "$" + v / 1000 + "k";
      });
      const xt = M0 ? [22, 26, 30, 34] : narrow ? [0, 12, 24, 34] : [0, 6, 12, 18, 24, 34];
      xt.forEach((m, i) => el("text", {x: X(m), y: H - 6, "text-anchor": i === 0 ? "start" : i === xt.length - 1 ? "end" : "middle"}, svg).textContent = m === 34 ? "Nov 2026" : mlabel(m));
      if (!narrow && !M0) { const t = el("text", {x: X(0) + 2, y: Y(0) - 8, fill: "#9CA3AF"}, svg); t.textContent = "No public revenue numbers before Sep 2024"; }
      if (!M0) el("line", {x1: X(0), x2: X(8), y1: Y(0), y2: Y(0), stroke: "#CBD5E1", "stroke-dasharray": "2 3"}, svg);
      const PV = P.filter(p => p[0] >= M0), pts = PV.map(p => [X(p[0]), Y(p[1])]);
      const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      el("path", {class: "area", d: `${line} L${pts.at(-1)[0]} ${Y(0)} L${pts[0][0]} ${Y(0)} Z`, fill: "url(#ga)"}, svg);
      el("path", {class: "line", d: line, fill: "none", stroke: "#2563EB", "stroke-width": 2, "stroke-linejoin": "round", pathLength: 1}, svg);
      const vline = el("line", {y1: T, y2: H - B, stroke: "#9CA3AF", "stroke-dasharray": "3 3", opacity: 0}, svg);
      PV.forEach((p, i) => {
        if (p[2] === "v") el("circle", {cx: pts[i][0], cy: pts[i][1], r: 4.5, fill: "#10B981", stroke: "#fff", "stroke-width": 2}, svg);
        else el("circle", {cx: pts[i][0], cy: pts[i][1], r: 3, fill: "#fff", stroke: p[2] === "x" ? "#E5533D" : "#2563EB", "stroke-width": 1.5}, svg);
      });
      const ax = X(ALT[0]), ay = Y(ALT[1]);
      el("rect", {class: "dmd", x: ax - 3.5, y: ay - 3.5, width: 7, height: 7, fill: "#E5533D", transform: `rotate(45 ${ax} ${ay})`}, svg);
      const hl = el("circle", {r: 5.5, fill: "none", stroke: "#0B1220", "stroke-width": 1.5, opacity: 0}, svg);
      const tags = EVT.map((e, i) => {           // decorative mirror of the list (the list is the accessible control)
        const g = el("g", {class: "tag" + (i === TURN ? " turn" : ""), "aria-hidden": "true"}, svg);
        if (e[0] < M0) { g.setAttribute("display", "none"); return g; }
        const cx = Math.min(Math.max(X(e[0]), L + TAG / 2), W - R - TAG / 2) + (i === 6 ? -3 : i === 7 ? 3 : 0);
        el("rect", {x: cx - TAG / 2, y: H - B + 8, width: TAG, height: TAG, rx: 4}, g);
        el("text", {x: cx, y: H - B + 8 + TAG / 2 + 3.5, "text-anchor": "middle"}, g).textContent = i + 1;
        g.addEventListener("pointerenter", () => showEvent(i)); g.addEventListener("pointerleave", showDefault); g.addEventListener("click", () => pin(i));
        return g;
      });
      const hit = el("rect", {x: L, y: T, width: W - L - R, height: H - B - T, fill: "transparent"}, svg);
      G = {X, Y, W, H, B, vline, hl, tags};
      hit.addEventListener("pointermove", ev => {
        const r = svg.getBoundingClientRect(), mx = (ev.clientX - r.left) * W / r.width;
        let best = null, bd = 1e9;
        [...PV, ALT].forEach(p => { const d = Math.abs(X(p[0]) - mx); if (d < bd) { bd = d; best = p; } });
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
      const e = EVT[i], x = G.X(e[0]), p = P.find(q => q[0] === e[0] && q[0] >= M0);
      mark(x, p ? G.Y(p[1]) : null); setActive(i);
      place(x, p ? G.Y(p[1]) : (G.H - G.B) * .55, `<div class="d">Move ${i + 1} · ${e[1]}</div><div class="tt">${e[2]}</div><div>${e[3]}</div><div class="s">${pill(e[4])}</div>`);
    }
    function showDefault() { if (pinned != null) showEvent(pinned); else showPoint(P[P.length - 1]); }
    // a clicked move stays highlighted, and the list scrolls to it (inside its own panel, never the page)
    function pin(i) { pinned = pinned === i ? null : i; showDefault();
      const b = movesEl.querySelectorAll(".mv")[i];
      if (pinned != null && b && movesEl.scrollHeight > movesEl.clientHeight + 2) movesEl.scrollTo({top: Math.max(0, b.parentElement.offsetTop - 8), behavior: reduce ? "auto" : "smooth"}); }
    movesEl.addEventListener("pointerover", ev => { const b = ev.target.closest(".mv"); if (b) showEvent(+b.dataset.i); });
    movesEl.addEventListener("pointerleave", showDefault);
    movesEl.addEventListener("click", ev => { const b = ev.target.closest(".mv"); if (b) pin(+b.dataset.i); });
    movesEl.addEventListener("focusin", ev => { const b = ev.target.closest(".mv"); if (b) showEvent(+b.dataset.i); });
    const play = () => { if (!animate) return; plot.classList.remove("drawing"); void plot.offsetWidth; plot.classList.add("drawing"); };
    redraw = draw;
    draw();
    // the line draws itself in the first time the chart is on screen
    if (animate) { plot.classList.add("drawing"); plot.style.visibility = "hidden";
      const pio = new IntersectionObserver(es => { if (es[0].isIntersecting) { pio.disconnect(); plot.style.visibility = ""; play(); } }, {threshold: .3}); pio.observe(plot); }
    // range tabs in the hero window
    $$("[data-range]").forEach(b => b.addEventListener("click", () => {
      $$("[data-range]").forEach(x => x.setAttribute("aria-selected", x === b)); const m = b.dataset.range === "12" ? 22 : 0; if (m === M0) return; M0 = m; pinned = null; draw(); play(); }));
    // used by the hero's ghost cursors, so they drive the chart through the same functions as a real pointer
    chartAPI = {
      point: k => { const p = P[k]; if (!G || p[0] < M0) return null; const r = svg.getBoundingClientRect(); return [r.left + G.X(p[0]) * r.width / G.W, r.top + G.Y(p[1]) * r.height / G.H]; },
      show: k => showPoint(P[k]), reset: () => { pinned = null; movesEl.scrollTo({top: 0}); showDefault(); },
      tag: i => G && G.tags[i], pinned: () => pinned, range: () => M0, count: P.length };
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { fitHero(); }, 80); });
  }

  // ---------- hero: scale the product window so the whole thing fits the first screen on desktop ----------
  function fitHero() {
    const wf = $("#winfit"), w = $("#win");
    if (!wf || !w) { if (redraw) redraw(); return; }
    w.style.transform = ""; w.style.width = ""; wf.style.height = ""; w.style.removeProperty("--s");
    if (redraw) redraw();
    if (innerWidth <= 1100 || !canHover) return;   // touch tablets scroll naturally and keep 44px targets
    let top = 0; for (let n = wf; n; n = n.offsetParent) top += n.offsetTop;   // layout position, ignores the load-in transform
    const avail = innerHeight - top - 14;
    let nat = w.offsetHeight; if (nat <= avail) return;
    let s = Math.max(.6, avail / nat);
    w.style.width = (wf.clientWidth / s) + "px"; if (redraw) redraw();
    nat = w.offsetHeight; s = Math.max(.6, Math.min(1, avail / nat));
    w.style.width = (wf.clientWidth / s) + "px"; if (redraw) redraw();
    w.style.setProperty("--s", s); w.style.transform = `scale(${s})`; wf.style.height = (w.offsetHeight * s) + "px";
  }
  fitHero();
  if (document.fonts) document.fonts.ready.then(fitHero);
  if (!svg) { let rt2; addEventListener("resize", () => { clearTimeout(rt2); rt2 = setTimeout(fitHero, 80); }); }

  // ---------- hero dashboard: every control does something real ----------
  const win = $("#win");
  let dash = null;
  if (win) {
    const post = win.querySelector('.view[data-view="postiz"]'), views = $$(".view.vx", win), sis = $$(".side .si", win);
    const drawer = $("#sdrawer"), srcbtn = $("#srcbtn"), search = $("#wsearch"), url = $("#wurl");
    const SOON = { dm: ["D", "DM Champ", "AI tool", "$75,746", "/mo", "Nov 16 2026"], stencil: ["S", "Stencil AI", "Mobile app", "$483,794", " all-time", "Nov 16 2026"],
                   windmill: ["W", "Windmill Growth", "Agency", "$118,347", "/mo", "Nov 16 2026"], goji: ["G", "Gojiberry", "AI tool", "$424,368", "/mo", "Aug 14 2026"] };
    const URLS = { postiz: "/breakdowns/postiz", home: "/home", breakdowns: "/breakdowns", checklists: "/checklists", sources: "/sources" };
    let view = "postiz", co = null;
    const setDrawer = (open, byUser) => {
      if (!drawer) return; drawer.classList.toggle("open", open); drawer.setAttribute("aria-hidden", !open); drawer.inert = !open;
      if (srcbtn) srcbtn.setAttribute("aria-expanded", open);
      if (byUser) (open ? drawer.querySelector(".sd-x") : srcbtn).focus({preventScroll: true});
    };
    const show = (v, c) => {
      view = v; co = v === "soon" ? c : null;
      post.classList.toggle("under", v !== "postiz");
      views.forEach(x => { x.hidden = x.dataset.view !== v; });
      sis.forEach(s => { const on = s.dataset.go === v && (v !== "soon" || s.dataset.co === c); s.classList.toggle("on", on); if (on) s.setAttribute("aria-current", "page"); else s.removeAttribute("aria-current"); });
      if (v === "soon" && SOON[c]) { const d = SOON[c];
        $("#sotile").textContent = d[0]; $("#soname").textContent = d[1]; $("#socat").textContent = d[2] + " · breakdown coming soon"; $("#sonum").textContent = d[3]; $("#sounit").textContent = d[4]; $("#sodt").textContent = d[5]; }
      if (url) url.textContent = v === "soon" ? "/breakdowns/" + c : URLS[v] || "/";
      setDrawer(false);
      if (v === "postiz" && redraw) redraw();
    };
    win.addEventListener("click", e => {
      const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); show(g.dataset.go, g.dataset.co); return; }
      const k = e.target.closest(".kpi"); if (k) { k.setAttribute("aria-pressed", k.getAttribute("aria-pressed") !== "true"); return; }
      if (e.target.closest("#srcbtn")) { setDrawer(!drawer.classList.contains("open"), e.isTrusted); return; }
      if (e.target.closest(".sd-x")) setDrawer(false, e.isTrusted);
    });
    win.addEventListener("keydown", e => { if (e.key === "Escape" && drawer && drawer.classList.contains("open")) { e.stopPropagation(); setDrawer(false, true); } });
    // search filters the sidebar; Ctrl/Cmd K focuses it while the pointer is over the window
    const filter = () => { const q = search.value.trim().toLowerCase(); let n = 0;
      sis.forEach(s => { const on = !q || s.textContent.toLowerCase().includes(q); s.hidden = !on; if (on) n++; });
      $$(".side .grp", win).forEach(g => g.hidden = !!q);
      $("#snone").hidden = n > 0; };
    if (search) {
      search.addEventListener("input", filter);
      search.addEventListener("keydown", e => { if (e.key === "Escape") { search.value = ""; filter(); } else if (e.key === "Enter") { const f = sis.find(s => !s.hidden); if (f) f.click(); } });
      let over = false; win.addEventListener("pointerenter", () => over = true); win.addEventListener("pointerleave", () => over = false);
      addEventListener("keydown", e => { if (over && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && search.offsetParent) { e.preventDefault(); search.focus(); } });
    }
    dash = { show, setDrawer, filter, search, win,
             state: () => ({ view, drawer: !!(drawer && drawer.classList.contains("open")), q: search ? search.value : "", range: chartAPI ? chartAPI.range() : 0,
                             kpi: $$(".kpi[aria-pressed=true]", win).length, pinned: chartAPI ? chartAPI.pinned() : null }) };
  }

  // ---------- ghost cursors: red, green and blue run a short demo through the same code paths as a real pointer ----------
  const wf = $("#winfit");
  if (dash && wf && !reduce && IO) {
    const layer = document.createElement("div"); layer.className = "ghosts"; layer.setAttribute("aria-hidden", "true"); wf.append(layer);
    const mk = (k, col) => { const el = document.createElement("div"); el.className = "gc gc-" + k;
      el.innerHTML = `<svg width="20" height="24" viewBox="0 0 20 24"><path d="M2 2v17.5l4.6-4.4 3.2 7.2 3-1.3-3.2-7.1 6.6-.3z" fill="${col}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><span class="gt"></span><i class="rp"></i>`;
      layer.append(el); return { el, tag: el.querySelector(".gt"), x: 0, y: 0, mv: null }; };
    const R = mk("r", "#E5484D"), Gc = mk("g", "#10B981"), Bc = mk("b", "#2563EB"), ALL = [R, Gc, Bc];
    const STOP = {}; let gen = 0, active = false, raf = 0;
    const box = () => wf.getBoundingClientRect();
    const place = c => { c.el.style.transform = `translate3d(${(c.x - 2).toFixed(1)}px,${(c.y - 2).toFixed(1)}px,0)`; c.el.classList.toggle("flip", c.x > wf.clientWidth - 200); };
    const tick = now => { let busy = false;
      ALL.forEach(c => { const m = c.mv; if (!m) return;
        const k = Math.min(1, (now - m.t0) / m.d), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, u = 1 - e;
        c.x = u * u * m.a[0] + 2 * u * e * m.c[0] + e * e * m.b[0]; c.y = u * u * m.a[1] + 2 * u * e * m.c[1] + e * e * m.b[1]; place(c);
        if (k >= 1) { c.mv = null; m.done(); } else busy = true; });
      raf = busy ? requestAnimationFrame(tick) : 0; };
    const ok = g => { if (g !== gen) throw STOP; };
    const wait = (ms, g) => new Promise((res, rej) => setTimeout(() => g === gen ? res() : rej(STOP), ms));
    // a gentle curve to (x, y) in window-box coordinates, eased in and out
    const glide = (c, x, y) => new Promise(res => {
      const a = [c.x, c.y], dx = x - a[0], dy = y - a[1], dist = Math.hypot(dx, dy) || 1, bend = (dx > 0 ? 1 : -1) * Math.min(70, dist * .2);
      c.mv = { a, b: [x, y], c: [(a[0] + x) / 2 - dy / dist * bend, (a[1] + y) / 2 + dx / dist * bend], t0: performance.now(), d: Math.max(500, Math.min(1250, 420 + dist * 1.05)), done: res };
      if (!raf) raf = requestAnimationFrame(tick); });
    const at = (el, fx = .5, fy = .55) => { const r = el.getBoundingClientRect(), b = box(); return [r.left - b.left + r.width * fx, r.top - b.top + r.height * fy]; };
    const vis = el => !!el && el.getClientRects().length > 0 && !el.closest("[hidden], .under") && el.getBoundingClientRect().width > 0;
    const say = (c, t) => { if (t) c.tag.textContent = t; c.el.classList.toggle("talk", !!t); };
    const go = async (c, el, g, fx, fy) => { const [x, y] = at(el, fx, fy); await glide(c, x, y); ok(g); };
    const hov = (el, on) => el && el.classList.toggle("gh-hover", on);
    const tap = async (c, el, g) => { c.el.classList.add("down"); c.el.classList.remove("click"); void c.el.offsetWidth; c.el.classList.add("click");
      await wait(140, g); c.el.classList.remove("down"); el.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true})); };
    const q1 = s => win.querySelector(s);
    const side = (v, c) => q1(`.side .si[data-go="${v}"]${c ? `[data-co="${c}"]` : ""}`);
    const tablet = () => innerWidth <= 1100;

    // put things back the way a real visitor would find them, by clicking, from wherever they were left
    async function tidy(g) {
      const s = dash.state();
      if (s.drawer) { const x = q1(".sd-x"); await go(Bc, x, g); say(Bc, "Closing the sources"); await tap(Bc, x, g); await wait(450, g); }
      if (s.view !== "postiz") { const el = vis(side("postiz")) ? side("postiz") : null; if (el) { await go(Bc, el, g); say(Bc, "Back to Postiz"); await tap(Bc, el, g); await wait(500, g); } else dash.show("postiz"); }
      if (s.q) { dash.search.value = ""; dash.filter(); }
      for (const k of $$(".kpi[aria-pressed=true]", win)) { await go(R, k, g); await tap(R, k, g); await wait(250, g); }
      if (s.range) { const t = q1('[data-range="all"]'); if (vis(t)) { await go(Gc, t, g); await tap(Gc, t, g); await wait(600, g); } }
      if (chartAPI && chartAPI.pinned() != null) chartAPI.reset();
      ALL.forEach(c => say(c, ""));
    }

    // one loop, about 25 s; each beat is one cursor acting while the next one drifts toward its target
    const BEATS = [
      { c: () => R, t: () => q1(".kpi"), run: async (c, el, g) => { say(c, "Checking the source"); hov(el, true); await wait(700, g); await tap(c, el, g); await wait(1300, g); await tap(c, el, g); hov(el, false); await wait(300, g); } },
      { c: () => Gc, desk: true, t: () => q1('[data-range="12"]'), run: async (c, el, g) => { say(c, "Comparing 12 months"); hov(el, true); await wait(350, g); await tap(c, el, g); hov(el, false); await wait(2200, g); } },
      { c: () => Bc, t: () => q1("#chart"), run: async (c, el, g) => { say(c, "Reading the line");
          for (const k of [6, 8, 9]) { const p = chartAPI && chartAPI.point(k); if (!p) continue; const b = box(); await glide(c, p[0] - b.left, p[1] - b.top); ok(g); chartAPI.show(k); await wait(750, g); } } },
      { c: () => Gc, desk: true, t: () => q1('[data-range="all"]'), run: async (c, el, g) => { say(c, "Back to all time"); await tap(c, el, g); await wait(1700, g); } },
      { c: () => R, t: () => chartAPI && chartAPI.tag(5), run: async (c, el, g) => { say(c, "Reading move 6"); await tap(c, el, g); await wait(1700, g); chartAPI.reset(); } },
      { c: () => Bc, t: () => $("#srcbtn"), run: async (c, el, g) => { say(c, "Opening the sources"); hov(el, true); await wait(300, g); await tap(c, el, g); hov(el, false); await wait(1000, g);
          const li = $$(".sd-l li", win)[1]; if (li) { say(c, "Checking GitHub"); await go(c, li, g, .4, .5); await wait(900, g); }
          const x = q1(".sd-x"); say(c, "Closing"); await go(c, x, g); hov(x, true); await wait(250, g); await tap(c, x, g); hov(x, false); await wait(400, g); } },
      { c: () => R, desk: true, t: () => dash.search, run: async (c, el, g) => { say(c, "Searching"); await tap(c, el, g); el.closest(".search").classList.add("gh-focus");
          for (const ch of "goji") { el.value += ch; dash.filter(); await wait(170, g); } await wait(1100, g);
          while (el.value) { el.value = el.value.slice(0, -1); dash.filter(); await wait(90, g); } el.closest(".search").classList.remove("gh-focus"); await wait(300, g); } },
      { c: () => Gc, desk: true, t: () => side("checklists"), run: async (c, el, g) => { say(c, "Opening my checklists"); hov(el, true); await wait(300, g); await tap(c, el, g); hov(el, false); await wait(1600, g);
          const p = side("postiz"); say(c, "Back to Postiz"); await go(c, p, g); hov(p, true); await wait(250, g); await tap(c, p, g); hov(p, false); await wait(500, g); } },
    ];
    async function run(g) {
      const b = box(), W0 = b.width, H0 = b.height;
      [[R, .2, .62], [Gc, .55, .9], [Bc, .88, .35]].forEach(([c, fx, fy]) => { if (!c.x && !c.y) { c.x = W0 * fx; c.y = H0 * fy; } place(c); });
      await wait(500, g); await tidy(g);
      for (;;) {
        const list = BEATS.filter(bt => !(bt.desk && tablet()));
        for (let i = 0; i < list.length; i++) {
          const bt = list[i], c = bt.c(), el = bt.t(); if (!vis(el)) continue;
          ALL.forEach(x => x !== c && say(x, ""));
          // the next beat's cursor starts drifting toward its target while this one acts (staggered, never all at once)
          const nx = list[(i + 1) % list.length], nc = nx.c(), ne = nx.t();
          await go(c, el, g, bt.t === BEATS[2].t ? .55 : .5);
          if (nc !== c && vis(ne)) { const [x, y] = at(ne); setTimeout(() => { if (g === gen && !nc.mv) glide(nc, x + 46, y + 38); }, 350); }
          await bt.run(c, el, g); ok(g);
          say(c, ""); await wait(300, g);
        }
        await tidy(g); await wait(1200, g);
      }
    }
    const start = () => { if (active || document.hidden || !inView || hold || innerWidth < 760) return; active = true; gen++; layer.classList.add("on"); run(gen).catch(e => { if (e !== STOP) console.error(e); }); };
    const stop = () => { if (!active) return; active = false; gen++; layer.classList.remove("on");
      ALL.forEach(c => { if (c.mv) { const d = c.mv.done; c.mv = null; d(); } say(c, ""); c.el.classList.remove("down", "click"); });
      $$(".gh-hover", win).forEach(e => e.classList.remove("gh-hover")); $$(".gh-focus", win).forEach(e => e.classList.remove("gh-focus")); };
    // hand-off: any real pointer, touch, key or focus in the window pauses them at once; they come back ~6 s after you leave or go idle
    let inView = false, hold = false, idle = 0;
    const user = () => { hold = true; stop(); clearTimeout(idle); idle = setTimeout(() => { hold = false; start(); }, 6000); };
    ["pointermove", "pointerdown", "wheel", "keydown", "focusin", "touchstart"].forEach(t => wf.addEventListener(t, user, {passive: true}));
    wf.addEventListener("pointerenter", user);
    new IntersectionObserver(es => { inView = es[0].isIntersecting; if (inView) start(); else stop(); }, {threshold: .3}).observe(wf);
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => innerWidth < 760 ? stop() : start(), 200); });
    window.__lvGhosts = { stop, start, active: () => active };
  }

  // ---------- source cards: the card itself grows in place (hover on desktop, focus on keyboard, tap on touch) ----------
  const cells = $$(".scell");
  const setCell = (c, o) => { c.classList.toggle("open", o); c.setAttribute("aria-expanded", o); };
  cells.forEach(c => {
    let t;
    c.addEventListener("pointerenter", e => { if (e.pointerType !== "mouse") return; clearTimeout(t); t = setTimeout(() => setCell(c, true), 90); });
    c.addEventListener("pointerleave", e => { if (e.pointerType !== "mouse") return; clearTimeout(t); t = setTimeout(() => { if (document.activeElement !== c || !c.matches(":focus-visible")) setCell(c, false); }, 120); });
    c.addEventListener("focus", () => { if (c.matches(":focus-visible")) setCell(c, true); });
    c.addEventListener("blur", () => { if (!c.matches(":hover")) setCell(c, false); });
    c.addEventListener("click", e => { if (canHover && e.pointerType === "mouse") return; e.stopPropagation(); const o = !c.classList.contains("open"); cells.forEach(x => x !== c && setCell(x, false)); setCell(c, o); });
  });
  document.addEventListener("click", e => { if (!e.target.closest(".scell")) cells.forEach(x => setCell(x, false)); });
  addEventListener("keydown", e => { if (e.key === "Escape") cells.forEach(x => setCell(x, false)); });

  // ---------- checklists (remembered on the breakdown page) ----------
  $$(".ckl").forEach(box => {
    const cks = $$(".ck", box), prog = box.querySelector(".prog"), key = box.dataset.store;
    const saved = key && store.get(key);
    if (saved) cks.forEach((c, i) => c.setAttribute("aria-pressed", !!saved[i]));
    const upd = () => { if (prog) prog.textContent = cks.filter(x => x.getAttribute("aria-pressed") === "true").length + " of " + cks.length + (box.dataset.word === "done" ? " done" : " ticked");
      if (key) store.set(key, cks.map(x => x.getAttribute("aria-pressed") === "true")); };
    cks.forEach(c => c.addEventListener("click", () => { c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") !== "true"); upd(); }));
    if (saved) upd();
  });
  $$(".tr.has-read").forEach(r => r.addEventListener("click", e => { if (!e.target.closest("a")) { const a = r.querySelector("a.read"); if (a) location.href = a.href; } }));

  // ---------- pricing: monthly / yearly for every tier ----------
  $$("[data-b]").forEach(b => b.addEventListener("click", () => {
    const y = b.dataset.b === "y";
    $$("[data-b]").forEach(x => x.setAttribute("aria-pressed", x.dataset.b === b.dataset.b));
    $$(".plan [data-m], .ptab [data-m]").forEach(e => { const v = y ? e.dataset.y : e.dataset.m; if (e.textContent === v) return; e.textContent = v;
      if (e.classList.contains("amt") && !reduce) { e.classList.remove("swap"); void e.offsetWidth; e.classList.add("swap"); } });
  }));

  // ---------- FAQ: single-open accordion with animated height ----------
  $$(".acc, .faq").forEach(acc => {
    const ds = $$(":scope details", acc).filter(d => d.closest(".acc, .faq") === acc);
    ds.forEach(d => {
      const s = d.querySelector("summary"); let a = d.querySelector(".qa-a");
      if (!a) { a = document.createElement("div"); a.className = "qa-a"; [...d.childNodes].filter(n => n !== s).forEach(n => a.appendChild(n)); d.appendChild(a); }
      d.classList.toggle("is-open", d.open);
      d._set = open => {
        if (d._anim) { d._anim.cancel(); d._anim = null; }
        d.classList.toggle("is-open", open);
        if (reduce || !a.animate) { d.open = open; return; }
        if (open) { d.open = true; const h = a.scrollHeight; d._anim = a.animate([{height: "0px", opacity: 0}, {height: h + "px", opacity: 1}], {duration: 380, easing: "cubic-bezier(.16,1,.3,1)"}); d._anim.onfinish = () => d._anim = null; }
        else { const h = a.offsetHeight; d._anim = a.animate([{height: h + "px", opacity: 1}, {height: "0px", opacity: 0}], {duration: 300, easing: "cubic-bezier(.4,0,.2,1)"}); d._anim.onfinish = () => { d.open = false; d._anim = null; }; }
      };
      s.addEventListener("click", e => { e.preventDefault(); const open = !d.classList.contains("is-open");
        if (open) ds.forEach(x => x !== d && x.classList.contains("is-open") && x._set(false)); d._set(open); });
    });
  });

  // quiz: moved to assets/home.js (Coder C)

  // ---------- magnetic buttons: within 12px the button eases toward the pointer, max 8px, no overshoot; mouse only ----------
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
    H.addEventListener("pointerleave", () => { mx = my = -999; kick(); });
  }

  // ---------- Studio cursor: dot on the pointer, ring follows (lerp .2); "Read" bubble on story cards/posts; dims on dark; mouse only ----------
  if (!reduce) {
    const LABELS = [[".tr.has-read, .post, .feat, .ncard.live, .bcard.live, .lcard.live", "Read"]];
    const labelFor = t => { for (const [sel, l] of LABELS) if (t.closest(sel)) return l; return ""; };
    const dot = document.createElement("div"), ring = document.createElement("div"), lab = document.createElement("b");
    dot.className = "cur"; ring.className = "cur-ring"; ring.append(lab); document.body.append(dot, ring);
    const lerp = (a, b, t) => a + (b - a) * t;
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
      const t = e.target, txt = t.closest("input, textarea, select"), l = txt ? "" : labelFor(t),
            hov = !txt && !l && t.closest("a, button, summary, label, [role=button], [role=tab]");
      H.classList.toggle("cur-text", !!txt); H.classList.toggle("cur-lbl", !!l); H.classList.toggle("cur-dark", !!t.closest(".dk, footer, .plan.pro, .plan.full"));
      ring.classList.toggle("lbl", !!l); ring.classList.toggle("hov", !!hov); if (l) lab.textContent = l;
    }, {passive: true});
    addEventListener("pointerdown", e => { if (e.pointerType === "mouse") ring.classList.add("down"); }, {passive: true});
    addEventListener("pointerup", () => ring.classList.remove("down"), {passive: true});
    H.addEventListener("pointerleave", () => H.classList.remove("cur-show"));
  }
})();
