/* LaunchVault site: nav, chart, popovers, filters, checklists, quiz, preview forms, magnetic buttons, Studio cursor.
   Postiz numbers: TrustMRR (Stripe) read Nov 17 2026; earlier points are Claimed (breakdowns/postiz). */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
                  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

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
  addEventListener("keydown", e => { if (e.key === "Escape") $$(".scell.open").forEach(c => { c.classList.remove("open"); c.setAttribute("aria-expanded", "false"); }); });

  // ---------- preview forms: nothing is sent; say so plainly ----------
  $$("form.pv").forEach(f => f.addEventListener("submit", e => {
    e.preventDefault();
    let m = f.nextElementSibling; if (!m || !m.classList.contains("fmsg")) { m = document.createElement("p"); m.className = "fmsg"; m.setAttribute("role", "status"); f.after(m); }
    m.textContent = "Sign-ups open soon. This is a preview."; m.classList.add("on");
  }));
  const pn = $("#plannote"); if (pn && new URLSearchParams(location.search).get("plan") === "full") pn.hidden = false;
  // "send this to a parent": the link points at this site, wherever it's hosted
  $$("a.parentmail").forEach(a => { const url = location.origin + "/pricing/";
    a.href = "mailto:?subject=" + encodeURIComponent("LaunchVault") + "&body=" + encodeURIComponent("Can you look at this? It's $5 a month, cancel anytime, and payments go through Stripe: " + url); });

  // ---------- Postiz chart (hero window + breakdown page) ----------
  const svg = $("#chart");
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
    const plot = $("#plot"), tip = $("#tip"), movesEl = $("#moves"), big = plot.dataset.size === "big";
    let G = null;
    movesEl.innerHTML = EVT.map((e, i) => `<li><button type="button" class="mv${i === TURN ? " turn" : ""}" data-i="${i}"><span class="n">${i + 1}</span><span><b>${e[2]}</b><small>${e[3]}</small></span><span class="w">${e[1]}</span></button></li>`).join("");
    function draw() {
      const W = Math.max(260, plot.clientWidth - 12), narrow = W < 520, H = narrow ? 230 : big ? 320 : 262;
      const L = 46, R = 14, T = 12, B = 50, TAG = narrow ? 14 : 16;
      const X = m => L + m / 34 * (W - L - R), Y = v => T + (1 - v / 450000) * (H - T - B);
      svg.innerHTML = ""; svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H);
      const defs = el("defs", {}, svg), gr = el("linearGradient", {id: "ga", x1: 0, x2: 0, y1: 0, y2: 1}, defs);
      el("stop", {offset: 0, "stop-color": "#2563EB", "stop-opacity": .14}, gr); el("stop", {offset: 1, "stop-color": "#2563EB", "stop-opacity": 0}, gr);
      [0, 100000, 200000, 300000, 400000].forEach(v => {
        el("line", {x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: "#EEF0F3"}, svg);
        el("text", {x: L - 8, y: Y(v) + 4, "text-anchor": "end"}, svg).textContent = v === 0 ? "$0" : "$" + v / 1000 + "k";
      });
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
      const tags = EVT.map((e, i) => {           // decorative mirror of the list (the list is the accessible control)
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
    function showDefault() { showPoint(P[P.length - 1]); }
    movesEl.addEventListener("pointerover", ev => { const b = ev.target.closest(".mv"); if (b) showEvent(+b.dataset.i); });
    movesEl.addEventListener("pointerleave", showDefault);
    movesEl.addEventListener("click", ev => { const b = ev.target.closest(".mv"); if (b) showEvent(+b.dataset.i); });
    movesEl.addEventListener("focusin", ev => { const b = ev.target.closest(".mv"); if (b) showEvent(+b.dataset.i); });
    draw();
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 80); });
  }

  // ---------- sources popovers: hover on desktop, tap to toggle ----------
  $$(".scell").forEach(c => c.addEventListener("click", e => { e.stopPropagation(); const o = !c.classList.contains("open");
    $$(".scell").forEach(x => { x.classList.remove("open"); x.setAttribute("aria-expanded", "false"); }); c.classList.toggle("open", o); c.setAttribute("aria-expanded", o); }));
  document.addEventListener("click", () => $$(".scell.open").forEach(x => { x.classList.remove("open"); x.setAttribute("aria-expanded", "false"); }));

  // ---------- story filters (homepage + library); ?f=saas preselects on the library ----------
  $$(".filters").forEach(g => {
    const chips = [...g.querySelectorAll(".chip")], tbl = g.nextElementSibling, rows = tbl ? [...tbl.querySelectorAll(".tr[data-cat]")] : [], empty = tbl && tbl.querySelector(".empty");
    const apply = c => { chips.forEach(x => x.setAttribute("aria-pressed", x === c)); const f = c.dataset.f || "all"; let n = 0;
      rows.forEach(r => { const on = f === "all" || r.dataset.cat.split(" ").includes(f); r.hidden = !on; if (on) n++; });
      if (empty) empty.classList.toggle("on", n === 0); };
    chips.forEach(c => c.addEventListener("click", () => apply(c)));
    const q = new URLSearchParams(location.search).get("f"), pre = q && chips.find(c => c.dataset.f === q);
    if (pre && g.dataset.url === "1") apply(pre);
  });

  // ---------- tabs, checklists (remembered on the breakdown page), billing ----------
  $$(".parts").forEach(g => g.querySelectorAll(".part").forEach(c => c.addEventListener("click", () => g.querySelectorAll(".part").forEach(x => x.setAttribute("aria-selected", x === c)))));
  $$(".ckl").forEach(box => {
    const cks = [...box.querySelectorAll(".ck")], prog = box.querySelector(".prog"), key = box.dataset.store;
    const saved = key && store.get(key);
    if (saved) cks.forEach((c, i) => c.setAttribute("aria-pressed", !!saved[i]));
    const upd = () => { if (prog) prog.textContent = cks.filter(x => x.getAttribute("aria-pressed") === "true").length + " of " + cks.length + (box.dataset.word === "done" ? " done" : " ticked");
      if (key) store.set(key, cks.map(x => x.getAttribute("aria-pressed") === "true")); };
    cks.forEach(c => c.addEventListener("click", () => { c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") !== "true"); upd(); }));
    if (saved) upd();
  });
  $$("[data-b]").forEach(b => b.addEventListener("click", () => {
    $$("[data-b]").forEach(x => x.setAttribute("aria-pressed", x === b));
    const y = b.dataset.b === "y";
    $("#fullpr").innerHTML = (y ? "$4" : "$5") + "<small>/month</small>";
    $("#fullsub").textContent = y ? "$48 billed once a year. Cancel anytime." : "Billed monthly. Cancel anytime."; }));
  $$(".tr.has-read").forEach(r => r.addEventListener("click", e => { if (!e.target.closest("a")) { const a = r.querySelector("a.read"); if (a) location.href = a.href; } }));

  // ---------- quiz: three stories in order; only Postiz has a breakdown so far ----------
  const opts = $$("#opts .opt");
  if (opts.length) {
    const PATHS = {
      "Nothing, just my time": [["Postiz", "Give a free version away and post every update."], ["Stencil AI", "No audience needed. Start with one real problem."], ["Gojiberry", "Ask for payment early. A waitlist isn't revenue."]],
      "Under $100": [["Stencil AI", "Start with a problem someone close to you has."], ["Postiz", "Post where your users already are, every time you ship."], ["Windmill Growth", "Offer a service you can do now, like running a local shop's Instagram."]],
      "A few hundred dollars": [["Windmill Growth", "Started with $250, he says. A service earns before an app would."], ["Postiz", "Spent about $12,000 on SEO for a new site and got little traffic. Skip it."], ["DM Champ", "A cheap AppSumo deal brought testers, not buyers. Price for real buyers."]]
    };
    const ARW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    const href = n => n === "Postiz" ? "/breakdowns/postiz/" : "/breakdowns/";
    const showPath = a => { $("#pathfor").textContent = a;
      $("#pathlist").innerHTML = PATHS[a].map((p, i) => `<li><a href="${href(p[0])}"><span class="pn2">${i + 1}</span><span><b>${p[0]}</b><small>${p[1]}${p[0] === "Postiz" ? "" : " Breakdown coming soon."}</small></span>${ARW}</a></li>`).join(""); };
    opts.forEach(o => o.addEventListener("click", () => { opts.forEach(x => x.setAttribute("aria-pressed", x === o)); showPath(o.textContent.trim()); }));
    showPath("Under $100");
  }

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
    document.documentElement.addEventListener("pointerleave", () => { mx = my = -999; kick(); });
  }

  // ---------- Studio cursor: dot on the pointer, ring follows (lerp .2); "Read" bubble on rows/posts; dims on dark; mouse/trackpad only ----------
  if (!reduce) {
    const LABELS = [[".tr.has-read, .post, .feat, .ncard.live", "Read"]];
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
      const t = e.target, txt = t.closest("input, textarea, select"), l = txt ? "" : labelFor(t),
            hov = !txt && !l && t.closest("a, button, summary, label, [role=button], [role=tab]");
      H.classList.toggle("cur-text", !!txt); H.classList.toggle("cur-lbl", !!l); H.classList.toggle("cur-dark", !!t.closest(".dk, footer, .plan.full"));
      ring.classList.toggle("lbl", !!l); ring.classList.toggle("hov", !!hov); if (l) lab.textContent = l;
    }, {passive: true});
    addEventListener("pointerdown", e => { if (e.pointerType === "mouse") ring.classList.add("down"); }, {passive: true});
    addEventListener("pointerup", () => ring.classList.remove("down"), {passive: true});
    H.addEventListener("pointerleave", () => H.classList.remove("cur-show"));
  }
})();
