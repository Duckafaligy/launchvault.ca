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
    const links = $$('#nav a[href^="/#"]'), map = {stories: "stories", inside: "stories", sources: "sources", check: "sources", pricing: "pricing", faq: "faq"};
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
    const chips = $$(".chip", g), box = g.dataset.for ? document.getElementById(g.dataset.for) : g.nextElementSibling; if (!box) return;
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
    let G = null, M0 = 0, animate = !reduce && IO, pinned = null, userPin = false;
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
        g.addEventListener("pointerenter", () => showEvent(i)); g.addEventListener("pointerleave", showDefault); g.addEventListener("click", e => pin(i, e.isTrusted));
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
    function pin(i, byUser) { pinned = pinned === i && (userPin || !byUser) ? null : i; userPin = !!byUser && pinned != null; showDefault();   // a user's click takes over a ghost's pin
      const b = movesEl.querySelectorAll(".mv")[i];
      if (pinned != null && b && movesEl.scrollHeight > movesEl.clientHeight + 2) movesEl.scrollTo({top: Math.max(0, b.parentElement.offsetTop - 8), behavior: reduce ? "auto" : "smooth"}); }
    movesEl.addEventListener("pointerover", ev => { const b = ev.target.closest(".mv"); if (b) showEvent(+b.dataset.i); });
    movesEl.addEventListener("pointerleave", showDefault);
    movesEl.addEventListener("click", ev => { const b = ev.target.closest(".mv"); if (b) pin(+b.dataset.i, ev.isTrusted); });
    movesEl.addEventListener("focusin", ev => { const b = ev.target.closest(".mv"); if (b) showEvent(+b.dataset.i); });
    const play = () => { if (!animate) return; plot.classList.remove("drawing"); void plot.offsetWidth; plot.classList.add("drawing"); };
    redraw = draw;
    draw();
    // the line draws itself in the first time the chart is on screen
    if (animate) { plot.classList.add("drawing"); plot.style.visibility = "hidden";
      const pio = new IntersectionObserver(es => { if (es[0].isIntersecting) { pio.disconnect(); plot.style.visibility = ""; play(); } }, {threshold: .3}); pio.observe(plot); }
    // range tabs in the hero window
    $$("[data-range]").forEach(b => b.addEventListener("click", e => { if (dash) dash.userRange = e.isTrusted && b.dataset.range === "12";
      $$("[data-range]").forEach(x => x.setAttribute("aria-selected", x === b)); const m = b.dataset.range === "12" ? 22 : 0; if (m === M0) return; M0 = m; pinned = null; draw(); play(); }));
    // used by the hero's ghost cursors, so they drive the chart through the same functions as a real pointer
    chartAPI = {
      point: k => { const p = P[k]; if (!G || p[0] < M0) return null; const r = svg.getBoundingClientRect(); return [r.left + G.X(p[0]) * r.width / G.W, r.top + G.Y(p[1]) * r.height / G.H]; },
      show: k => showPoint(P[k]), reset: () => { pinned = null; userPin = false; movesEl.scrollTo({top: 0}); showDefault(); }, userPinned: () => userPin,
      idle: () => showDefault(), tag: i => G && G.tags[i], pinned: () => pinned, range: () => M0, count: P.length };
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
      if (!drawer) return; const was = drawer.classList.contains("open"); drawer.classList.toggle("open", open); drawer.setAttribute("aria-hidden", !open); drawer.inert = !open;
      if (was !== open) win.dispatchEvent(new CustomEvent("lv:view", {detail: {view, drawer: open}}));
      if (srcbtn) srcbtn.setAttribute("aria-expanded", open);
      if (byUser) (open ? drawer.querySelector(".sd-x") : srcbtn).focus({preventScroll: true});
    };
    const show = (v, c) => {
      const changed = v !== view || (v === "soon" && c !== co);
      view = v; co = v === "soon" ? c : null;
      post.classList.toggle("under", v !== "postiz");
      views.forEach(x => { x.hidden = x.dataset.view !== v; });
      sis.forEach(s => { const on = s.dataset.go === v && (v !== "soon" || s.dataset.co === c); s.classList.toggle("on", on); if (on) s.setAttribute("aria-current", "page"); else s.removeAttribute("aria-current"); });
      if (v === "soon" && SOON[c]) { const d = SOON[c];
        $("#sotile").textContent = d[0]; $("#soname").textContent = d[1]; $("#socat").textContent = d[2] + " · breakdown coming soon"; $("#sonum").textContent = d[3]; $("#sounit").textContent = d[4]; $("#sodt").textContent = d[5]; }
      if (url) url.textContent = v === "soon" ? "/breakdowns/" + c : URLS[v] || "/";
      setDrawer(false);
      if (v === "postiz" && redraw) redraw();
      requestAnimationFrame(() => $$(".seg", win).forEach(placeInd));
      // tells anyone watching (the ghost cursors) that the dashboard now shows something else
      if (changed) win.dispatchEvent(new CustomEvent("lv:view", {detail: {view: v, co: co, drawer: false}}));
    };
    win.addEventListener("click", e => {
      const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); if (dash) dash.userView = e.isTrusted && g.dataset.go !== "postiz"; show(g.dataset.go, g.dataset.co); return; }
      const k = e.target.closest(".kpi"); if (k) { const on = k.getAttribute("aria-pressed") !== "true"; k.setAttribute("aria-pressed", on); k.dataset.u = e.isTrusted && on ? "1" : ""; return; }
      if (e.target.closest("#srcbtn")) { const o = !drawer.classList.contains("open"); if (dash) dash.userDrawer = e.isTrusted && o; setDrawer(o, e.isTrusted); return; }
      if (e.target.closest(".sd-x")) { if (dash) dash.userDrawer = false; setDrawer(false, e.isTrusted); return; }
      const f = e.target.closest("[data-vf]");        // Breakdowns filter
      if (f) { $$("[data-vf]", win).forEach(x => x.setAttribute("aria-pressed", x === f)); $$("#bdlist .vrow", win).forEach(r => r.hidden = f.dataset.vf !== "all" && r.dataset.st !== f.dataset.vf); return; }
      const vb = e.target.closest(".vs-b");           // Sources: a row expands in place
      if (vb) { const li = vb.parentElement, o = !li.classList.contains("open"); li.classList.toggle("open", o); vb.setAttribute("aria-expanded", o); return; }
      const ck = e.target.closest(".ck"); if (ck && e.isTrusted) ck.dataset.u = "1";
    });
    win.addEventListener("keydown", e => { if (e.key === "Escape" && drawer && drawer.classList.contains("open")) { e.stopPropagation(); setDrawer(false, true); } });
    // search filters the sidebar; Ctrl/Cmd K focuses it while the pointer is over the window
    const filter = () => { const q = search.value.trim().toLowerCase(); let n = 0;
      sis.forEach(s => { const on = !q || s.textContent.toLowerCase().includes(q); s.hidden = !on; if (on) n++; });
      $$(".side .grp", win).forEach(g => g.hidden = !!q);
      $("#snone").hidden = n > 0; };
    if (search) {
      search.addEventListener("input", e => { filter(); if (dash) dash.userQ = e.isTrusted && !!search.value; });
      search.addEventListener("keydown", e => { if (e.key === "Escape") { search.value = ""; filter(); } else if (e.key === "Enter") { const f = sis.find(s => !s.hidden); if (f) f.click(); } });
      let over = false; win.addEventListener("pointerenter", () => over = true); win.addEventListener("pointerleave", () => over = false);
      addEventListener("keydown", e => { if (over && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && search.offsetParent) { e.preventDefault(); search.focus(); } });
    }
    dash = { show, setDrawer, filter, search, win, userView: false, userDrawer: false, userQ: false,
             state: () => ({ view, drawer: !!(drawer && drawer.classList.contains("open")), q: search ? search.value : "", range: chartAPI ? chartAPI.range() : 0,
                             kpi: $$(".kpi[aria-pressed=true]", win).length, pinned: chartAPI ? chartAPI.pinned() : null }) };
  }

  // ---------- ghost cursors: three "people" browsing alongside you (red quick, green careful, blue wandery) ----------
  // Context-aware: each dashboard view has its own pool of actions built from its real controls. When the view changes
  // (you or a ghost), every ghost drops what it was doing, looks around the new content, then works from the new pool.
  // Human motion: Fitts-timed aimed moves, lopsided arcs, skewed speed, overshoot + corrections, tremor, idle drift.
  // Shared with the real user: never paused by you, never on the control you're using, never switching views while you're active.
  const wf = $("#winfit");
  if (dash && wf && !reduce && IO) {
    const layer = document.createElement("div"); layer.className = "ghosts"; layer.setAttribute("aria-hidden", "true"); wf.append(layer);
    const rnd = (a, b) => a + Math.random() * (b - a), any = a => a[Math.floor(Math.random() * a.length)], chance = p => Math.random() < p;
    const PERS = [
      { speed: .74, over: [1, 4], corr: [0, 1], hes: [120, 260], dwell: .75, skip: .06, mind: .07, drift: 4, typ: [75, 140], wander: .08 },
      { speed: 1.35, over: [0, 2.5], corr: [1, 2], hes: [300, 600], dwell: 1.3, skip: .14, mind: .08, drift: 3, typ: [140, 220], wander: .08 },
      { speed: 1.02, over: [3, 8], corr: [1, 2], hes: [180, 480], dwell: 1.05, skip: .22, mind: .28, drift: 9, typ: [90, 200], wander: .4 } ];
    const mk = (k, col, P) => { const el = document.createElement("div"); el.className = "gc gc-" + k;
      el.innerHTML = `<svg width="20" height="24" viewBox="0 0 20 24"><path d="M2 2v17.5l4.6-4.4 3.2 7.2 3-1.3-3.2-7.1 6.6-.3z" fill="${col}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><span class="gt"></span><i class="rp"></i>`;
      layer.append(el); return { el, tag: el.querySelector(".gt"), x: 0, y: 0, seg: null, P, hov: new Set(), ep: 0, tgt: null,
        tr: { a: rnd(.6, 1.3), f1: rnd(3.5, 7), f2: rnd(9, 14), p1: rnd(0, 6.3), p2: rnd(0, 6.3) }, stats: { moves: 0, corrections: 0, overshoots: 0, changes: 0, skips: 0, typos: 0, looks: 0, sig: [] } }; };
    const ALL = [mk("r", "#E5484D", PERS[0]), mk("g", "#10B981", PERS[1]), mk("b", "#2563EB", PERS[2])];
    const STOP = {}, CANCEL = {}, ABORT = {}; let gen = 0, epoch = 0, active = false, raf = 0, S = null;
    const box = () => wf.getBoundingClientRect();
    const place = (c, x, y) => { c.el.style.transform = `translate3d(${(x - 2).toFixed(1)}px,${(y - 2).toFixed(1)}px,0)`; c.el.classList.toggle("flip", x > wf.clientWidth - 200); };
    // one rAF loop: segments (Kumaraswamy time warp = quick start, long tail; optional mid-move pause) + smoothed tremor
    const tick = now => { if (!active) { raf = 0; return; }
      const ts = now / 1000;
      ALL.forEach(c => { const s = c.seg;
        if (s) { let t = now - s.t0; if (s.pz && t > s.pz[0]) t = t < s.pz[0] + s.pz[1] ? s.pz[0] : t - s.pz[1];
          const k = Math.min(1, t / s.d), e = 1 - Math.pow(1 - Math.pow(k, s.ka), s.kb), u = 1 - e;
          c.x = u * u * s.a[0] + 2 * u * e * s.c[0] + e * e * s.b[0]; c.y = u * u * s.a[1] + 2 * u * e * s.c[1] + e * e * s.b[1];
          if (s.on) s.on(c); if (k >= 1) { c.seg = null; s.done(); } }
        const T = c.tr, jx = T.a * (.65 * Math.sin(ts * T.f1 + T.p1) + .35 * Math.sin(ts * T.f2 + T.p2)), jy = T.a * (.65 * Math.cos(ts * T.f1 * .87 + T.p2) + .35 * Math.sin(ts * T.f2 * 1.13 + T.p1));
        place(c, c.x + jx, c.y + jy); });
      raf = requestAnimationFrame(tick); };
    // a token per action: STOP when the ghosts are switched off, ABORT when the view changed under it
    const ok = t => { if (t.g !== gen) throw STOP; if (t.e !== epoch) throw ABORT; };
    const wait = (ms, t) => new Promise((res, rej) => setTimeout(() => { try { ok(t); res(); } catch (e) { rej(e); } }, ms));
    const seg = (c, to, d, o = {}) => new Promise(res => { if (c.seg) { const p = c.seg.done; c.seg = null; p(); }
      c.seg = { a: [c.x, c.y], b: to, c: o.c || [(c.x + to[0]) / 2, (c.y + to[1]) / 2], t0: performance.now(), d: Math.max(16, d), ka: o.ka || 1.5, kb: o.kb || 2.4, pz: o.pz || null, on: o.on || null, done: res }; });
    async function aim(c, x, y, g, w = 24, o = {}) {
      const P = c.P, dx = x - c.x, dy = y - c.y, D = Math.hypot(dx, dy); if (D < 1.5) return;
      const ux = dx / D, uy = dy / D, MT = (150 + 135 * Math.log2(D / Math.max(8, w) + 1)) * P.speed * rnd(.82, 1.28) * (o.slow || 1);
      let ov = o.exact ? 0 : rnd(P.over[0], P.over[1]) * (chance(.72) ? 1 : -.6); if (D < 30) ov *= .3;
      const side = rnd(-1.8, 1.8), ex = x + ux * ov - uy * side, ey = y + uy * ov + ux * side;
      const f = rnd(.22, .62), off = D * rnd(.03, .17) * (chance(.5) ? -1 : 1), ctrl = [c.x + dx * f - uy * off, c.y + dy * f + ux * off];
      const d1 = MT * rnd(.7, .82), ka = rnd(1.25, 1.9), kb = rnd(2.1, 3.8);
      c.stats.moves++; if (Math.abs(ov) > 2) c.stats.overshoots++; c.stats.sig.push([Math.round(d1), +ka.toFixed(2), +kb.toFixed(2), Math.round(off)]); if (c.stats.sig.length > 60) c.stats.sig.shift();
      await seg(c, [ex, ey], d1, { c: ctrl, ka, kb, on: o.on, pz: D > 140 && chance(.12) ? [d1 * rnd(.3, .6), rnd(50, 140)] : null }); ok(g);
      if (o.noFix) return;
      const n = Math.round(rnd(P.corr[0], P.corr[1])) + (Math.abs(ov) > 3 ? 1 : 0);
      for (let i = 0; i < n; i++) { const last = i === n - 1, tx = x + (last ? rnd(-1, 1) : rnd(-2.6, 2.6)), ty = y + (last ? rnd(-1, 1) : rnd(-2.6, 2.6));
        c.stats.corrections++; await seg(c, [tx, ty], rnd(85, 200) * P.speed, { ka: rnd(1.2, 1.7), kb: rnd(1.8, 2.8), on: o.on }); ok(g);
        if (!last) await wait(rnd(25, 90), g); }
    }
    const at = (el, fx, fy) => { const r = el.getBoundingClientRect(), b = box(); return [r.left - b.left + r.width * fx, r.top - b.top + r.height * fy, Math.min(r.width, r.height)]; };
    const vis = el => !!el && el.isConnected && el.getClientRects().length > 0 && !el.closest("[hidden], .under, [inert]") && el.getBoundingClientRect().width > 0;
    async function idle(c, ms, g) { const end = performance.now() + ms * c.P.dwell;
      while (end - performance.now() > 40) { const r = c.P.drift; await seg(c, [c.x + rnd(-r, r), c.y + rnd(-r * .7, r * .7)], Math.min(end - performance.now(), rnd(500, 1300)), { ka: rnd(1.3, 1.8), kb: rnd(1.6, 2.4) }); ok(g); } }
    const crowded = (c, x, y) => ALL.some(o => o !== c && (Math.hypot(o.x - x, o.y - y) < 26 || (o.tgt && Math.hypot(o.tgt[0] - x, o.tgt[1] - y) < 26)));
    async function go(c, el, g, fx = rnd(.3, .7), fy = rnd(.38, .66)) {
      if (chance(c.P.mind)) { const d = any(CONTENT().filter(x => x !== el)); if (d) { c.stats.changes++; const [x, y] = at(d, .5, .5), k = rnd(.35, .7);
        await aim(c, c.x + (x - c.x) * k, c.y + (y - c.y) * k, g, 40, { noFix: true }); await wait(rnd(120, 380), g); } }
      if (!vis(el)) throw CANCEL; let [x, y, w] = at(el, fx, fy);
      for (let t = 0; t < 6 && crowded(c, x, y); t++) [x, y, w] = at(el, rnd(.12, .88), rnd(.25, .8));
      if (crowded(c, x, y)) throw CANCEL; c.tgt = [x, y]; await aim(c, x, y, g, w); }
    const say = (c, t) => { if (t) c.tag.textContent = t; c.el.classList.toggle("talk", !!t); };
    const hov = (c, el, on) => { if (!el) return; if (on && userOwns(el)) return; el.classList.toggle("gh-hover", on); if (on) c.hov.add(el); else c.hov.delete(el); };
    const fire = (el, type) => el.dispatchEvent(type === "click" ? new MouseEvent("click", {bubbles: true, cancelable: true}) : new PointerEvent(type, {bubbles: true, pointerType: "mouse"}));
    // a human click: hesitate, maybe decide not to, ~90 ms press with a 1-2 px drift, ripple. Never on a stale or user-held target.
    async function click(c, el, g, o = {}) {
      if (userOwns(el)) throw CANCEL;
      await idle(c, o.must ? rnd(90, 200) : rnd(c.P.hes[0], c.P.hes[1]), g);
      if (!o.must && chance(c.P.skip)) { c.stats.skips++; return false; }
      if (!vis(el)) { S.staleBlocked++; throw CANCEL; } if (userOwns(el) || (o.disrupt && !navOK(true))) throw CANCEL;
      c.el.classList.add("down"); c.el.classList.remove("click"); void c.el.offsetWidth; c.el.classList.add("click");
      await seg(c, [c.x + rnd(-1.6, 1.6), c.y + rnd(-.6, 1.8)], rnd(80, 105), { ka: 1.2, kb: 1.6 }); ok(g);
      c.el.classList.remove("down"); if (!vis(el)) { S.staleBlocked++; throw CANCEL; } S.fired++; fire(el, "click");
      if (o.disrupt) { S.log.push(performance.now() - U.last); if (S.log.length > 200) S.log.shift(); }
      await idle(c, rnd(150, 400), g); return true; }
    const NEAR = { a: "s", b: "v", c: "x", d: "s", e: "w", f: "d", g: "h", h: "j", i: "u", j: "k", k: "l", l: "k", m: "n", n: "m", o: "i", p: "o", r: "e", s: "a", t: "r", u: "y", w: "e" };
    async function type(c, inp, word, g) { S.typing = true;
      const typo = chance(.25) ? Math.floor(rnd(1, word.length)) : -1;
      for (let i = 0; i < word.length; i++) {
        if (U.focus === inp) throw CANCEL;
        if (i === typo) { c.stats.typos++; inp.value += NEAR[word[i]] || "x"; dash.filter(); await wait(rnd(150, 320), g); inp.value = inp.value.slice(0, -1); dash.filter(); await wait(rnd(90, 170), g); }
        inp.value += word[i]; dash.filter(); await wait(rnd(c.P.typ[0], c.P.typ[1]) + (chance(.12) ? rnd(250, 520) : 0), g); }
      S.typing = false; }
    const q1 = s => win.querySelector(s), qa = s => $$(s, win).filter(vis);
    const side = (v, co) => q1(`.side .si[data-go="${v}"]${co ? `[data-co="${co}"]` : ""}`);
    const label = el => (el.lastChild && el.lastChild.nodeType === 3 ? el.lastChild.textContent : el.textContent).trim();
    const desk = () => innerWidth > 1100, st = () => dash.state();
    const VX = s => s.split(",").map(x => `.view.vx:not([hidden]) ${x.trim()}`).join(", ");   // every selector scoped to the open view
    // what's on screen right now, used to look around after a change and for changes of mind
    const CONTENT = () => { const s = st(); if (s.drawer) return qa(".sd-l li, .sd-h b, .sd-f");
      return s.view === "postiz" ? qa(".kpi, .ch-h .big, .phead, #moves .mv, .dtabs button") : qa(VX(".vh b, button, li, .so-n b, .so-t"));
    };

    // --- the real user
    const U = { last: -1e9, over: null, focus: null, inside: false };
    const CTRL = "button, a, input, .vsrc li, .sd-l li, #plot, .ch-h";
    const touch = () => { U.last = performance.now(); };
    win.addEventListener("pointermove", e => { if (!e.isTrusted) return; touch(); U.inside = true; U.over = e.target.closest(CTRL);
      // reading something a ghost opened makes it yours: they won't close it or switch away from it
      if (e.target.closest("#sdrawer.open")) dash.userDrawer = true; else if (e.target.closest(".view.vx:not([hidden])")) dash.userView = true; }, {passive: true});
    win.addEventListener("pointerleave", e => { if (e.isTrusted) { U.over = null; U.inside = false; } });
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(t => win.addEventListener(t, e => { if (e.isTrusted) touch(); }, {passive: true}));
    win.addEventListener("focusin", e => { if (!e.isTrusted) return; touch(); U.focus = e.target;
      if (e.target === dash.search && S && S.typing) { dash.search.value = ""; dash.filter(); S.typing = false; } });
    win.addEventListener("focusout", e => { if (e.isTrusted) U.focus = null; });
    const userOwns = el => [U.over, U.focus].some(u => u && el && (u === el || el.contains(u) || u.contains(el)));
    const userIn = sel => [U.over, U.focus].some(u => u && u.closest(sel));
    const userBusy = ms => performance.now() - U.last < ms;
    const mayUndoUser = () => !U.inside && !U.focus && !userBusy(8000);
    // changing what everyone sees: only while you're idle (3 s), never within 1.5 s of you, never away from something you adopted
    function navOK(atClick) { if (userBusy(atClick ? 1500 : 3000)) return false; const s = st();
      if (dash.userView && s.view !== "postiz" && !mayUndoUser()) return false; if (dash.userDrawer && s.drawer && !mayUndoUser()) return false; return true; }
    const drawerRect = () => { const d = $("#sdrawer"); return d && d.classList.contains("open") ? d.getBoundingClientRect() : null; };
    const clear = el => { const d = drawerRect(); return !d || el.closest("#sdrawer") || el.getBoundingClientRect().right < d.left - 4; };
    const free = k => !S.locks.has(k) && !(k instanceof Element && userOwns(k));
    const userKpi = k => k.dataset.u === "1";
    const chartFree = () => free("chart") && !userIn("#plot, #moves, .dtabs, .ch-h") && !(chartAPI && chartAPI.userPinned());
    const chartRest = () => { if (!chartAPI) return; if (chartAPI.userPinned()) chartAPI.idle(); else chartAPI.reset(); };
    // hold a control (or several) for the length of an action
    async function hold(keys, fn) { const s = S; if (keys.some(k => !free(k))) throw CANCEL; keys.forEach(k => s.locks.add(k)); try { await fn(); } finally { keys.forEach(k => s.locks.delete(k)); } }
    // things a ghost toggled and must put back (a KPI source, a ticked step, an expanded row, a filter)
    const mess = (el, undo, still) => S.dirty.set(el, { undo, still }), tidied = el => S.dirty.delete(el);
    const PTS = () => { const out = []; if (!chartAPI) return out; const b = box(), d = drawerRect();
      for (let k = 0; k < chartAPI.count; k++) { const p = chartAPI.point(k); if (p && (!d || p[0] < d.left - 6)) out.push([k, p[0] - b.left, p[1] - b.top]); } return out; };
    // hover something, look at it, leave
    const look = (sel, text, pre) => ({ w: 3, can: () => qa(sel).filter(free).filter(clear).length > 0, run: async (c, g) => {
      const el = any(qa(sel).filter(free).filter(clear)); await hold([el], async () => { say(c, typeof text === "function" ? text(el) : text); await go(c, el, g, ...(pre || [])); hov(c, el, true); await idle(c, rnd(500, 1100), g); hov(c, el, false); }); } });
    // click something that changes the view (only when navOK)
    const nav = (sel, text, w = 2.5) => ({ w, can: () => navOK() && free("nav") && qa(sel).filter(free).length > 0, run: async (c, g) => {
      const el = any(qa(sel).filter(free)); await hold(["nav", el], async () => { say(c, typeof text === "function" ? text(el) : text); await go(c, el, g); hov(c, el, true); await click(c, el, g, {disrupt: true}); hov(c, el, false); }); } });

    // ===== one pool per view =====
    const POOLS = {
      postiz: [
        { w: 6, can: () => $$(".kpi", win).some(k => free(k) && vis(k) && clear(k) && !userKpi(k)), run: async (c, g) => {
            const ks = $$(".kpi", win), k = any(ks.filter(x => free(x) && vis(x) && clear(x) && !userKpi(x))), i = ks.indexOf(k);
            const L = ["Checking MRR's source", "Checking all-time revenue", "Checking subscriptions", "Checking the GitHub stars"];
            await hold([k], async () => { say(c, L[i]); await go(c, k, g); hov(c, k, true);
              if (await click(c, k, g)) { if (k.getAttribute("aria-pressed") === "true") mess(k, k, () => k.getAttribute("aria-pressed") === "true" && !userKpi(k)); await idle(c, rnd(800, 1600), g);
                if (k.getAttribute("aria-pressed") === "true" && !userKpi(k)) { await click(c, k, g, {must: true}); tidied(k); } }
              else await idle(c, rnd(300, 700), g); hov(c, k, false); }); } },
        { w: 5, can: () => chartFree() && PTS().length > 2, run: async (c, g) => {
            await hold(["chart"], async () => { const pts = PTS(), n = Math.min(pts.length, Math.round(rnd(3, 6))), s0 = Math.floor(rnd(0, pts.length - n + 1));
              let cur = -1; const follow = cc => { let best = null, bd = 1e9; for (const p of pts) { const d = Math.abs(p[1] - cc.x); if (d < bd) { bd = d; best = p; } } if (best && best[0] !== cur) { cur = best[0]; chartAPI.show(cur); } };
              say(c, "Scrubbing the chart"); await aim(c, pts[s0][1], pts[s0][2], g, 14, { on: follow });
              for (let j = 1; j < n; j++) { if (!chartFree.call(null)) break; const p = pts[s0 + j];
                await seg(c, [p[1] + rnd(-6, 6), p[2] + rnd(-10, 8)], rnd(220, 720) * c.P.speed, { ka: rnd(1.2, 1.8), kb: rnd(1.6, 2.8), on: follow }); ok(g);
                await idle(c, rnd(120, 650), g);
                if (chance(.2) && j > 1) { const q = pts[s0 + j - 1]; await seg(c, [q[1] + rnd(-4, 4), q[2]], rnd(200, 420), { ka: 1.4, kb: 2, on: follow }); ok(g); await idle(c, rnd(150, 400), g); } }
              chartRest(); }); } },
        { w: 4, can: () => chartFree() && !!chartAPI && [0, 1, 2, 3, 4, 5, 6, 7].some(i => vis(chartAPI.tag(i)) && clear(chartAPI.tag(i))), run: async (c, g) => {
            await hold(["chart"], async () => { const ids = [0, 1, 2, 3, 4, 5, 6, 7].filter(i => vis(chartAPI.tag(i)) && clear(chartAPI.tag(i)));
              for (let r = 0, n = chance(.45) ? 2 : 1; r < n; r++) { const i = any(ids), t = chartAPI.tag(i); say(c, "Reading move " + (i + 1));
                await go(c, t, g, .5, .5); if (await click(c, t, g)) await idle(c, rnd(900, 1500), g); }
              chartRest(); }); } },
        { w: 3, can: () => chartFree() && qa("#moves .mv").filter(clear).length > 0, run: async (c, g) => {
            await hold(["chart"], async () => { const mv = $("#moves"), o = mv.getBoundingClientRect();
              const rows = qa("#moves .mv").filter(b => { const r = b.getBoundingClientRect(); return r.top >= o.top - 1 && r.bottom <= o.bottom + 2 && clear(b); });
              const s0 = Math.floor(rnd(0, Math.max(1, rows.length - 3))), n = Math.min(rows.length - s0, Math.round(rnd(3, 5)));
              for (let j = 0; j < n; j++) { const b = rows[s0 + j]; say(c, "Reading move " + (+b.dataset.i + 1));
                await go(c, b, g, rnd(.2, .55), rnd(.35, .6)); hov(c, b, true); fire(b, "pointerover"); await idle(c, rnd(500, 1200), g); hov(c, b, false); }
              fire(mv, "pointerleave"); chartRest(); }); } },
        { w: 3, can: () => chartFree() && navOK() && desk() && vis(q1("[data-range]")) && !(dash.userRange && !mayUndoUser()), run: async (c, g) => {
            await hold(["chart"], async () => { const t = q1('[data-range][aria-selected="false"]'); say(c, t.dataset.range === "12" ? "Comparing 12 months" : "Back to all time");
              await go(c, t, g); hov(c, t, true); if (await click(c, t, g, {disrupt: true})) await idle(c, rnd(1100, 1800), g); hov(c, t, false); }); } },
        look(".mtop .btn-p", "Eyeing the full breakdown"),
        nav("#srcbtn", "Opening the sources", 3),
        { w: 2, can: () => desk() && navOK() && free("nav") && vis(dash.search) && !dash.search.value && U.focus !== dash.search, run: async (c, g) => { const inp = dash.search, lab = inp.closest(".search");
            await hold(["nav", inp], async () => { const word = any(["goji", "dm", "sten", "wind", "post", "champ"]); say(c, "Searching"); await go(c, inp, g);
              try { if (!(await click(c, inp, g, {disrupt: true}))) return; lab.classList.add("gh-focus"); await type(c, inp, word, g); }
              finally { lab.classList.remove("gh-focus"); S.typing = false; } }); } },
      ],
      drawer: [
        look(".sd-l li", el => "Checking " + el.querySelector(".sr-n").textContent.trim(), [rnd(.15, .5), .5]),
        look(".sd-l li", "Reading a source"),
        look(".sd-f", "Eyeing the breakdown link"),
        { w: 2.5, can: () => navOK() && free("nav") && !(dash.userDrawer && !mayUndoUser()) && vis(q1(".sd-x")), run: async (c, g) => { const x = q1(".sd-x");
            await hold(["nav", x], async () => { say(c, "Closing the sources"); await go(c, x, g, .5, .5); hov(c, x, true); await click(c, x, g, {must: true, disrupt: true}); hov(c, x, false); }); } },
      ],
      search: [
        { w: 6, can: () => navOK() && free("nav") && qa(".side .si").length > 0 && U.focus !== dash.search, run: async (c, g) => { const hit = qa(".side .si")[0];
            await hold(["nav", hit], async () => { say(c, "Opening " + label(hit)); await go(c, hit, g); hov(c, hit, true); await idle(c, rnd(150, 350), g);
              if (U.focus !== dash.search && !dash.userQ) { dash.search.value = ""; dash.filter(); }      // the result stays put once the list is full again
              await click(c, hit, g, {must: true, disrupt: true}); hov(c, hit, false); }); } },
        { w: 2, can: () => !dash.userQ && U.focus !== dash.search, run: async (c, g) => { const inp = dash.search, lab = inp.closest(".search");
            await hold([inp], async () => { say(c, "Clearing the search"); await go(c, inp, g); lab.classList.add("gh-focus");
              try { while (inp.value && U.focus !== inp) { inp.value = inp.value.slice(0, -1); dash.filter(); await wait(rnd(60, 110), g); } } finally { lab.classList.remove("gh-focus"); } }); } },
      ],
      home: [
        look(VX(".hcard:not(.hcont)"), "Reading this week's story"),
        nav(VX(".hcard:not(.hcont)"), "Continue reading Postiz"),
        look(VX(".hcont"), "Looking at my checklist"),
        nav(VX(".hcont"), "Opening my checklist"),
        look(VX(".vrow"), el => "Looking at " + el.querySelector("b").textContent),
        nav(VX(".vrow"), el => "Opening " + el.querySelector("b").textContent, 1.5),
      ],
      breakdowns: [
        look(VX(".vrow:not([hidden])"), el => "Looking at " + el.querySelector("b").textContent),
        { w: 3, can: () => qa("[data-vf]").filter(free).length > 1, run: async (c, g) => { const cur = q1('[data-vf][aria-pressed="true"]'), b = any(qa('[data-vf][aria-pressed="false"]').filter(free)); if (!b) throw CANCEL;
            await hold([b], async () => { say(c, b.dataset.vf === "all" ? "Showing all" : "Filtering: " + b.textContent.trim()); await go(c, b, g); hov(c, b, true);
              if (await click(c, b, g)) { if (b.dataset.vf === "all") tidied(q1("[data-vf]")); else mess(q1("[data-vf]"), q1('[data-vf="all"]'), () => q1('[data-vf="all"]').getAttribute("aria-pressed") !== "true"); await idle(c, rnd(700, 1300), g); } hov(c, b, false); }); } },
        nav(VX('.vrow[data-go="postiz"]'), "Opening Postiz", 2.5),
        nav(VX('.vrow[data-st="soon"]:not([hidden])'), el => "Opening " + el.querySelector("b").textContent, 1.2),
      ],
      checklists: [
        { w: 5, can: () => qa(VX(".ck")).some(k => free(k) && k.dataset.u !== "1"), run: async (c, g) => { const k = any(qa(VX(".ck")).filter(x => free(x) && x.dataset.u !== "1"));
            await hold([k], async () => { const was = k.getAttribute("aria-pressed"); say(c, was === "true" ? "Unticking a step" : "Ticking a step"); await go(c, k, g, rnd(.08, .4)); hov(c, k, true);
              if (await click(c, k, g)) { mess(k, k, () => k.getAttribute("aria-pressed") !== was && k.dataset.u !== "1"); await idle(c, rnd(600, 1200), g); if (k.getAttribute("aria-pressed") !== was && k.dataset.u !== "1") { say(c, "Putting it back"); await click(c, k, g, {must: true}); } tidied(k); } hov(c, k, false); }); } },
        look(VX(".vh .prog"), "Checking my progress"),
        look(VX(".ck"), "Reading a step", [rnd(.3, .8), .5]),
      ],
      sources: [
        look(VX(".vs-b"), el => "Looking at " + el.textContent.replace(el.querySelector(".lb") ? el.querySelector(".lb").textContent : "", "").trim()),
        { w: 4, can: () => qa(VX(".vs-b")).some(b => free(b) && !b.parentElement.classList.contains("open")), run: async (c, g) => { const b = any(qa(VX(".vs-b")).filter(x => free(x) && !x.parentElement.classList.contains("open")));
            await hold([b], async () => { say(c, "Opening a source"); await go(c, b, g); hov(c, b, true);
              if (await click(c, b, g)) { mess(b, b, () => b.parentElement.classList.contains("open")); await idle(c, rnd(900, 1600), g); if (b.parentElement.classList.contains("open")) { await click(c, b, g, {must: true}); } tidied(b); } hov(c, b, false); }); } },
      ],
      soon: [
        look(VX("#sonum"), "Reading the number"),
        look(VX(".so-n .lb"), "Checking the label"),
        look(VX(".so-a .btn-p"), "Eyeing the weekly email"),
        nav(VX('.so-a [data-go="postiz"]'), "Back to Postiz", 2.5),
      ],
      // anywhere on desktop: hover the sidebar or Go Pro, and after a while move on to another view
      any: [
        { w: 1.5, can: () => desk() && qa(".side .si").filter(free).length > 0, run: async (c, g) => { const el = any(qa(".side .si").filter(free));
            await hold([el], async () => { say(c, "Browsing"); await go(c, el, g); hov(c, el, true); await idle(c, rnd(350, 800), g); hov(c, el, false); }); } },
        { w: 1, can: () => desk() && free(q1(".splan a")), run: async (c, g) => { const a = q1(".splan a");
            await hold([a, "gopro"], async () => { say(c, "Looking at Go Pro"); await go(c, a, g); hov(c, a, true); await idle(c, rnd(500, 900), g); hov(c, a, false); }); } },
        { w: 0, can: () => { if (!desk() || !navOK() || !free("nav") || st().drawer) return false; const t = performance.now() - S.viewSince, home = st().view === "postiz";
              return t > S.stay ? (home ? 3 : 6) + (t - S.stay) / 1500 : false; },
          run: async (c, g) => { const s = st(), opts = s.view === "postiz" ? qa('.side .si:not([data-go="postiz"])') : chance(.55) ? [side("postiz")] : qa(".side .si").filter(x => !x.classList.contains("on"));
            const el = any(opts.filter(free)); if (!el) throw CANCEL;
            await hold(["nav", el], async () => { say(c, "Opening " + label(el)); await go(c, el, g); hov(c, el, true); await click(c, el, g, {disrupt: true}); hov(c, el, false); }); } },
      ],
    };
    // put back anything a ghost left toggled, in whatever view it's visible
    const TIDY = { w: 0, can: () => { for (const [el, d] of S.dirty) { if (!d.still()) { S.dirty.delete(el); continue; } if (vis(d.undo) && free(d.undo)) return 12; } return false; }, run: async (c, g) => {
      const e = [...S.dirty].find(([el, d]) => d.still() && vis(d.undo) && free(d.undo)); if (!e) return; const [el, { undo }] = e;
      await hold([undo], async () => { say(c, "Tidying up"); await go(c, undo, g); await click(c, undo, g, {must: true}); tidied(el); }); } };
    const context = () => { const s = st(); if (s.drawer) return "drawer"; return s.view; };
    function options(c) { const ctx = context(), list = [...(POOLS[ctx] || []), ...POOLS.any, TIDY];
      if (dash.search.value && !dash.userQ) list.push(...POOLS.search);
      return list.map(a => { try { const w = a.can(c); return w ? [a, typeof w === "number" ? w : a.w] : null; } catch { return null; } }).filter(Boolean); }
    // after any view change: drift over the new content for a moment before acting
    async function lookAround(c, g) { c.stats.looks++; const els = CONTENT(); say(c, "Looking around");
      await wait(rnd(60, 220), g);
      for (let n = chance(.5) ? 2 : 1; n > 0; n--) { let x, y, tries = 0;
        do { const el = any(els); if (!el) break; [x, y] = at(el, rnd(.15, .85), rnd(.25, .75)); } while (crowded(c, x, y) && ++tries < 8);
        if (x == null || crowded(c, x, y)) {        // a sparse view: glance at a free spot in its area instead
          const R = (st().drawer ? $("#sdrawer") : q1(".view.vx:not([hidden])") || q1(".vpost")).getBoundingClientRect(), bx = box();
          for (tries = 0; tries < 10 && (x == null || crowded(c, x, y)); tries++) { x = R.left - bx.left + R.width * rnd(.1, .9); y = R.top - bx.top + R.height * rnd(.1, .7); }
          if (crowded(c, x, y)) continue; }
        // a glance, not a trek: the slow hand still gets there in about a second
        c.tgt = [x, y]; await aim(c, x, y, g, 60, { noFix: true, slow: rnd(.8, 1) / Math.max(1, c.P.speed) }); await idle(c, rnd(180, 450), g); } }
    async function agent(c, g0, i) {
      await new Promise(r => setTimeout(r, i * rnd(300, 700)));
      c.ep = epoch;
      for (;;) {
        if (g0 !== gen) return;
        const t = { g: g0, e: epoch };
        try {
          if (c.ep !== epoch) { c.ep = epoch; await lookAround(c, t); }
          else { const opts = options(c); let r = Math.random() * opts.reduce((s, [, w]) => s + w, 0), pick = opts[0] && opts[0][0];
            for (const [a, w] of opts) { if ((r -= w) <= 0) { pick = a; break; } }
            if (pick) await pick.run(c, t); else await idle(c, 400, t); }
        } catch (e) { if (e === STOP) return; if (e === CANCEL) S.cancels++; else if (e === ABORT) S.aborts++; else throw e; }
        c.hov.forEach(el => el.classList.remove("gh-hover")); c.hov.clear(); say(c, ""); c.tgt = null;
        await new Promise(r => setTimeout(r, desk() ? rnd(40, 200) : rnd(300, 700)));
      }
    }
    // a view change (yours or a ghost's): every ghost drops its action now and re-plans
    win.addEventListener("lv:view", () => { epoch++; if (!S) return; S.viewSince = performance.now(); S.stay = rnd(7000, 14000); S.changes++;
      ALL.forEach(c => { if (c.seg) { const d = c.seg.done; c.seg = null; d(); } c.hov.forEach(el => el.classList.remove("gh-hover")); c.hov.clear(); });
      $$(".gh-focus", win).forEach(e => e.classList.remove("gh-focus")); });
    const start = () => { if (active || document.hidden || !inView || innerWidth < 760) return; active = true; gen++; const g = gen;
      S = { locks: new Set(), dirty: new Map(), typing: false, log: [], cancels: 0, aborts: 0, changes: 0, staleBlocked: 0, fired: 0, viewSince: performance.now(), stay: rnd(7000, 14000) };
      const b = box(); [[.2, .62], [.55, .9], [.88, .35]].forEach(([fx, fy], i) => { const c = ALL[i]; if (!c.x && !c.y) { c.x = b.width * fx; c.y = b.height * fy; } });
      layer.classList.add("on"); if (!raf) raf = requestAnimationFrame(tick);
      ALL.forEach((c, i) => agent(c, g, i).catch(e => { if (e !== STOP) console.error(e); })); };
    const stop = () => { if (!active) return; active = false; gen++; layer.classList.remove("on");
      ALL.forEach(c => { if (c.seg) { const d = c.seg.done; c.seg = null; d(); } say(c, ""); c.el.classList.remove("down", "click"); c.hov.forEach(el => el.classList.remove("gh-hover")); c.hov.clear(); });
      $$(".gh-focus", win).forEach(e => e.classList.remove("gh-focus"));
      if (S && S.typing && U.focus !== dash.search) { dash.search.value = ""; dash.filter(); } };
    let inView = false;
    new IntersectionObserver(es => { inView = es[0].isIntersecting; if (inView) start(); else stop(); }, {threshold: .3}).observe(wf);
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => innerWidth < 760 ? stop() : start(), 200); });
    window.__lvGhosts = { stop, start, active: () => active,
      peek: () => ALL.map(c => [+c.x.toFixed(2), +c.y.toFixed(2), !!c.seg, c.el.classList.contains("talk") ? c.tag.textContent : "", c.tgt ? c.tgt.map(Math.round) : null]),
      stats: () => ({ cursors: ALL.map(c => ({ ...c.stats, sig: undefined, uniqueMoves: new Set(c.stats.sig.map(String)).size, sampled: c.stats.sig.length })), cancels: S && S.cancels, aborts: S && S.aborts, viewChanges: S && S.changes, staleBlocked: S && S.staleBlocked, ghostClicks: S && S.fired,
        minUserGapAtDisruptiveClickMs: S && S.log.length ? Math.round(Math.min(...S.log)) : null, dirtyLeft: S ? S.dirty.size : 0 }) };
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
