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
      const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); if (dash) dash.userView = e.isTrusted && g.dataset.go !== "postiz"; show(g.dataset.go, g.dataset.co); return; }
      const k = e.target.closest(".kpi"); if (k) { const on = k.getAttribute("aria-pressed") !== "true"; k.setAttribute("aria-pressed", on); k.dataset.u = e.isTrusted && on ? "1" : ""; return; }
      if (e.target.closest("#srcbtn")) { const o = !drawer.classList.contains("open"); if (dash) dash.userDrawer = e.isTrusted && o; setDrawer(o, e.isTrusted); return; }
      if (e.target.closest(".sd-x")) { if (dash) dash.userDrawer = false; setDrawer(false, e.isTrusted); }
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
  // Human motion: Fitts-timed aimed moves on lopsided arcs with a skewed speed profile, over/undershoot + 1-2 corrections,
  // smoothed hand tremor, idle drift, hesitation, changes of mind. They share the dashboard with the real user:
  // never pause for you, never touch what you're using, and never switch the view while you're active.
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
      layer.append(el); return { el, tag: el.querySelector(".gt"), x: 0, y: 0, seg: null, P, hov: new Set(),
        tr: { a: rnd(.6, 1.3), f1: rnd(3.5, 7), f2: rnd(9, 14), p1: rnd(0, 6.3), p2: rnd(0, 6.3) }, stats: { moves: 0, corrections: 0, overshoots: 0, changes: 0, skips: 0, typos: 0, sig: [] } }; };
    const ALL = [mk("r", "#E5484D", PERS[0]), mk("g", "#10B981", PERS[1]), mk("b", "#2563EB", PERS[2])];
    const STOP = {}, CANCEL = {}; let gen = 0, active = false, raf = 0, S = null;
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
    const ok = g => { if (g !== gen) throw STOP; };
    const wait = (ms, g) => new Promise((res, rej) => setTimeout(() => g === gen ? res() : rej(STOP), ms));
    const seg = (c, to, d, o = {}) => new Promise(res => { if (c.seg) { const p = c.seg.done; c.seg = null; p(); }
      c.seg = { a: [c.x, c.y], b: to, c: o.c || [(c.x + to[0]) / 2, (c.y + to[1]) / 2], t0: performance.now(), d: Math.max(16, d), ka: o.ka || 1.5, kb: o.kb || 2.4, pz: o.pz || null, on: o.on || null, done: res }; });
    // an aimed move: ballistic arc to just past/short of the target, then small corrections onto it
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
    const vis = el => !!el && el.getClientRects().length > 0 && !el.closest("[hidden], .under, [inert]") && el.getBoundingClientRect().width > 0;
    // slow idle drift while "reading": never frozen, never fast
    async function idle(c, ms, g) { const end = performance.now() + ms * c.P.dwell;
      while (end - performance.now() > 40) { const r = c.P.drift; await seg(c, [c.x + rnd(-r, r), c.y + rnd(-r * .7, r * .7)], Math.min(end - performance.now(), rnd(500, 1300)), { ka: rnd(1.3, 1.8), kb: rnd(1.6, 2.4) }); ok(g); } }
    const DECOYS = () => qa(".kpi, .side .si, .mv, .dtabs button, .phead, .vrow, .ck, .vsrc li, .sd-l li, .mtop .btn");
    async function go(c, el, g, fx = rnd(.3, .7), fy = rnd(.38, .66)) {
      if (chance(c.P.mind)) { const d = any(DECOYS().filter(x => x !== el)); if (d) { c.stats.changes++; const [x, y] = at(d, .5, .5), k = rnd(.35, .7);
        await aim(c, c.x + (x - c.x) * k, c.y + (y - c.y) * k, g, 40, { noFix: true }); await wait(rnd(120, 380), g); } }
      if (!vis(el)) throw CANCEL; let [x, y, w] = at(el, fx, fy);
      for (let t = 0; t < 6 && crowded(c, x, y); t++) [x, y, w] = at(el, rnd(.12, .88), rnd(.25, .8));
      if (crowded(c, x, y)) throw CANCEL; c.tgt = [x, y]; await aim(c, x, y, g, w); }
    const crowded = (c, x, y) => ALL.some(o => o !== c && (Math.hypot(o.x - x, o.y - y) < 26 || (o.tgt && Math.hypot(o.tgt[0] - x, o.tgt[1] - y) < 26)));
    const say = (c, t) => { if (t) c.tag.textContent = t; c.el.classList.toggle("talk", !!t); };
    const hov = (c, el, on) => { if (!el) return; if (on && userOwns(el)) return; el.classList.toggle("gh-hover", on); if (on) c.hov.add(el); else c.hov.delete(el); };
    const fire = (el, type) => el.dispatchEvent(type === "click" ? new MouseEvent("click", {bubbles: true, cancelable: true}) : new PointerEvent(type, {bubbles: true, pointerType: "mouse"}));
    // a human click: hesitate, maybe decide not to, ~90 ms press with a 1-2 px drift, ripple
    async function click(c, el, g, o = {}) {
      if (userOwns(el)) throw CANCEL;
      await idle(c, o.must ? rnd(90, 200) : rnd(c.P.hes[0], c.P.hes[1]), g);
      if (!o.must && chance(c.P.skip)) { c.stats.skips++; return false; }
      if (userOwns(el) || (o.disrupt && (userBusy(1500) || (dash.userView && st().view !== "postiz") || (dash.userDrawer && st().drawer)))) throw CANCEL;
      c.el.classList.add("down"); c.el.classList.remove("click"); void c.el.offsetWidth; c.el.classList.add("click");
      await seg(c, [c.x + rnd(-1.6, 1.6), c.y + rnd(-.6, 1.8)], rnd(80, 105), { ka: 1.2, kb: 1.6 }); ok(g);
      c.el.classList.remove("down"); fire(el, "click"); S.log.push([performance.now() - U.last, !!o.disrupt]); if (S.log.length > 200) S.log.shift();
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
    const desk = () => innerWidth > 1100, st = () => dash.state();

    // --- the real user: whatever you hover or focus is yours; while you're active, nobody changes your view
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
    const canDisrupt = () => !userBusy(3000);
    const mayUndoUser = () => !U.inside && !U.focus && !userBusy(3000);
    const drawerRect = () => { const d = $("#sdrawer"); return d && d.classList.contains("open") ? d.getBoundingClientRect() : null; };
    const clear = el => { const d = drawerRect(); return !d || el.getBoundingClientRect().right < d.left - 4; };
    const free = k => !S.locks.has(k) && !(k instanceof Element && userOwns(k));
    const chartFree = () => free("chart") && !userIn("#plot, #moves, .dtabs, .ch-h") && !(chartAPI && chartAPI.userPinned());
    const userKpi = k => k.dataset.u === "1";
    const chartRest = () => { if (!chartAPI) return; if (chartAPI.userPinned()) chartAPI.idle(); else chartAPI.reset(); };
    const label = el => (el.lastChild && el.lastChild.nodeType === 3 ? el.lastChild.textContent : el.textContent).trim();
    const onPostiz = () => { const s = st(); return s.view === "postiz" && (!s.drawer || dash.userDrawer); };
    const readerOK = () => !S.scene && !S.want && onPostiz();
    async function reader(c, g, keys, fn) { const s = S; if (keys.some(k => s.locks.has(k))) return; keys.forEach(k => s.locks.add(k)); s.readers++;
      try { await fn(); } finally { s.readers--; keys.forEach(k => s.locks.delete(k)); } }
    async function scene(c, g, pre, fn) { const s = S; s.want = c; const mine = [pre, side("postiz")].filter(k => k && !s.locks.has(k)); mine.forEach(k => s.locks.add(k));
      try { if (pre && vis(pre)) await go(c, pre, g); const t0 = performance.now(); while (s.readers > 0 && performance.now() - t0 < 4500) await idle(c, 260, g);
        if (!canDisrupt()) throw CANCEL; s.scene = c; s.want = null; await fn(); }
      finally { if (s.want === c) s.want = null; if (s.scene === c) s.scene = null; mine.forEach(k => s.locks.delete(k)); } }
    async function backToPostiz(c, g) { if (st().view === "postiz") return;
      const el = vis(side("postiz")) ? side("postiz") : qa('.view.vx:not([hidden]) [data-go="postiz"]')[0];
      if (el) { say(c, "Back to Postiz"); await go(c, el, g); hov(c, el, true); await click(c, el, g, {must: true, disrupt: true}); hov(c, el, false); } else dash.show("postiz"); }
    const PTS = () => { const out = []; if (!chartAPI) return out; const b = box(), d = drawerRect();
      for (let k = 0; k < chartAPI.count; k++) { const p = chartAPI.point(k); if (p && (!d || p[0] < d.left - 6)) out.push([k, p[0] - b.left, p[1] - b.top]); } return out; };

    const ACTIONS = [
      // KPI: hover, maybe click to see its source, then put it back
      { w: 6, can: () => readerOK() && $$(".kpi", win).some((k, i) => free("kpi" + i) && free(k) && vis(k) && clear(k) && !userKpi(k)), run: async (c, g) => {
          const ks = $$(".kpi", win), i = any(ks.map((k, j) => j).filter(j => free("kpi" + j) && free(ks[j]) && vis(ks[j]) && clear(ks[j]) && !userKpi(ks[j]))), k = ks[i];
          const L = ["Checking MRR's source", "Checking all-time revenue", "Checking subscriptions", "Checking the GitHub stars"];
          await reader(c, g, ["kpi" + i], async () => { say(c, L[i]); await go(c, k, g); hov(c, k, true);
            if (await click(c, k, g)) { await idle(c, rnd(800, 1600), g); if (k.getAttribute("aria-pressed") === "true" && !userKpi(k)) await click(c, k, g, {must: true}); }
            else await idle(c, rnd(300, 700), g); hov(c, k, false); }); } },
      // chart: scrub along it at an uneven pace, sometimes backing up; the tooltip follows exactly like a real pointer
      { w: 5, can: () => readerOK() && chartFree() && PTS().length > 2, run: async (c, g) => {
          await reader(c, g, ["chart"], async () => { const pts = PTS(), n = Math.min(pts.length, Math.round(rnd(3, 6))), s0 = Math.floor(rnd(0, pts.length - n + 1));
            let cur = -1; const follow = cc => { const b = box(); let best = null, bd = 1e9; for (const p of pts) { const d = Math.abs(p[1] - cc.x); if (d < bd) { bd = d; best = p; } } if (best && best[0] !== cur) { cur = best[0]; chartAPI.show(cur); } };
            say(c, "Scrubbing the chart"); await aim(c, pts[s0][1], pts[s0][2], g, 14, { on: follow });
            for (let j = 1; j < n; j++) { if (!chartFree()) break; const p = pts[s0 + j];
              await seg(c, [p[1] + rnd(-6, 6), p[2] + rnd(-10, 8)], rnd(220, 720) * c.P.speed, { ka: rnd(1.2, 1.8), kb: rnd(1.6, 2.8), on: follow }); ok(g);
              await idle(c, rnd(120, 650), g);
              if (chance(.2) && j > 1) { const q = pts[s0 + j - 1]; await seg(c, [q[1] + rnd(-4, 4), q[2]], rnd(200, 420), { ka: 1.4, kb: 2, on: follow }); ok(g); await idle(c, rnd(150, 400), g); } }
            chartRest(); }); } },
      // move tags: click one or two, the list highlights and scrolls
      { w: 4, can: () => readerOK() && chartFree() && !!chartAPI && [0, 1, 2, 3, 4, 5, 6, 7].some(i => vis(chartAPI.tag(i)) && clear(chartAPI.tag(i))), run: async (c, g) => {
          await reader(c, g, ["chart"], async () => { const ids = [0, 1, 2, 3, 4, 5, 6, 7].filter(i => vis(chartAPI.tag(i)) && clear(chartAPI.tag(i)));
            for (let r = 0, n = chance(.45) ? 2 : 1; r < n; r++) { if (!chartFree()) break; const i = any(ids), t = chartAPI.tag(i); say(c, "Reading move " + (i + 1));
              await go(c, t, g, .5, .5); if (await click(c, t, g)) await idle(c, rnd(900, 1500), g); }
            chartRest(); }); } },
      // the moves list, top to bottom, with pauses
      { w: 3, can: () => readerOK() && chartFree() && qa("#moves .mv").filter(clear).length > 0, run: async (c, g) => {
          await reader(c, g, ["chart"], async () => { const mv = $("#moves"), o = mv.getBoundingClientRect();
            const rows = qa("#moves .mv").filter(b => { const r = b.getBoundingClientRect(); return r.top >= o.top - 1 && r.bottom <= o.bottom + 2 && clear(b); });
            const s0 = Math.floor(rnd(0, Math.max(1, rows.length - 3))), n = Math.min(rows.length - s0, Math.round(rnd(3, 5)));
            for (let j = 0; j < n; j++) { const b = rows[s0 + j]; if (!chartFree()) break; say(c, "Reading move " + (+b.dataset.i + 1));
              await go(c, b, g, rnd(.2, .55), rnd(.35, .6)); hov(c, b, true); fire(b, "pointerover"); await idle(c, rnd(500, 1200), g); hov(c, b, false); }
            fire(mv, "pointerleave"); chartRest(); }); } },
      // time tabs: changes what everyone sees, so only while you're idle
      { w: 3, can: () => readerOK() && chartFree() && canDisrupt() && desk() && vis(q1("[data-range]")) && !(dash.userRange && !mayUndoUser()), run: async (c, g) => {
          await reader(c, g, ["chart"], async () => { const t = q1('[data-range][aria-selected="false"]'); say(c, t.dataset.range === "12" ? "Comparing 12 months" : "Back to all time");
            await go(c, t, g); hov(c, t, true); if (await click(c, t, g, {disrupt: true})) await idle(c, rnd(1100, 1800), g); hov(c, t, false); }); } },
      // hover, never press: Open breakdown and Go Pro
      { w: 2, can: () => readerOK() && free("open") && vis(q1(".mtop .btn-p")) && free(q1(".mtop .btn-p")) && clear(q1(".mtop .btn-p")), run: async (c, g) => {
          await reader(c, g, ["open"], async () => { const b = q1(".mtop .btn-p"); say(c, "Eyeing the full breakdown"); await go(c, b, g); hov(c, b, true); await idle(c, rnd(500, 1000), g); hov(c, b, false); }); } },
      { w: 2, can: () => desk() && free("gopro") && free(q1(".splan a")), run: async (c, g) => { const s = S; s.locks.add("gopro");
          try { const a = q1(".splan a"); say(c, "Looking at Go Pro"); await go(c, a, g); hov(c, a, true); await idle(c, rnd(500, 900), g); hov(c, a, false); } finally { s.locks.delete("gopro"); } } },
      // browsing the sidebar without clicking (always possible, so nobody stands still)
      { w: 1.5, can: () => !S.scene, run: async (c, g) => { const s = S, items = (desk() ? qa(".side .si") : qa(".kpi, .ch-h .legend span, .phead")).filter(free).filter(clear);
          const el = any(items); if (!el) { await idle(c, 500, g); return; } s.locks.add(el);
          try { say(c, desk() ? "Browsing" : "Looking around"); await go(c, el, g); hov(c, el, true); await idle(c, rnd(350, 800), g); hov(c, el, false);
            if (chance(c.P.wander)) { const el2 = any(items.filter(x => x !== el && free(x))); if (el2) { s.locks.delete(el); s.locks.add(el2); await go(c, el2, g); await idle(c, rnd(250, 600), g); s.locks.delete(el2); } } }
          finally { s.locks.delete(el); } } },
      // guests: inside a view someone else opened (another cursor, or you), look around; only click inside ghost-opened views
      { w: 6, can: c => (!!S.scene && S.scene !== c) || (st().view !== "postiz" && dash.userView && !S.scene) || (st().drawer && dash.userDrawer), run: async (c, g) => { const s = S; let held = null;
          try { const dr = st().drawer, mine = !(dash.userView || (dr && dash.userDrawer));
            const pool = () => (dr ? qa(".sd-l li") : qa(".view.vx:not([hidden]) .vrow, .view.vx:not([hidden]) .hcard, .view.vx:not([hidden]) .ck, .view.vx:not([hidden]) .vsrc li")).filter(free);
            for (let r = 0, n = Math.round(rnd(2, 4)); r < n && S === s; r++) { const el = any(pool()); if (!el) { await idle(c, 400, g); break; } held = el; s.locks.add(el);
              say(c, dr ? "Reading a source" : el.classList.contains("ck") && mine ? "Ticking a step" : "Skimming the list"); await go(c, el, g); hov(c, el, true);
              if (el.classList.contains("ck") && mine && !dash.userView) { if (await click(c, el, g)) { await idle(c, rnd(400, 800), g); await click(c, el, g, {must: true}); } } else await idle(c, rnd(400, 900), g);
              hov(c, el, false); s.locks.delete(el); held = null; } }
          finally { if (held) s.locks.delete(held); } } },
      // scenes (one at a time, only while you're idle): open a sidebar view and browse it
      { w: 3, can: () => desk() && !S.scene && !S.want && canDisrupt() && st().view === "postiz" && !st().drawer, run: async (c, g) => { const v = any(["home", "breakdowns", "checklists", "sources"]), el = side(v);
          await scene(c, g, el, async () => { const N = {home: "Home", breakdowns: "Breakdowns", checklists: "My checklists", sources: "Sources"};
            say(c, "Opening " + N[v]); hov(c, el, true); const did = await click(c, el, g, {disrupt: true}); hov(c, el, false); if (!did) return;
            await idle(c, rnd(500, 900), g);
            const pick = any(qa(".view.vx:not([hidden]) .vrow, .view.vx:not([hidden]) .hcard, .view.vx:not([hidden]) .ck, .view.vx:not([hidden]) .vsrc li").filter(free));
            if (pick) { S.locks.add(pick); try { say(c, pick.matches(".vrow, .hcard") ? "Opening a breakdown" : pick.classList.contains("ck") ? "Ticking a step" : "Reading the sources"); await go(c, pick, g); hov(c, pick, true);
              if (pick.matches(".vrow, .hcard")) { if (await click(c, pick, g, {disrupt: true})) await idle(c, rnd(700, 1200), g); }
              else if (pick.classList.contains("ck")) { if (await click(c, pick, g)) { await idle(c, rnd(500, 900), g); await click(c, pick, g, {must: true}); } }
              else await idle(c, rnd(500, 900), g); hov(c, pick, false); } finally { S.locks.delete(pick); } }
            await backToPostiz(c, g); }); } },
      { w: 3, can: () => !S.scene && !S.want && canDisrupt() && onPostiz() && !st().drawer && vis($("#srcbtn")) && free($("#srcbtn")), run: async (c, g) => { const b = $("#srcbtn");
          await scene(c, g, b, async () => { say(c, "Opening the sources"); hov(c, b, true); const did = await click(c, b, g, {disrupt: true}); hov(c, b, false); if (!did) return;
            await idle(c, rnd(500, 800), g);
            const rows = qa(".sd-l li"), s0 = Math.floor(rnd(0, 3));
            for (let r = 0, n = Math.round(rnd(2, 3)); r < n; r++) { const li = rows[s0 + r]; if (!li || !free(li)) continue; say(c, "Checking " + li.querySelector(".sr-n").textContent.trim()); await go(c, li, g, rnd(.15, .5), .5); hov(c, li, true); await idle(c, rnd(450, 900), g); hov(c, li, false); }
            if (dash.userDrawer) return;
            const x = q1(".sd-x"); say(c, "Closing the sources"); await go(c, x, g, .5, .5); hov(c, x, true); await click(c, x, g, {must: true, disrupt: true}); hov(c, x, false); }); } },
      { w: 2.5, can: () => desk() && !S.scene && !S.want && canDisrupt() && st().view === "postiz" && !st().drawer && vis(dash.search) && !dash.search.value && U.focus !== dash.search, run: async (c, g) => { const inp = dash.search, lab = inp.closest(".search");
          await scene(c, g, inp, async () => { const word = any(["goji", "dm", "sten", "wind", "post", "champ"]); say(c, "Searching");
            try { if (!(await click(c, inp, g, {disrupt: true}))) return; lab.classList.add("gh-focus"); await type(c, inp, word, g);
              await idle(c, rnd(300, 700), g); const hit = qa(".side .si")[0]; lab.classList.remove("gh-focus");
              if (hit && !userBusy(1500)) { say(c, "Opening " + label(hit)); await go(c, hit, g); hov(c, hit, true); if (await click(c, hit, g, {disrupt: true})) await idle(c, rnd(700, 1100), g); hov(c, hit, false); }
              say(c, "Clearing the search"); await go(c, inp, g); lab.classList.add("gh-focus");
              while (inp.value) { if (U.focus === inp) break; inp.value = inp.value.slice(0, -1); dash.filter(); await wait(rnd(60, 110), g); } }
            finally { lab.classList.remove("gh-focus"); S.typing = false; if (U.focus !== inp && !dash.userQ && inp.value) { inp.value = ""; dash.filter(); } }
            await backToPostiz(c, g); }); } },
      { w: 2.5, can: () => desk() && !S.scene && !S.want && canDisrupt() && st().view === "postiz" && !st().drawer, run: async (c, g) => { const el = any(qa('.side .si[data-go="soon"]').filter(free)); if (!el) return;
          await scene(c, g, el, async () => { say(c, "Opening " + label(el)); hov(c, el, true); const did = await click(c, el, g, {disrupt: true}); hov(c, el, false); if (!did) return;
            await idle(c, rnd(900, 1500), g);
            const back = q1('.view[data-view="soon"] [data-go="postiz"]');
            if (back && vis(back)) { say(c, "Back to Postiz"); await go(c, back, g); hov(c, back, true); await click(c, back, g, {must: true, disrupt: true}); hov(c, back, false); } else await backToPostiz(c, g); }); } },
      // soft reset: puts back anything a ghost left open; your own changes only once you've left the window and been idle
      { w: 0, can: () => { if (S.scene || S.want || !canDisrupt()) return false; const s = st();
          const ghostMess = (s.view !== "postiz" && !dash.userView) || (s.drawer && !dash.userDrawer) || (s.q && !dash.userQ && U.focus !== dash.search);
          const userMess = (s.view !== "postiz" && dash.userView) || (s.drawer && dash.userDrawer) || (s.q && dash.userQ);
          return ghostMess ? 40 : userMess && mayUndoUser() && performance.now() - U.last > 8000 ? 20 : performance.now() - S.lastReset > 40000 ? 6 : false; },
        run: async (c, g) => { await scene(c, g, null, async () => { const s = st();
          if (s.drawer) { const x = q1(".sd-x"); say(c, "Closing the sources"); await go(c, x, g, .5, .5); await click(c, x, g, {must: true, disrupt: true}); dash.userDrawer = false; }
          if (s.q && U.focus !== dash.search) { dash.search.value = ""; dash.filter(); dash.userQ = false; }
          await backToPostiz(c, g); dash.userView = false;
          for (const k of $$(".kpi[aria-pressed=true]", win)) { if (userOwns(k) || (userKpi(k) && !mayUndoUser())) continue; k.dataset.u = ""; say(c, "Tidying up"); await go(c, k, g); await click(c, k, g, {must: true}); }
          if (desk() && st().range && free("chart") && !userIn("#plot, #moves, .dtabs") && (!dash.userRange || mayUndoUser())) { dash.userRange = false; const t = q1('[data-range="all"]'); say(c, "Back to all time"); await go(c, t, g); await click(c, t, g, {must: true, disrupt: true}); }
          if (chartAPI && free("chart") && !userIn("#plot, #moves") && (!chartAPI.userPinned() || mayUndoUser())) chartAPI.reset(); S.lastReset = performance.now(); }); } },
    ];
    async function agent(c, g, i) {
      await wait(i * rnd(300, 700), g);
      for (;;) {
        const opts = ACTIONS.map(a => [a, a.can(c)]).filter(([, w]) => w).map(([a, w]) => [a, typeof w === "number" ? w : a.w]);
        let r = Math.random() * opts.reduce((t, [, w]) => t + w, 0), pick = opts[0][0];
        for (const [a, w] of opts) { if ((r -= w) <= 0) { pick = a; break; } }
        try { await pick.run(c, g); } catch (e) { if (e !== CANCEL) throw e; S.cancels++; }
        ok(g); c.hov.forEach(el => el.classList.remove("gh-hover")); c.hov.clear(); say(c, "");
        await wait(desk() ? rnd(40, 220) : rnd(300, 700), g);
      }
    }
    const start = () => { if (active || document.hidden || !inView || innerWidth < 760) return; active = true; gen++; const g = gen;
      S = { readers: 0, scene: null, want: null, locks: new Set(), lastReset: performance.now(), typing: false, log: [], cancels: 0 };
      const b = box(); [[.2, .62], [.55, .9], [.88, .35]].forEach(([fx, fy], i) => { const c = ALL[i]; if (!c.x && !c.y) { c.x = b.width * fx; c.y = b.height * fy; } });
      layer.classList.add("on"); if (!raf) raf = requestAnimationFrame(tick);
      ALL.forEach((c, i) => agent(c, g, i).catch(e => { if (e !== STOP) console.error(e); })); };
    const stop = () => { if (!active) return; active = false; gen++; layer.classList.remove("on");
      ALL.forEach(c => { if (c.seg) { const d = c.seg.done; c.seg = null; d(); } say(c, ""); c.el.classList.remove("down", "click"); c.hov.forEach(el => el.classList.remove("gh-hover")); c.hov.clear(); });
      $$(".gh-focus", win).forEach(e => e.classList.remove("gh-focus"));
      if (S && S.typing && U.focus !== dash.search) { dash.search.value = ""; dash.filter(); } };
    // they keep going while you use the dashboard; they only stop for reduced motion, phones, an off-screen hero or a hidden tab
    let inView = false;
    new IntersectionObserver(es => { inView = es[0].isIntersecting; if (inView) start(); else stop(); }, {threshold: .3}).observe(wf);
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => innerWidth < 760 ? stop() : start(), 200); });
    window.__lvGhosts = { stop, start, active: () => active,
      peek: () => ALL.map(c => [+c.x.toFixed(2), +c.y.toFixed(2), !!c.seg, c.el.classList.contains("talk") ? c.tag.textContent : ""]),
      stats: () => ({ cursors: ALL.map(c => ({ ...c.stats, sig: undefined, uniqueMoves: new Set(c.stats.sig.map(String)).size, sampled: c.stats.sig.length })), cancels: S && S.cancels,
        minUserGapAtDisruptiveClickMs: S ? Math.round(Math.min(...S.log.filter(l => l[1]).map(l => l[0]), 1e9)) : null }) };
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
