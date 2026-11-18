/* LaunchVault homepage (Coder C): the "Find stories like you" quiz (it reorders the story cards), the "Inside a breakdown" tabs,
   the phone hero's "See all 8 moves" and the "Compare plans" toggle.
   Loaded on every page after site.js; each block does nothing when its section isn't on the page. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
                  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const OUT = "cubic-bezier(.16,1,.3,1)";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const ARW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  // ---------- quiz: optional questions, live path, back / skip / start over, animated result; answers stay on this device ----------
  const qbody = $("#qbody"), qcard = $("#qcard");
  if (qbody && qcard) {
    // Each story links to the post that covers it.
    const POSTS = {post: ["/blog/postiz/", "The Postiz breakdown"], small: ["/blog/three-ways-to-start-small/", "Three ways to start small"],
                   ver: ["/blog/what-verified-means/", "What 'Verified' means"]};
    const ST = {
      "Postiz": {p: "post", why: "Give a free version away and post every update."},
      "Stencil AI": {p: "small", why: "Start with a problem someone close to you has."},
      "Windmill Growth": {p: "small", why: "Sell a service you can do now, before building an app."},
      "Gojiberry": {p: "ver", why: "Ask for money early. A waitlist isn't revenue."},
      "DM Champ": {p: "ver", why: "Price for the people who will stay, not for testers."}
    };
    const BASE = {"Postiz": .3, "Stencil AI": .2, "Windmill Growth": .1, "Gojiberry": 0, "DM Champ": 0};
    const Q = [
      ["How much time could you give this most weeks?", [["A few hours", {"Stencil AI": 2, "Postiz": 1, "Gojiberry": 1}], ["Most weekends", {"Windmill Growth": 2, "Postiz": 1}], ["Most evenings", {"Postiz": 2, "DM Champ": 1, "Gojiberry": 1}]]],
      ["What could you spend to get started?", [["Nothing, just my time", {"Postiz": 2, "Stencil AI": 2}], ["Under $100", {"Stencil AI": 2, "Windmill Growth": 1, "Gojiberry": 1}], ["A few hundred dollars", {"Windmill Growth": 2, "DM Champ": 2}]]],
      ["What are you already good at, even a little?", [["Coding or tinkering with apps", {"Postiz": 2, "Stencil AI": 1, "DM Champ": 1}], ["Design, video or writing", {"Postiz": 1, "Windmill Growth": 2}], ["Talking to people", {"Windmill Growth": 2, "Gojiberry": 2}], ["Not sure yet, and that's fine", {"Stencil AI": 2, "Gojiberry": 1}]]],
      ["Who around you has a problem worth fixing?", [["Someone in my family", {"Stencil AI": 3}], ["A local shop or business", {"Windmill Growth": 3}], ["People in an online group I'm in", {"Postiz": 2, "DM Champ": 1}], ["No one comes to mind yet", {"Gojiberry": 2, "Postiz": 1}]]],
      ["Which of these sounds most like fun?", [["Building an app people use", {"Postiz": 2, "Stencil AI": 2}], ["Doing a job for real clients", {"Windmill Growth": 3}], ["Testing an idea fast and changing it", {"Gojiberry": 2, "DM Champ": 2}]]]
    ];
    const saved = store.get("lv-quiz");
    const ans = Array.isArray(saved) && saved.length === Q.length ? saved.map(a => Number.isInteger(a) ? a : null) : Array(Q.length).fill(null);
    let step = Math.min(Math.max(+store.get("lv-quiz-step") || 0, 0), Q.length);
    const save = () => { store.set("lv-quiz", ans); store.set("lv-quiz-step", step); };
    const answered = () => ans.filter(a => a != null).length;
    const rank = () => {
      const sc = {...BASE}, best = {};
      ans.forEach((a, qi) => { if (a == null) return; const [label, w] = Q[qi][1][a];
        for (const k in w) { sc[k] += w[k]; if (!best[k] || w[k] > best[k][0]) best[k] = [w[k], label]; } });
      return Object.keys(sc).sort((a, b) => sc[b] - sc[a]).map(k => [k, best[k] && best[k][1]]);
    };
    const path = () => rank().slice(0, 3);
    const because = b => b ? ` You said <i>${esc(b)}</i>.` : "";
    // the live path IS the story grid: answers reorder the cards (FLIP) and rank the top three in violet
    // Postiz is the featured card above the grid; its rank badge goes on the feature, the others reorder in the grid
    const grid = $("#bgrid"), cards = grid ? $$(".bcard[data-story]", grid) : [], orig = cards.slice(), qcount = $("#qcount"), feat = $(".feat[data-story]");
    const nameOf = c => c.dataset.story;
    const showPath = animate => {
      const n = answered();
      if (qcount) { qcount.hidden = !n; qcount.textContent = n + " of " + Q.length; }
      if (!grid) return;
      const r = rank().map(([k]) => k), top = n ? r.slice(0, 3) : [];
      const order = n ? r.map(k => orig.find(c => nameOf(c) === k)).filter(Boolean) : orig;
      const first = new Map(cards.map(c => [c, c.getBoundingClientRect()])), anchor = grid.querySelector(".empty");
      order.forEach(c => grid.insertBefore(c, anchor));
      [...cards, feat].filter(Boolean).forEach(c => { let b = c.querySelector(".fyr"); const i = top.indexOf(nameOf(c)); c.classList.toggle("fy", i >= 0);
        if (i < 0) { if (b) b.remove(); return; }
        const row = c.querySelector(".bc-top, .ftag");
        if (!b) { b = document.createElement("span"); b.className = "fyr"; row.insertBefore(b, row.querySelector(".lb")); }
        b.textContent = "#" + (i + 1) + " for you"; });
      if (reduce || !animate) return;
      cards.forEach(c => { if (c.hidden) return; const a = first.get(c), r = c.getBoundingClientRect(), dx = a.left - r.left, dy = a.top - r.top;
        if (Math.abs(dx) + Math.abs(dy) > 1) c.animate([{transform: `translate(${dx}px,${dy}px)`}, {transform: "none"}], {duration: 700, easing: OUT}); });
    };
    const result = () => {
      const p = path(), n = answered(), [top] = p[0], [href] = POSTS[ST[top].p];
      const chips = ans.map((a, qi) => a == null ? "" : `<li>${esc(Q[qi][1][a][0])}</li>`).join("");
      return `<div class="qres" tabindex="-1">
        <h3 class="qr-h">Your path: <em class="em p">start like ${top}.</em></h3>
        <p class="qr-s">${n ? `Built from your ${n === 1 ? "answer" : n + " answers"}. ` : "You skipped every question, so this is the path we'd give anyone. "}Read these three in order. Each one is a real story with its numbers labelled.</p>
        ${chips ? `<ul class="qr-c" aria-label="Your answers">${chips}</ul>` : ""}
        <ol class="qr-p">${p.map(([k, b], i) => { const [h, t] = POSTS[ST[k].p];
          return `<li style="--i:${i}"><a href="${h}"><span class="qn">${i + 1}</span><span class="qt"><b>${k}</b><small>${ST[k].why}${because(b)}</small><span class="qin">In: ${esc(t)}</span></span>${ARW}</a></li>`; }).join("")}</ol>
        <div class="qr-a"><a class="btn btn-p" href="/welcome/#signup">Save my path, free <span class="arr" aria-hidden="true">→</span></a><a class="btn btn-s" href="${href}">Read about ${top}</a></div>
      </div>`;
    };
    const play = el => { el.classList.remove("play"); void el.offsetWidth; el.classList.add("play"); };
    let firstRender = true;
    const render = dir => {
      const done = step >= Q.length, prevH = qbody.offsetHeight;
      qcard.classList.toggle("done", done);
      $("#qstep").textContent = done ? "Your path" : "Question " + (step + 1) + " of " + Q.length;
      $("#qbar").style.width = (done ? 100 : step / Q.length * 100) + "%"; $("#qprog").setAttribute("aria-valuenow", Math.min(step, Q.length));
      $("#qback").disabled = step === 0; $("#qskip").hidden = done; $("#qrestart").hidden = !done && !answered() && step === 0;
      if (done) qbody.innerHTML = result();
      else { const [q, opts] = Q[step];
        qbody.innerHTML = `<h3 id="qh">${q}</h3><p class="qh">Answer if you want, or skip. Nothing is sent anywhere.</p><div class="opts" role="group" aria-labelledby="qh">${opts.map((o, i) => `<button class="opt" type="button" aria-pressed="${ans[step] === i}" data-o="${i}">${o[0]}</button>`).join("")}</div>`; }
      if (!reduce && dir) {
        qbody.classList.remove("fwd", "back"); void qbody.offsetWidth; qbody.classList.add(dir);
        const h = qbody.offsetHeight; // the card grows/shrinks smoothly into the new screen
        if (h !== prevH && qbody.animate) qbody.animate([{height: prevH + "px"}, {height: h + "px"}], {duration: 520, easing: OUT});
      }
      const res = $(".qres", qbody);
      if (res) { if (reduce) res.classList.add("play"); else if (firstRender && "IntersectionObserver" in window) {
          const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); play(res); } }, {threshold: .3}); io.observe(res); }
        else play(res); }
      const wasFirst = firstRender; firstRender = false;
      save(); showPath(!wasFirst);
    };
    qbody.addEventListener("click", e => {
      const o = e.target.closest(".opt"); if (!o) return;
      const i = +o.dataset.o; ans[step] = ans[step] === i ? null : i; save();
      $$(".opt", qbody).forEach(x => x.setAttribute("aria-pressed", ans[step] === +x.dataset.o)); showPath(true);
      $("#qrestart").hidden = false;
      if (ans[step] != null) { const at = step; setTimeout(() => { if (step !== at) return; step++; render("fwd");
        if (document.activeElement === o || document.activeElement === document.body) { const f = qbody.querySelector(".opt, .qres"); if (f) f.focus({preventScroll: true}); } }, reduce ? 0 : 380); }
    });
    $("#qback").addEventListener("click", () => { if (step > 0) { step--; render("back"); } });
    $("#qskip").addEventListener("click", () => { if (step < Q.length) { step++; render("fwd"); } });
    $("#qrestart").addEventListener("click", () => { ans.fill(null); step = 0; render("back"); const f = qbody.querySelector(".opt"); if (f) f.focus({preventScroll: true}); });
    render();

    // the compact control opens the questions in place, above the cards
    const qopen = $("#qopen"), quiz = $("#quiz");
    if (qopen && quiz) qopen.addEventListener("click", () => {
      const open = qopen.getAttribute("aria-expanded") !== "true";
      qopen.setAttribute("aria-expanded", open);
      if (quiz._a) { quiz._a.cancel(); quiz._a = null; }
      if (open) {
        quiz.hidden = false;
        if (!reduce) quiz._a = quiz.animate([{height: "0px", opacity: 0}, {height: quiz.offsetHeight + "px", opacity: 1}], {duration: 520, easing: OUT});
        const res = $(".qres", qbody); if (res) play(res);
        const f = qbody.querySelector(".opt, .qres"); if (f) f.focus({preventScroll: true});
      } else if (reduce) quiz.hidden = true;
      else { quiz._a = quiz.animate([{height: quiz.offsetHeight + "px", opacity: 1}, {height: "0px", opacity: 0}], {duration: 320, easing: "cubic-bezier(.4,0,.2,1)"});
        quiz._a.onfinish = () => { quiz.hidden = true; quiz._a = null; }; }
    });
  }

  // ---------- inside a breakdown: ARIA tabs with a sliding indicator, crossfading panels, animated height and content ----------
  const parts = $("#inside .parts[data-tabs]"), win = $("#inside .cwin");
  if (parts && win) {
    const tabs = $$('[role="tab"]', parts), nm = $("#cropname"), panel = t => document.getElementById(t.getAttribute("aria-controls"));
    const ind = document.createElement("i"); ind.className = "pind"; ind.setAttribute("aria-hidden", "true"); parts.prepend(ind); parts.classList.add("has-pind");
    let cur = tabs.find(t => t.getAttribute("aria-selected") === "true") || tabs[0], cleanup = null;
    const place = () => { ind.style.transform = `translateY(${cur.offsetTop}px)`; ind.style.height = cur.offsetHeight + "px"; };
    const play = p => { p.classList.remove("play"); void p.offsetWidth; p.classList.add("play"); };
    const select = (t, focus) => {
      tabs.forEach(x => { const on = x === t; x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1; });
      if (focus) t.focus();
      if (cleanup) cleanup();
      const prev = cur, a = panel(prev), b = panel(t); cur = t; place();
      if (t === prev) { b.hidden = false; return; }
      if (nm) { nm.textContent = t.querySelector("b").textContent; if (!reduce && nm.animate) nm.animate([{opacity: 0, transform: "translateY(6px)"}, {opacity: 1, transform: "none"}], {duration: 380, easing: OUT}); }
      if (reduce || !win.animate) { a.hidden = true; b.hidden = false; b.classList.add("play"); return; }
      const dir = tabs.indexOf(t) > tabs.indexOf(prev) ? 1 : -1, h0 = win.offsetHeight, top = a.offsetTop;
      a.classList.add("leaving"); a.style.top = top + "px";       // the old panel floats on top while it fades out
      b.hidden = false; play(b);
      const h1 = win.offsetHeight;
      const anims = [
        win.animate([{height: h0 + "px"}, {height: h1 + "px"}], {duration: 520, easing: OUT}),
        a.animate([{opacity: 1, transform: "none"}, {opacity: 0, transform: `translateX(${-dir * 28}px)`}], {duration: 240, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards"}),
        b.animate([{opacity: 0, transform: `translateX(${dir * 28}px)`}, {opacity: 1, transform: "none"}], {duration: 520, delay: 90, easing: OUT, fill: "backwards"})
      ];
      cleanup = () => { anims.forEach(x => x.cancel()); a.hidden = true; a.classList.remove("leaving"); a.style.top = ""; cleanup = null; };
      anims[1].onfinish = () => { if (cleanup) { a.hidden = true; a.classList.remove("leaving"); a.style.top = ""; anims[1].cancel(); } };
      anims[0].onfinish = () => { cleanup = null; };
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", e => {
        const d = {ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1}[e.key];
        const to = d ? tabs[(i + d + tabs.length) % tabs.length] : e.key === "Home" ? tabs[0] : e.key === "End" ? tabs[tabs.length - 1] : null;
        if (to) { e.preventDefault(); select(to, true); }
      });
    });
    tabs.forEach(x => { const on = x === cur; x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1; panel(x).hidden = !on; });
    ind.style.transition = "none"; place(); requestAnimationFrame(() => requestAnimationFrame(() => ind.style.transition = ""));
    // the first panel plays its entrance when the section scrolls into view
    const first = panel(cur);
    if (reduce || !("IntersectionObserver" in window)) first.classList.add("play");
    else { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); play(panel(cur)); } }, {threshold: .35}); io.observe(win); }
    let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(place, 80); });
    if (document.fonts) document.fonts.ready.then(place);
  }



  // ---------- phone hero: three moves, then "See all 8 moves" opens the rest (CSS shows the button under 760px) ----------
  const mvall = $(".mvall"), mvwin = $("#win");
  if (mvall && mvwin) mvall.addEventListener("click", () => {
    const open = mvall.getAttribute("aria-expanded") !== "true", ol = $("#moves"), h0 = ol.offsetHeight;
    mvall.setAttribute("aria-expanded", open); mvwin.classList.toggle("mv-all", open);
    mvall.textContent = open ? "Show fewer moves" : "See all 8 moves";
    if (!reduce && ol.animate) ol.animate([{height: h0 + "px"}, {height: ol.offsetHeight + "px"}], {duration: 480, easing: OUT});
  });

  // ---------- pricing: "Compare plans" opens the plan table in place ----------
  const cbtn = $(".cmpbtn"), cbox = cbtn && document.getElementById(cbtn.getAttribute("aria-controls"));
  if (cbtn && cbox) cbtn.addEventListener("click", () => {
    const open = cbtn.getAttribute("aria-expanded") !== "true";
    cbtn.setAttribute("aria-expanded", open);
    if (cbox._a) { cbox._a.cancel(); cbox._a = null; }
    if (open) { cbox.hidden = false; if (!reduce) { cbox.style.overflow = "hidden";
        cbox._a = cbox.animate([{height: "0px", opacity: 0}, {height: cbox.offsetHeight + "px", opacity: 1}], {duration: 560, easing: OUT});
        cbox._a.onfinish = () => { cbox.style.overflow = ""; cbox._a = null; }; } }
    else if (reduce) cbox.hidden = true;
    else { cbox.style.overflow = "hidden";
      cbox._a = cbox.animate([{height: cbox.offsetHeight + "px", opacity: 1}, {height: "0px", opacity: 0}], {duration: 340, easing: "cubic-bezier(.4,0,.2,1)"});
      cbox._a.onfinish = () => { cbox.hidden = true; cbox.style.overflow = ""; cbox._a = null; }; }
  });
})();
