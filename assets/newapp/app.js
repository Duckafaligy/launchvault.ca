/* LaunchVault app: storage (this device only, safe without storage), ⌘K search, Library, reader, checklists, path, account, onboarding.
   Calm by design: no magnetic buttons, no cursor effects, no particles. Respects prefers-reduced-motion. */
(() => {
  // age gate (assets/gate.js): the app does nothing, and stores nothing, until it passes. The sign-in wall still runs first,
  // so signed-out visitors go to /sign-in/ before being asked anything; auth.js then opens the age question for real accounts.
  if (!window.LVGate || !LVGate.ok) { if (window.LVAuth) LVAuth.app(); return; }
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const savedTo = () => window.LVAuth && LVAuth.email && LVAuth.email() ? "Saved to your account." : "Saved on this device.";
  // glide: one shared highlight that slides to the active item of a tab row / segmented control (app.css .lvind).
  // The first placement doesn't animate; later ones slide. Re-placed on resize.
  const GLIDE = new Set();
  const glide = (box, sel = ".on, [aria-pressed=\"true\"], [aria-checked=\"true\"][role=\"radio\"]") => {
    if (!box) return; let ind = box.querySelector(":scope > .lvind");
    if (!ind) { ind = document.createElement("span"); ind.className = "lvind"; ind.setAttribute("aria-hidden", "true"); ind.style.transition = "none"; box.prepend(ind); GLIDE.add([box, sel]); }
    const a = [...box.querySelectorAll(sel)].find(x => x.parentElement === box || x.parentElement.parentElement === box);
    // hidden (e.g. inside a closed sheet): keep the normal highlight until the slider can be placed
    if (!a || !a.offsetWidth) { ind.style.opacity = "0"; ind.style.transition = "none"; box.classList.remove("has-ind"); return; }
    box.classList.add("has-ind"); ind.style.opacity = "1"; ind.style.width = a.offsetWidth + "px"; ind.style.height = a.offsetHeight + "px";
    ind.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
    if (ind.style.transition === "none") requestAnimationFrame(() => requestAnimationFrame(() => { ind.style.transition = ""; }));
  };
  if (document.fonts) document.fonts.ready.then(() => GLIDE.forEach(([b, s]) => glide(b, s)));
  addEventListener("resize", () => { clearTimeout(glide.t); glide.t = setTimeout(() => GLIDE.forEach(([b, s]) => glide(b, s)), 120); }, {passive: true});
  const esc =s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  // preference-type keys are only saved when cookie consent allows Preferences (necessary keys, like ticks you save, always are)
  const PREF = new Set(["lv-lib", "lv-pathnote"]);
  const prefOK = () => { try { if (window.LVConsent) return LVConsent.allowed("preferences"); const c = JSON.parse(localStorage.getItem("lv-consent")); return !!(c && c.preferences); } catch { return false; } };
  let wiped = false;   // set by Account > Delete your data: nothing is written again on this page
  const ls = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { if (wiped || (PREF.has(k) && !prefOK())) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch {} dispatchEvent(new Event("lv:changed")); },
    del(k) { try { localStorage.removeItem(k); } catch {} },
    keys() { try { return Object.keys(localStorage).filter(k => k.startsWith("lv-")); } catch { return []; } }
  };
  let D = {stories: [], checklists: [], path: {steps: []}, quiz: []};
  try { D = JSON.parse($("#lvapp").textContent); } catch {}
  const S = Object.fromEntries(D.stories.map(s => [s.slug, s]));
  const CL = Object.fromEntries(D.checklists.map(c => [c.slug, c]));
  const MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const today = () => { const d = new Date(); return MON[d.getMonth()] + " " + d.getDate(); };
  const LBC = {"Verified": "v", "Live": "l", "Wayback": "w", "Claimed": "c", "Sources differ": "x", "Couldn't verify": "n", "Estimate": "e"};
  const chip = l => l ? `<span class="lb ${LBC[l] || "n"}">${esc(l)}</span>` : "";
  const staleChip = s => s.stale ? ` <span class="lb n" title="${esc(s.stale)}">Stale</span>` : "";
  const logo = (s, w = 20) => `<img src="${esc(s.logo)}" alt="" width="${w}" height="${w}" loading="lazy">`;
  if (window.LVAuth) LVAuth.app();

  // ---------- toast ----------
  const toastEl = $("#toast"); let tt;
  // ---------- sidebar account row: a small menu card opens above it (wide screens; phones keep the You tab) ----------
  { const row = document.querySelector("[data-sbme]");
    if (row) {
      const A = "/app/account/", m = document.createElement("div"); m.className = "sbm"; m.id = "sbm"; m.setAttribute("role", "menu"); m.hidden = true;
      const judge = () => { try { return JSON.parse(localStorage.getItem("lv-judge")) === "SPARK2026"; } catch { return false; } };
      const draw = () => { const e = window.LVAuth && LVAuth.email && LVAuth.email();
        m.innerHTML = [["#profile", "Profile"], ["#plan", "Plan and billing"], ["#email", "Notifications"], ["#prefs", "Preferences"], ["#site", "Your website"], ["#data", "Privacy and data"]]
          .map(([h, t], i) => `<a role="menuitem" href="${A}${h}" style="--i:${i}">${t}</a>`).join("") + "<hr>"
          + (e ? '<button role="menuitem" type="button" data-sbout style="--i:6">Sign out</button>' : judge() ? '<button role="menuitem" type="button" data-sbexit style="--i:6">Exit judge view</button>' : '<a role="menuitem" href="/sign-in/" style="--i:6">Sign in</a>'); };
      document.body.appendChild(m);
      const z = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--z")) || 1;
      const place = () => { const r = row.getBoundingClientRect(), k = z(); m.style.left = Math.max(8, r.left / k) + "px"; m.style.bottom = (innerHeight - r.top) / k + 8 + "px"; m.style.minWidth = Math.max(208, r.width / k) + "px"; };
      const open = on => { if (on === !m.hidden) return; row.setAttribute("aria-expanded", on);
        if (on) { draw(); m.hidden = false; place(); const f = m.querySelector("a,button"); f && f.focus({preventScroll: true}); }
        else { m.classList.add("out"); setTimeout(() => { m.hidden = true; m.classList.remove("out"); }, 140); } };
      row.addEventListener("click", e => { if (innerWidth <= 720) return; e.preventDefault(); e.stopPropagation(); open(matchMedia("(hover:hover) and (pointer:fine)").matches ? true : m.hidden); });   // with a mouse it is already open from the hover: a click must not shut it
      // hover opens it too (mouse only); it stays while the pointer is on the row or the card, with a short grace to cross the gap
      if (matchMedia("(hover:hover) and (pointer:fine)").matches) { let ht = 0;
        const hin = () => { clearTimeout(ht); if (innerWidth > 720 && m.hidden) { open(true); row.focus({preventScroll: true}); } }, hout = () => { clearTimeout(ht); ht = setTimeout(() => open(false), 220); };
        row.addEventListener("mouseenter", hin); m.addEventListener("mouseenter", () => clearTimeout(ht)); row.addEventListener("mouseleave", hout); m.addEventListener("mouseleave", hout); }
      document.addEventListener("click", e => { if (!m.hidden && !e.target.closest(".sbm")) open(false); });
      addEventListener("resize", () => open(false));
      m.addEventListener("click", e => {
        if (e.target.closest("[data-sbout]")) { open(false); if (window.LVAuth) LVAuth.signOut(); return; }
        if (e.target.closest("[data-sbexit]")) { try { localStorage.removeItem("lv-judge"); } catch {} location.href = "/sign-in/"; return; }
        if (e.target.closest("a")) open(false); });
      m.addEventListener("keydown", e => { const it = [...m.querySelectorAll("a,button")], i = it.indexOf(document.activeElement);
        if (e.key === "Escape") { open(false); row.focus(); }
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); it[(i + (e.key === "ArrowDown" ? 1 : -1) + it.length) % it.length].focus(); } });
    } }
  const toast = (msg, undo) => { if (!toastEl) return; clearTimeout(tt);
    toastEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6EE7B7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>${esc(msg)}</span>` + (undo ? '<button type="button">Undo</button>' : "");
    toastEl.classList.add("on"); if (undo) toastEl.querySelector("button").onclick = () => { undo(); toastEl.classList.remove("on"); };
    tt = setTimeout(() => toastEl.classList.remove("on"), 4200); };

  // ---------- offline: everything on this device keeps working; only sending (feedback, reports) needs a connection ----------
  const sendErr = err => navigator.onLine === false ? "You're offline, so that didn't send. What you wrote is still here. Try again when you're back online." : "Sorry, that didn't send (" + err.message + "). Please try again in a minute.";
  addEventListener("offline", () => toast("You're offline. Your progress still saves on this device."));
  addEventListener("online", () => toast("Back online."));

  // ---------- progress model ----------
  const ticks = slug => { const c = CL[slug]; if (!c) return []; const t = ls.get(c.key, []); return c.items.map((_, i) => !!(Array.isArray(t) && t[i])); };
  const setTicks = (slug, arr) => { const c = CL[slug]; ls.set(c.key, arr); };
  const tickDates = slug => ls.get("lv-" + slug + "-checkdates", {});
  const readPct = slug => Math.round((ls.get("lv-read-" + slug, {}) || {}).pct || 0);
  const quiz = () => ls.get("lv-quiz-app");
  // the path follows the quiz: top match's checklist, plus the next match's opening step; no clear match keeps the general Postiz path
  const pathFor = m => { m = (m || []).filter(s => D.paths && D.paths[s]); const P = D.paths && D.paths[m[0]];
    return P ? {...P, extra: m[1] ? D.paths[m[1]].lead : D.path.extra} : D.path; };
  const PATH0 = D.path;   // the general starter path (used until the quiz finds a clear match)
  { const q = quiz(); if (q && q.top !== null) D.path = pathFor(q.matches); }
  const ADULT = () => ls.get("lv-age") === "21 or older";
  $$("[data-school]").forEach(n => { if (ADULT()) n.textContent = n.dataset.school; });
  const pathSteps = () => { const p = D.path; const t = ticks(p.source); const dates = tickDates(p.source);
    return p.steps.map(s => ({...s, done: t[s.n - 1], date: dates[s.n - 1]})).concat([{...p.extra, n: 0, extra: 1, done: !!ls.get("lv-path-extra"), date: ls.get("lv-path-extra")}]); };
  const pathDone = () => pathSteps().filter(s => s.done).length;
  const paint = () => {
    $$('[data-cnt="path"]').forEach(n => n.textContent = quiz() ? pathDone() + "/" + pathSteps().length : "");
    const open = D.checklists.filter(c => ticks(c.slug).some(Boolean)).length;
    $$('[data-cnt="ck"]').forEach(n => n.textContent = open || "");
    $$("[data-pct]").forEach(n => { const p = readPct(n.dataset.pct); n.textContent = p ? p + "%" : ""; });
    $$("[data-pctbar]").forEach(n => n.style.setProperty("--w", readPct(n.dataset.pctbar) + "%"));
    $$("[data-ckc]").forEach(n => { const t = ticks(n.dataset.ckc); n.textContent = t.filter(Boolean).length + (n.closest(".mph") ? "/" : " of ") + t.length; });
    $$("[data-ckbar]").forEach(n => { const t = ticks(n.dataset.ckbar); n.style.width = (t.filter(Boolean).length / Math.max(1, t.length) * 100) + "%"; });
    $$("[data-cknext]").forEach(n => { const s = n.dataset.cknext, t = ticks(s), i = t.indexOf(false); n.textContent = i < 0 ? "All done. Nice." : (n.closest(".rnext") ? "" : "Next: ") + CL[s].items[i].text; });
    $$("[data-ckstate]").forEach(n => { const t = ticks(n.dataset.ckstate); n.innerHTML = pill(statusKey(t.filter(Boolean).length, t.length)); });
    $$("[data-pathname]").forEach(n => n.textContent = D.path.title);
    const st = pathSteps(), dn = pathDone();
    $$("[data-pathbar]").forEach(n => n.style.setProperty("--w", (dn / st.length * 100) + "%"));
    $$("[data-pathcount]").forEach(n => n.textContent = `${dn} of ${st.length} · ${Math.round(dn / st.length * 100)}%`);
    $$("[data-pathcount2]").forEach(n => n.textContent = `${dn} of ${st.length}`);
    $$("[data-pathlabel]").forEach(n => n.textContent = quiz() ? "Your path" : "Starter path");
    $$("[data-pathshare]").forEach(n => n.textContent = `Shares ticks with the ${(CL[D.path.source] || {}).name || ""} checklist.`);
  };
  addEventListener("storage", paint);

  // ---------- checklists (shared everywhere by storage key) ----------
  const toggleTick = (slug, i) => {
    const t = ticks(slug), before = t.slice(); t[i] = !t[i]; setTicks(slug, t); ls.set("lv-ck-last", slug);
    const dates = tickDates(slug); if (t[i]) dates[i] = today(); else delete dates[i]; ls.set("lv-" + slug + "-checkdates", dates);
    syncChecklists(); paint(); renderPath();
    if (t[i] && CL[slug]) logAct(`Ticked "${CL[slug].items[i].text.slice(0, 48)}${CL[slug].items[i].text.length > 48 ? "…" : ""}" in ${CL[slug].name}`);
    toast(t[i] ? "Ticked. " + savedTo() : "Unticked.", () => { setTicks(slug, before); syncChecklists(); paint(); renderPath(); });
  };
  const syncChecklists = () => $$(".ckl[data-slug]").forEach(box => { const s = box.dataset.slug, t = ticks(s);
    $$(".ck", box).forEach((b, i) => b.setAttribute("aria-checked", !!t[i]));
    const n = t.filter(Boolean).length, p = box.querySelector(".ckp"); if (p) p.textContent = `${n} of ${t.length} · ${Math.round(n / t.length * 100)}%`;
    const bar = box.querySelector(".ckh .bar i"); if (bar) bar.style.width = (n / t.length * 100) + "%"; });
  document.addEventListener("click", e => { const b = e.target.closest(".ckl[data-slug] .ck"); if (!b) return;
    const box = b.closest(".ckl"); toggleTick(box.dataset.slug, $$(".ck", box).indexOf(b)); });
  const ckListHTML = (c, open = true) => `<div class="ckl" data-slug="${c.slug}"><div class="ckh"><span class="ckp"></span><span class="bar"><i></i></span><span class="dev">Saves as you go</span></div>` +
    c.items.map(it => `<button class="ck" type="button" role="checkbox" aria-checked="false"><span class="bx"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><span class="ct">${esc(it.text)}</span><span class="cf">${esc(it.from || "")}</span></button>`).join("") +
    `<div class="ckf"><span>Your ticks save as you go.</span></div></div>`;
  $$("[data-ckmirror]").forEach(n => { const c = CL[n.dataset.ckmirror]; if (c) n.innerHTML = ckListHTML(c); });

  // ---------- ⌘K search ----------
  const cmdIndex = () => {
    const out = [];
    D.stories.forEach(s => out.push({g: "Breakdowns", t: s.name, r: s.status === "ready" ? s.type : "Coming soon", h: s.href, img: s.logo, k: [s.name, s.what, s.pattern, ...(s.lessons || [])].join(" ")}));
    [...new Set(D.stories.map(s => s.pattern).filter(p => p && p !== "Pattern not checked yet"))].forEach(p => out.push({g: "Patterns", t: p, h: "/app/library/?group=pattern&pattern=" + encodeURIComponent(p), k: p}));
    (D.search_extra || []).forEach(x => out.push({g: x.g, t: x.t, h: x.h, k: x.t + " " + (x.k || "")}));
    [["Home", "/app/"], ["Library", "/app/library/"], ["My path", "/app/path/"], ["Checklists", "/app/checklists/"], ["Account", "/app/account/"], ["Retake the quiz", "/app/start/?quiz=1"]].forEach(([t, h]) => out.push({g: "Pages", t, h, k: t}));
    return out;
  };
  let cmdEl = null, idx = null, sel = 0;
  // small icon badges for results without a logo (pages, patterns, story sections)
  const CMDI = {Pages: '<path d="M4 5h16v14H4z"/><path d="M4 9h16"/>', Patterns: '<path d="M4 12h4l3-7 3 14 3-7h3"/>',
    _: '<path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h6"/>'};
  const openCmd = () => {
    if (cmdEl) return; idx = idx || cmdIndex();
    const act = document.activeElement, prev = act && act !== document.body ? act : [...document.querySelectorAll("[data-cmd]")].find(b => b.offsetParent);
    cmdEl = document.createElement("div"); cmdEl.className = "cmd"; cmdEl.setAttribute("role", "dialog"); cmdEl.setAttribute("aria-modal", "true"); cmdEl.setAttribute("aria-label", "Search");
    cmdEl.innerHTML = `<div class="box"><div class="in"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="text" placeholder="Search breakdowns, moves, patterns, sources" aria-label="Search" aria-controls="cmdres" autocomplete="off"><kbd>esc</kbd></div><div class="res" id="cmdres" role="listbox"></div><div class="ft"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></div></div>`;
    document.body.appendChild(cmdEl); const inp = $("input", cmdEl), res = $(".res", cmdEl);
    const draw = () => { const q = inp.value.trim().toLowerCase(), hits = (q ? idx.filter(x => x.k.toLowerCase().includes(q)) : idx.filter(x => x.g === "Breakdowns" || x.g === "Pages")).slice(0, 40);
      sel = Math.min(sel, Math.max(0, hits.length - 1));
      let g = ""; res.innerHTML = hits.length ? hits.map((x, i) => (x.g !== g ? `<div class="grp">${g = x.g}</div>` : "") +
        `<a class="it" role="option" id="ci${i}" aria-selected="${i === sel}" href="${esc(x.h)}" ${x.h.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${x.img ? `<img src="${esc(x.img)}" alt="">` : `<i class="cib" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CMDI[x.g] || CMDI._}</svg></i>`}<span class="t">${esc(x.t)}</span>${x.r ? `<span class="r">${esc(x.r)}</span>` : ""}</a>`).join("") : '<div class="none">No matches. Try a company or a pattern.</div>';
      inp.setAttribute("aria-activedescendant", hits.length ? "ci" + sel : ""); return hits; };
    let hits = draw();
    inp.addEventListener("input", () => { sel = 0; hits = draw(); });
    // closing fades out (app.css .cmd.out) before the element goes; a new ⌘K during the fade opens a fresh one
    const close = () => { const el = cmdEl; cmdEl = null; if (prev) prev.focus();
      if (reduce) return el.remove(); el.classList.add("out"); setTimeout(() => el.remove(), 160); };
    cmdEl.addEventListener("click", e => { if (e.target === cmdEl) close(); });
    cmdEl.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % Math.max(1, hits.length); hits = draw(); const a = $("#ci" + sel); if (a) a.scrollIntoView({block: "nearest"}); }
      else if (e.key === "Enter") { const a = $("#ci" + sel); if (a) { e.preventDefault(); a.click(); } }
      else if (e.key === "Tab") { e.preventDefault(); inp.focus(); } });
    inp.focus();
  };
  $$("[data-cmd]").forEach(b => b.addEventListener("click", openCmd));
  addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openCmd(); }
    else if (e.key === "/" && !/input|textarea|select/i.test((document.activeElement || {}).tagName || "") && !cmdEl) { e.preventDefault(); openCmd(); } });

  // ---------- sheets (mobile reader) ----------
  let openSheet = null, lastBtn = null, scrim = null;
  const closeSheet = () => { if (!openSheet) return; const s = openSheet; s.classList.remove("on"); scrim.classList.remove("on");
    setTimeout(() => { s.hidden = true; if (scrim) { scrim.remove(); scrim = null; } }, reduce ? 0 : 250); openSheet = null; if (lastBtn) lastBtn.focus(); };
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-sheet]"); if (b) { const s = document.getElementById(b.dataset.sheet); if (!s) return; lastBtn = b;
      scrim = document.createElement("div"); scrim.className = "scrim"; document.body.appendChild(scrim); scrim.addEventListener("click", closeSheet);
      s.hidden = false; requestAnimationFrame(() => { s.classList.add("on"); scrim.classList.add("on"); }); openSheet = s; const f = s.querySelector("button,a"); if (f) f.focus(); return; }
    const g = e.target.closest("[data-goph]"); if (g) { closeSheet(); let t = document.getElementById("ph" + g.dataset.goph); if (t && t.closest("[hidden]")) t = document.getElementById("gate"); if (t) setTimeout(() => t.scrollIntoView({behavior: reduce ? "auto" : "smooth"}), 50); return; }
    if (e.target.closest("[data-close]")) closeSheet();
  });
  addEventListener("keydown", e => {
    if (e.key === "Escape") closeSheet();
    if (e.key === "Tab" && openSheet) { const f = [...openSheet.querySelectorAll("a[href],button:not([disabled])")].filter(x => x.offsetParent); if (!f.length) return;   // keep focus inside the open sheet
      const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } else if (i < 0) { e.preventDefault(); f[0].focus(); } }
  });

  // ---------- reader ----------
  const rd = $("[data-reader]");
  if (rd) {
    const slug = rd.dataset.reader, art = $("article", rd), n = +rd.dataset.phases;
    const links = $$(".snav [data-r], .rrail [data-r]"), secs = links.map(a => document.getElementById(a.dataset.r)).filter(Boolean);
    const names = (CL[slug] || {}).phase_names || [];
    let saved = ls.get("lv-read-" + slug, {}) || {}, lastSave = 0;
    const onScroll = () => {
      const r = art.getBoundingClientRect(), pct = Math.max(0, Math.min(100, Math.round(-r.top / Math.max(1, r.height - innerHeight) * 100)));
      $$("[data-readbar],[data-readbar2]").forEach(b => b.style.width = pct + "%"); $$("[data-readpct]").forEach(b => b.textContent = pct + "% read");
      // same line as the phase label below (40%), and the last section wins at the very bottom (it may never reach the line)
      let cur = null; secs.forEach(s => { if (s.getBoundingClientRect().top < innerHeight * .4) cur = s.id; });
      if (secs.length && innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = secs[secs.length - 1].id;
      links.forEach(a => a.classList.toggle("on", a.dataset.r === cur));
      let ph = 1; $$(".ph", rd).forEach(p => { if (p.offsetParent && !p.closest("[hidden]") && !p.closest(".fade") && p.getBoundingClientRect().top < innerHeight * .4) ph = +p.dataset.ph; });
      $$(".ph", rd).forEach(p => p.classList.toggle("cur", +p.dataset.ph === ph));
      $$("[data-curph]").forEach(x => x.textContent = ph); $$("[data-curname]").forEach(x => x.textContent = names[ph - 1] || "");
      $$("#phsheet [data-goph]").forEach(b => { const k = +b.dataset.goph; b.classList.toggle("on", k === ph); b.querySelector(".r").textContent = k === ph ? "Reading" : k < ph ? "read" : ""; });
      if (pct > (saved.pct || 0) && Date.now() - lastSave > 800) { saved = {pct, ph, name: names[ph - 1] || "", n}; ls.set("lv-read-" + slug, saved); lastSave = Date.now(); paint(); }
    };
    let scQ = 0; addEventListener("scroll", () => { if (!scQ) scQ = requestAnimationFrame(() => { scQ = 0; onScroll(); }); }, {passive: true}); onScroll();   // once per frame: reads + writes no longer thrash on every scroll event
    if (location.hash) setTimeout(() => { const t = document.getElementById(location.hash.slice(1)); if (t && !t.closest("[hidden]")) t.scrollIntoView(); }, 50);
  }

  // ---------- progress: lessons seen, saved, story checks, activity (all on this device) ----------
  const READY = D.stories.filter(s => s.status === "ready");
  const arr = (k, d = []) => { const v = ls.get(k, d); return Array.isArray(v) ? v : d; };
  const nph = s => s.phases || (CL[s.slug] || {}).phases || 1;
  const seen = slug => arr("lv-seen-" + slug);
  const doneOf = slug => { const d = ls.get("lv-done-" + slug); return d && d.how ? d : null; };   // logged complete: marked as read (older entries: passed the check or answered feedback)
  const stateOf = s => doneOf(s.slug) ? "done" : seen(s.slug).length || readPct(s.slug) ? "prog" : "new";
  const savedList = () => arr("lv-saved");
  const savedItems = () => arr("lv-saved-items");
  const checkRes = slug => { const r = ls.get("lv-check-" + slug); return r && r.n ? r : null; };
  function logAct(m) { ls.set("lv-activity", [{m, t: Date.now()}, ...arr("lv-activity")].slice(0, 20)); }
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
  const STAR = '<svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
  const WEEKS = (READY.find(s => !s.stale) || READY[0] || {}).slug;
  const bar = (f, cls = "") => `<span class="bar${cls}"><i style="--w:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%"></i></span>`;
  // status pills + icon badges (Wave 4): one look for story, step and checklist status everywhere
  const svgI = (d, w = 14) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const PI = {ready: '<path d="M5 4h14v16l-7-4-7 4z"/>', prog: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>', done: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    free: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>', judge: '<path d="M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14 8v10" stroke-dasharray="2 2"/>',
    pro: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    lib: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>', path: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7"/>'};
  const PL = {ready: "Ready", prog: "In progress", done: "Completed", free: "Free", judge: "Judge pass", pro: "Pro"};
  const pill = (k, label) => `<span class="lvpill ${k}">${svgI(PI[k], 12)}${esc(label || PL[k])}</span>`;
  const judgeOn = () => ls.get("lv-judge") === "SPARK2026";   // same code as JCODE below (syncJudge)
  const accessPill = s => pill(s.slug === WEEKS ? "free" : judgeOn() ? "judge" : "pro");
  const statusKey = (k, n) => k <= 0 ? "ready" : k >= n ? "done" : "prog";   // k of n done
  // ---- Vault cards (Paper "LaunchVault · App"): real story image on top, logo tile, growth pill, headline number, phase state ----
  const COV = (() => { try { return JSON.parse($("#lvcov").textContent); } catch { return {}; } })();
  const cov = (s, cls = "cv") => COV[s.slug] ? `<span class="${cls}"><img src="${esc(COV[s.slug])}" alt="" width="960" height="540" loading="lazy" decoding="async"></span>` : `<span class="${cls} nocv">${logo(s, 40)}</span>`;
  const tile = (s, w = 30) => `<span class="tile" style="--s:${w}px">${logo(s, Math.round(w * .58))}</span>`;
  const gpill = (s, cls = "") => s.growth == null ? chip(s.hl) : `<span class="gp${s.growth < 0 ? " dn" : ""}${cls}" title="Average monthly growth across the chart">${s.growth > 0 ? "+" : s.growth < 0 ? "−" : ""}${Math.abs(s.growth)}%</span>`;
  const ARW = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 3l4 4-4 4"/></svg>';
  const unit = s => (s.hm || s.hu || "").trim().replace(/^Revenue in /, "revenue, ");
  const ushort = s => (s.hu || "").trim().replace(/^in (\w+) \d{4}$/, "$1");
  const storyCard = s => { const st = stateOf(s), n = nph(s), k = Math.min(seen(s.slug).length, n), sv = savedList().includes(s.slug), wk = s.slug === WEEKS, open = wk || judgeOn() || !!paidRow();
    const lab = st === "done" ? "Completed" : k ? `Phase ${k} of ${n}` : wk ? "Free this week" : open ? "All phases open" : "Phase 1 free";
    return `<article class="scard${wk ? " wk" : ""}" data-st="${st}"><a class="scl" href="${s.href}">${cov(s)}<span class="scb">`
      + `<span class="sct">${tile(s)}<span class="nm"><b>${esc(s.name)}</b><small>${esc(s.type)}<span class="mo"> · ${esc(s.hv)} ${esc(ushort(s))}</span></small></span>${gpill(s)}</span>`
      + `<span class="snum"><span><b>${esc(s.hv)}</b><small title="${esc([s.hs, s.hd].filter(Boolean).join(", read "))}">${esc(unit(s))}${staleChip(s)}</small></span>${s.spark}</span>`
      + `<span class="sst"><span class="l${k || st === "done" ? " on" : ""}">${lab}</span><span>${Math.max(1, Math.round(s.read / n))} min a phase</span></span>${bar(st === "done" ? 1 : k / n)}`
      + `</span></a><button type="button" class="star" data-star="${s.slug}" aria-pressed="${sv}" aria-label="${sv ? "Remove" : "Save"} ${esc(s.name)}">${STAR}</button></article>`; };
  // compact card for "Read next" (a side-scrolling row on phones)
  const nextCard = (s, star = false) => `<article class="scard rn"><a class="scl" href="${s.href}">${cov(s)}<span class="scb"><span class="sct">${tile(s, 22)}<span class="nm"><b>${esc(s.name)}</b></span><small class="rm">${s.read} min</small>${gpill(s, " mo")}</span>`
    + `<span class="snum"><span><b>${esc(s.hv)}</b> <small>${esc((s.hu || "").trim().replace(/^in (\w+) \d{4}$/, "$1"))}</small></span>${gpill(s)}</span><span class="sub">${esc(s.type)} · ${esc(s.hv)}${esc((s.hu || "").replace(/ \d{4}$/, ""))}</span></span></a>`
    + (star === true ? `<button type="button" class="star" data-star="${s.slug}" aria-pressed="${savedList().includes(s.slug)}" aria-label="${savedList().includes(s.slug) ? "Remove" : "Save"} ${esc(s.name)}">${STAR}</button>` : "") + `</article>`;
  window.LVStoryCard = storyCard;   // Ask LaunchVault (assistant.js) shows the stories a reply links with the same card
  const syncStars = () => { const L = savedList(), I = savedItems();
    $$("[data-star]").forEach(b => { const on = L.includes(b.dataset.star); b.setAttribute("aria-pressed", on); const t = b.querySelector("span"); if (t) t.textContent = on ? "Saved" : "Save"; });
    $$("[data-staritem]").forEach(b => b.setAttribute("aria-pressed", I.includes(b.dataset.staritem)));
    $$('[data-cnt="saved"]').forEach(n => n.textContent = (L.length + I.length) || ""); };
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-star]");
    if (b) { e.preventDefault(); const slug = b.dataset.star, L = savedList(), on = !L.includes(slug), x = S[slug] || {};
      ls.set("lv-saved", on ? [slug, ...L] : L.filter(k => k !== slug)); if (on) logAct(`Saved ${x.name || slug}`); toast(on ? "Saved" : "Removed"); renderAll(); return; }
    const it = e.target.closest("[data-staritem]");
    if (it) { const k = it.dataset.staritem, L = savedItems(), on = !L.includes(k);
      ls.set("lv-saved-items", on ? [k, ...L] : L.filter(x => x !== k)); toast(on ? "Saved" : "Removed"); renderAll(); }
  });

  // ---------- home: next step first, then progress (or a 3-step start list), then the story cards ----------
  const matches = () => { const q = quiz(); return (q && q.matches && q.matches.length ? q.matches : ["postiz", "stencil-ai", "gojiberry"]).filter(s => S[s]); };
  const srcName = () => (CL[D.path.source] || {}).name || "";
  const miniRow = s => { const x = S[s]; return `<a class="mini" href="${x.href}" style="min-height:56px"><img class="lgs" src="${esc(x.logo)}" alt="" width="18" height="18"><span><span style="display:block">${esc(x.name)}</span><small>${esc(x.pattern)}${staleChip(x)}</small></span><span class="r" aria-hidden="true">›</span></a>`; };
  { const pn = $("#pathnote"); if (pn && quiz() && ls.get("lv-pathnote") === "new") { pn.hidden = false; $("[data-closenote]", pn).addEventListener("click", () => { pn.hidden = true; ls.set("lv-pathnote", "seen"); }); } }
  const homeCL = () => { const cl = $("[data-homecl]"); if (!cl) return; const q = quiz();
    const rows = D.checklists.map(c => { const t = ticks(c.slug), k = t.filter(Boolean).length; return {c, t, k}; }).filter(x => x.k > 0 && x.k < x.t.length);
    const pr = CL[WEEKS] || D.checklists[0], prT = ticks(pr.slug);
    const list = rows.length ? rows : [{c: pr, t: prT, k: prT.filter(Boolean).length}];
    cl.innerHTML = list.slice(0, 3).map(({c, t, k}) => { const i = t.indexOf(false);
      return `<div class="clrow">${i < 0 ? "" : `<button class="hck" type="button" role="checkbox" aria-checked="false" data-hck="${c.slug}:${i}" aria-label="Tick: ${esc(c.items[i].text)}"><span class="bx">${CKS}</span></button>`}<a class="mid" href="${c.href}#todo"><b>${esc(c.name)}</b><small>${i < 0 ? "All done." : "Next: " + esc(c.items[i].text)}</small></a>${bar(k / t.length)}<span class="ct">${k} of ${t.length}</span></div>`; }).join("")
      + (q ? `<a class="clrow" href="/app/path/"><span style="color:var(--brand)">●</span><span class="mid"><b>Your path · ${esc(D.path.title)}</b><small>${(() => { const s = pathSteps().find(x => !x.done); return s ? "Next: " + esc(s.text) : "All done."; })()}</small></span><span class="bar"><i data-pathbar></i></span><span class="ct" data-pathcount2></span></a>` : ""); };
  const hcards = $("[data-hcards]");
  const CKS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const notPublic = f => /^not public$/i.test(f) ? "Not public" : f;
  const markDone = () => { const nx = pathSteps().find(s => !s.done); if (!nx) return;
    if (nx.extra) { ls.set("lv-path-extra", today()); logAct("Finished a step on your path"); toast("Step done. " + savedTo()); } else toggleTick(D.path.source, nx.n - 1); };
  document.addEventListener("click", e => { if (e.target.closest("[data-hdone]")) markDone();
    const h = e.target.closest("[data-hck]"); if (h) { const [s, i] = h.dataset.hck.split(":"); toggleTick(s, +i); } });
  // ---- Vault Home (Paper Home): continue card, this week's step, ask, my path, read next. Real data only; no streaks or scores. ----
  const put = (el, html) => { if (!el || el.__h === html) return; el.__h = html; el.innerHTML = html; el.classList.remove("sk"); };
  const DAYS = "Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" "), MONL = "January February March April May June July August September October November December".split(" ");
  const greet = () => { const h = new Date().getHours(); return h < 5 || h >= 18 ? "Good evening" : h < 12 ? "Good morning" : "Good afternoon"; };
  const stepper = (s, cur, labels) => { const names = (CL[s.slug] || {}).phase_names || [], sn = seen(s.slug);
    return `<span class="stepper${labels ? " lab" : ""}" style="--n:${nph(s)}">${Array.from({length: nph(s)}, (_, i) => `<span class="${i + 1 === cur ? "cur" : sn.includes(i + 1) ? "seen" : ""}"><i></i>${labels ? `<span>${i + 1}. ${esc(names[i] || "")}</span>` : ""}</span>`).join("")}</span>`; };
  const UP = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.addEventListener("click", e => { const x = e.target.closest("[data-hx]"); if (!x) return;
    const on = !ls.get("lv-path-extra"); ls.set("lv-path-extra", on ? today() : null); renderPath(); paint(); toast(on ? "Step done. " + savedTo() : "Unticked."); });
  const renderHome = () => {
    if (!hcards) return;
    const q = quiz(), adult = ADULT(), W = S[WEEKS], st = pathSteps(), dn = pathDone(), d = new Date();
    const hg = $("[data-hh1]"); if (!hg.firstElementChild) hg.innerHTML = `<span data-hgreet></span><span data-hname></span>.`;
    $("[data-hgreet]").textContent = greet();
    put($("[data-hsum]"), `<span class="d">${DAYS[d.getDay()]}, ${MONL[d.getMonth()]} ${d.getDate()} · </span>this week's step is ${dn} of ${st.length} done`);
    // hero: the story you were reading, else this week's
    const last = ls.get("lv-last"), L = last && S[last.slug] && S[last.slug].status === "ready" && stateOf(S[last.slug]) !== "new" && !doneOf(last.slug) ? S[last.slug] : null, H = L || W;
    if (H) { const n = nph(H), ph = L ? Math.min(n, last.ph || 1) : 1, names = (CL[H.slug] || {}).phase_names || [], k = Math.min(seen(H.slug).length, n), left = Math.max(1, Math.round(H.read * (n - k) / n));
      const href = L ? `${H.href}#ph${ph}` : H.href, when = L ? `Phase ${ph} of ${n} · ${left} min left` : `Free this week · ${H.read} min read`;
      put($("[data-hhero]"), `<div class="hmedia"><a class="cv hcv" href="${href}" tabindex="-1" aria-hidden="true"><img src="${esc(COV[H.slug] || "")}" alt="" width="960" height="540"></a>`
        + `<div class="hht"><p class="rhm">${tile(H, 24)}<b>${esc(H.name)}</b><span class="mo"> · ${when}</span>${chip(H.hl)}${staleChip(H)}<span class="r">${when}</span></p>`
        + `<h2><a href="${href}">${esc(L ? names[ph - 1] || H.title : H.title || H.name)}</a></h2>${stepper(H, L ? ph : 0, true)}`
        + (L ? `<p class="hpb">${bar(k / n)}<span>${k} of ${n}</span></p>` : "")
        + `<p class="hd">${esc(H.what)}</p><p class="hst"><b>${esc(H.hv)}</b><span>${esc([unit(H), H.hs, H.hd].filter(Boolean).join(" · "))}</span></p></div></div>`
        + `<div class="hact"><a class="btn btn-p" href="${href}">${L ? "Continue reading" : "Read this week's story"}${ARW}</a><a class="btn btn-s" href="${H.href}#phases">All phases</a></div>`); }
    // this week's step: three steps of the path around the next open one (same ticks as the story's checklist)
    const hs = $("[data-hstep]"), i0 = st.findIndex(s => !s.done), a = Math.max(0, Math.min(i0 < 0 ? st.length - 3 : i0 - 1, st.length - 3)), rows = st.slice(a, a + 3);
    const key = D.path.source + ":" + rows.map(s => s.id || s.n).join(",");
    if (hs.dataset.k !== key) { hs.dataset.k = key; hs.classList.remove("sk");
      hs.innerHTML = `<div class="ch"><h2>This week's step</h2><span class="meta em" data-hsc></span></div><span class="bar"><i data-hsb></i></span><div class="hsl">`
        + rows.map(s => `<button class="hck" type="button" role="checkbox" aria-checked="false" ${s.extra ? "data-hx" : `data-hck="${D.path.source}:${s.n - 1}"`}><span class="bx">${CKS}</span><span class="ct">${esc(s.task || s.text)}</span></button>`).join("")
        + `</div><p class="hsn">From the ${esc(srcName())} story.${adult ? "" : " Small steps that fit around school."} <a class="tl" href="/app/path/">Open my path</a></p>`; }
    $$(".hck", hs).forEach((b, j) => b.setAttribute("aria-checked", !!rows[j].done));
    $("[data-hsc]", hs).innerHTML = `${dn} of ${st.length}<span class="d"> done</span>`; $("[data-hsb]", hs).style.setProperty("--w", (dn / st.length * 100) + "%");
    // ask: goes to Ask LaunchVault with the question filled in (not sent until you press send there)
    const ha = $("[data-hask]"); if (!ha.firstChild) ha.innerHTML = `<div class="ch"><h2>Ask about your idea</h2><span class="meta em" data-askleft></span></div>`
      + `<p class="hasrc"><span class="tiles">${READY.slice(0, 4).map(s => tile(s, 22)).join("")}</span><span>Answers come from ${READY.length} stories and your website</span></p>`
      + `<form class="askf" action="/app/assistant/" method="get"><label class="sr" for="hq">Ask about your idea</label><input id="hq" name="q" placeholder="Ask about your idea..." autocomplete="off" maxlength="400" required><button type="submit" aria-label="Ask">${UP}</button></form>`
      + `<div class="chips">${["What should I charge?", "Where do I post it?"].map(t => `<a href="/app/assistant/?q=${encodeURIComponent(t)}">${t}</a>`).join("")}</div>`;
    // my path: stories in progress first, then the ones matched to you
    const prog = READY.filter(s => stateOf(s) === "prog").sort((x, y) => (y.slug === (last || {}).slug) - (x.slug === (last || {}).slug));
    const pr = [...new Set([...prog, ...matches().map(k => S[k])])].filter(s => s && !doneOf(s.slug)).slice(0, 3);
    put($("[data-hpath]"), `<div class="ch"><h2>My path</h2><a class="tl" href="/app/path/">See all</a></div><div class="hpl">`
      + pr.map(s => { const n = nph(s), k = Math.min(seen(s.slug).length, n);
        return `<a class="hpr" href="${s.href}">${cov(s, "cv th")}<span class="m"><span class="t"><b>${esc(s.name)}</b><small>${k ? `<span class="mo">Phase </span>${k} of ${n}` : "Not started"}</small></span>${bar(k / n)}</span>${ARW}</a>`; }).join("")
      + `</div>` + (q ? "" : `<p class="hsn"><a class="tl" href="/app/start/?quiz=1">Take the 2-minute quiz</a> to get a path that fits you.</p>`));
    // read next: matched stories after the quiz, else the newest; never the hero story
    const heroSlug = H ? H.slug : WEEKS, pool = [...(q ? matches() : []), ...READY.map(s => s.slug)].filter(k => k !== heroSlug);
    $("[data-hrowt]").textContent = q ? "Matched to you" : "Read next";
    put(hcards, [...new Set(pool)].map(k => S[k]).filter(s => s && s.status === "ready").slice(0, 4).map(nextCard).join(""));
  };
  // my path page: where you are in each story (Paper My path). Three plain counts, no scores.
  const renderTL = () => { const tl = $("[data-ptl]"); if (!tl) return;
    const sv = savedList(), m = matches(), rank = s => doneOf(s.slug) ? 3 : stateOf(s) === "prog" ? 0 : m.includes(s.slug) ? 1 : sv.includes(s.slug) ? 2 : 9;
    const L = READY.filter(s => rank(s) < 9).sort((x, y) => rank(x) - rank(y)), KEY = ["prog", "next", "saved", "done"], LAB = ["In progress", "Up next", "Saved", "Finished"];
    const tk = D.checklists.reduce((n, c) => n + ticks(c.slug).filter(Boolean).length, 0), started = READY.filter(s => stateOf(s) !== "new").length, seenPh = READY.reduce((n, s) => n + Math.min(nph(s), seen(s.slug).length), 0);
    const stat = (v, l, i) => `<div class="card pst"><span class="ico">${svgI(PI[i], 19)}</span><div><b data-count="${v}">${v}</b><span>${l}</span></div></div>`;
    put($("[data-pstats]"), stat(tk, "Steps done", "list") + stat(started, "Stories started", "lib") + stat(seenPh, "Lessons seen", "ready"));
    put(tl, L.map(s => { const r = rank(s), n = nph(s), k = r === 3 ? n : Math.min(seen(s.slug).length, n), names = (CL[s.slug] || {}).phase_names || [];
      const nx = r === 3 ? "Finished" : r === 0 ? (names[k] ? "Next: " + names[k] : "Last phase") : r === 1 ? "Starts with: " + (names[0] || s.pattern) : "Saved for later";
      return `<a class="tlr" data-k="${KEY[r]}" href="${s.href}"><span class="dot" aria-hidden="true"></span><span class="card tlc">${cov(s, "cv th")}<span class="m"><span class="t"><b>${esc(s.name)}</b><em>${LAB[r]}</em></span><small>${esc(nx)}</small>${k ? bar(k / n) : ""}</span></span></a>`; }).join("")); };

  // ---------- saved: one empty state (what it is, how to fill it, three stories to star), else the two lists ----------
  const renderSaved = () => { const sc = $("[data-savedcards]"); if (!sc) return;
    const L = savedList().map(k => S[k]).filter(Boolean);
    const I = savedItems().map(k => { const [slug, i] = k.split(":"), c = CL[slug]; return c && c.items[+i] ? {k, c, i: +i, it: c.items[+i]} : null; }).filter(Boolean);
    $("[data-savedsec]").hidden = !L.length; $("[data-savedsec2]").hidden = !I.length;
    $("[data-savedcount]").textContent = L.length ? `${L.length} saved` : "";
    sc.innerHTML = L.map(s => nextCard(s, true)).join("");
    $("[data-saveditems]").innerHTML = I.map(({k, c, i, it}) => { const tk = ticks(c.slug)[i];
      return `<div class="svr"><a href="${c.href}#todo">${tile(c, 26)}<span class="m"><b>${esc(it.text)}</b><span class="s"><small>${esc(c.name)} · step ${i + 1}</small><span class="svp${tk ? " on" : ""}">${tk ? "Ticked" : "To do"}</span></span></span></a><button class="ckstar" type="button" data-staritem="${k}" aria-pressed="true" aria-label="Remove this step">${STAR}</button></div>`; }).join("");
    { const set = (q, v) => { const n = $(q); if (n) n.textContent = v; }, any = L.length || I.length, seg = $("[data-svseg]"), note = $("[data-savednote]"), pg = $(".svd");
      set("[data-savedcount2]", I.length ? `${I.length} saved` : ""); set("[data-svn1]", L.length); set("[data-svn2]", I.length);
      if (seg) seg.hidden = !(L.length && I.length); if (note) note.hidden = !any;
      if (pg) pg.dataset.sv = !L.length && I.length ? "steps" : !I.length ? "stories" : pg.dataset.sv; }
    const sug = [...new Set([WEEKS, ...matches()])].map(k => S[k]).filter(Boolean).slice(0, 3);
    $("[data-savedempty]").innerHTML = L.length || I.length ? "" : emptyCard("star", "Nothing saved yet", "Star a story or a checklist step to keep it here.", "/app/library/", "Browse the Library")
      + (sug.length ? `<section class="hsec lvsug"><div class="sech"><h2>Stories to start with</h2></div><div class="scards rn">${sug.map(s => nextCard(s, true)).join("")}</div></section>` : ""); };
  // warm empty state: icon badge, one honest sentence, one primary action (and an optional secondary)
  function emptyCard(icon, h, p, href, label, extra = "") {
    return `<section class="card lvempty"><span class="lvebadge">${svgI(PI[icon], 24)}</span><h2>${esc(h)}</h2><p>${esc(p)}</p><div class="lveact">${href ? `<a class="btn btn-p" href="${href}">${esc(label)} <span class="arr" aria-hidden="true">→</span></a>` : ""}${extra}</div></section>`; }

  // ---------- library: cards only, ready stories only. Filters live in the URL (?tab=&pat=&lp=&sort=&q=), so a reload or a shared link keeps them ----------
  const lout = $("#lout");
  const drawLib = () => {};
  let libDraw = drawLib;
  if (lout) {
    const qs = new URLSearchParams(location.search), DEF = {q: "", tab: "all", pat: "", sort: "new", lp: ""};
    const url = Object.fromEntries(Object.keys(DEF).filter(k => qs.get(k) != null).map(k => [k, qs.get(k)]));
    if (qs.get("pattern")) url.pat = qs.get("pattern");   // older links from the search box
    const st = Object.assign({}, DEF, Object.keys(url).length ? {} : ls.get("lv-lib", {}), url);
    const pats = [...new Set(READY.map(s => s.pattern))].sort((a, b) => a.localeCompare(b));
    $("#lpat").insertAdjacentHTML("beforeend", pats.map(p => `<option>${esc(p)}</option>`).join(""));
    if (!pats.includes(st.pat)) st.pat = "";
    if (st.tab !== "all" && !D.tabs[st.tab]) st.tab = "all";
    if (!["new", "mrr", "growth", "read"].includes(st.sort)) st.sort = "new";
    if (!["", "prog", "done", "saved"].includes(st.lp)) st.lp = "";
    const ctl = () => { if ($("#lq").value !== st.q) $("#lq").value = st.q; $("#lpat").value = st.pat; $("#lsort").value = st.sort;
      $$("[data-tab]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === st.tab)); $$("[data-lp]").forEach(b => b.setAttribute("aria-pressed", b.dataset.lp === (st.lp || ""))); };
    libDraw = () => {
      ls.set("lv-lib", st); ctl();
      const p = new URLSearchParams(); Object.keys(DEF).forEach(k => { if (st[k] !== DEF[k]) p.set(k, st[k]); });
      try { history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "") + location.hash); } catch {}
      const q = st.q.trim().toLowerCase(), sv = savedList();
      let L = READY.filter(s => (st.tab === "all" || s.tab === st.tab) && (!st.pat || s.pattern === st.pat)
        && (!st.lp || (st.lp === "saved" ? sv.includes(s.slug) : stateOf(s) === st.lp))
        && (!q || [s.name, s.what, s.pattern, s.title, s.first, ...(s.lessons || [])].join(" ").toLowerCase().includes(q)));
      const key = {new: s => (s.published || "") + (s.stale ? "0" : "1") + String(1e9 - D.stories.indexOf(s)).padStart(10, "0"), mrr: s => s.mrr || 0, growth: s => s.growth == null ? -1e9 : s.growth, read: s => -(s.read || 99)}[st.sort] || (s => s.published || "");
      L.sort((a, b) => key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0);
      $("[data-lcount]").textContent = L.length === READY.length ? `${READY.length} breakdowns` : `${L.length} of ${READY.length} breakdowns`;
      $("[data-lfcount]").textContent = `Show ${L.length} breakdown${L.length === 1 ? "" : "s"}`;
      const nf = (st.pat ? 1 : 0) + (st.lp ? 1 : 0) + (st.sort !== "new" ? 1 : 0), badge = $("[data-lfn]"); badge.hidden = !nf; badge.textContent = nf;
      $("#lfopen").setAttribute("aria-label", nf ? `Filters, ${nf} on` : "Filters");
      $("#lclear").hidden = !(st.q || st.tab !== "all" || st.pat || st.lp || st.sort !== "new");
      lout.innerHTML = L.length ? L.map(storyCard).join("") : emptyCard("search", "No stories match these filters", st.lp === "saved" && !sv.length ? "You haven't starred a story yet. Clear the filters to see every breakdown." : "Try a different word or pattern, or clear the filters to see every breakdown.", "", "", '<button class="btn btn-p" type="button" data-clearall>Clear filters</button>');
    };
    $("#lq").addEventListener("input", e => { st.q = e.target.value; libDraw(); });
    $("#lpat").addEventListener("change", e => { st.pat = e.target.value; libDraw(); });
    $("#lsort").addEventListener("change", e => { st.sort = e.target.value; libDraw(); });
    $$("[data-tab]").forEach(b => b.addEventListener("click", () => { st.tab = b.dataset.tab; libDraw(); }));
    $$("[data-lp]").forEach(b => b.addEventListener("click", () => { st.lp = b.dataset.lp; libDraw(); }));
    const clear = () => { Object.assign(st, DEF); libDraw(); };
    $("#lclear").addEventListener("click", clear); lout.addEventListener("click", e => { if (e.target.closest("[data-clearall]")) clear(); });
    // phones: the same controls open as a bottom sheet (a native dialog: focus stays inside, Esc closes). Wider screens show them in the row.
    const dlg = $("#lfs");
    $("#lfopen").addEventListener("click", () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); });
    dlg.addEventListener("click", e => { if (e.target.closest("[data-lfclose]") || (e.target === dlg && e.clientY < dlg.getBoundingClientRect().top)) dlg.close(); });
  }

  // ---------- reader: lessons seen (a phase counts after 1 s at half visible), story check ----------
  if (rd && "IntersectionObserver" in window) {
    const slug = rd.dataset.reader, nm = (S[slug] || {}).name || slug, tmr = new Map();
    if (S[slug]) { const l = ls.get("lv-last"); if (!l || l.slug !== slug) ls.set("lv-last", {slug, ph: 1, t: Date.now()}); }
    const mark = p => { const v = seen(slug); ls.set("lv-last", {slug, ph: p, t: Date.now()}); if (v.includes(p)) return;
      ls.set("lv-seen-" + slug, [...v, p].sort((a, b) => a - b)); logAct(`Saw phase ${p} of ${nm}`); if (v.length + 1 === +rd.dataset.phases) logAct(`Saw every phase of ${nm}`); };
    const io = new IntersectionObserver(es => es.forEach(e => { const p = +e.target.dataset.ph;
      if (e.isIntersecting && e.target.open !== false && (e.intersectionRatio >= .5 || e.intersectionRect.height >= innerHeight * .5)) { if (!tmr.has(p)) tmr.set(p, setTimeout(() => mark(p), 1000)); }
      else { clearTimeout(tmr.get(p)); tmr.delete(p); } }), {threshold: [0, .25, .5, .75, 1]});
    $$(".ph[data-ph]", rd).forEach(p => { if (!p.closest(".fade")) io.observe(p); });
  }
  if (rd) {   // phases fold on phones (first open); the section chips follow the scroll
    if (innerWidth < 600) $$("details.ph", rd).forEach((d, i) => { if (i && !(location.hash === "#" + d.id)) d.open = false; });
    if (innerWidth < 600) $$("details.cow", rd).forEach(d => { if (location.hash !== "#" + d.id) d.open = false; });
    const hp = location.hash && document.getElementById(location.hash.slice(1)); if (hp && hp.tagName === "DETAILS") hp.open = true;
    const nav = $(".snav-in"); let lastOn = null, gq = 0;
    // the section pill slides along the strip as you read (another script moves .on; follow it once per frame)
    // a soft right-edge fade only while more sections are off to the right (reads as "scroll", not as cut-off text)
    const edge = () => nav && nav.classList.toggle("more", nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2);
    if (nav) { nav.addEventListener("scroll", edge, {passive: true}); addEventListener("resize", edge); requestAnimationFrame(edge); if (document.fonts) document.fonts.ready.then(edge); }
    if (nav) { requestAnimationFrame(() => glide(nav, "a.on")); if (document.fonts) document.fonts.ready.then(() => glide(nav, "a.on")); addEventListener("load", () => glide(nav, "a.on")); addEventListener("scroll", () => { if (!gq) gq = requestAnimationFrame(() => { gq = 0; glide(nav, "a.on"); }); }, {passive: true}); }
    addEventListener("scroll", () => { const on = nav && $("a.on", nav); if (on && on !== lastOn) { lastOn = on; nav.scrollTo({left: on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2, behavior: reduce ? "auto" : "smooth"}); } }, {passive: true});
  }
  // "Mark as read": one click logs the story complete in lv-done-<slug>; click again to undo. No quiz.
  const CKI = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  $$("[data-donebox]").forEach(box => {
    const slug = box.dataset.donebox, me = S[slug] || {}, nm = me.name || slug;
    // read next: a quiz match first, else the newest story not started, else any story not done
    const nextStory = () => { const q = quiz(), open = s => s && s.status === "ready" && s.slug !== slug && !doneOf(s.slug);
      return ((q && q.matches) || []).map(k => S[k]).find(open) || READY.find(s => open(s) && stateOf(s) === "new") || READY.find(open); };
    const paint = () => { const d = doneOf(slug), n = nph(me), k = Math.min(n, seen(slug).length), nx = nextStory();
      box.classList.toggle("fin", !!d);
      box.innerHTML = `<div class="dbar"><div class="dtxt"><b>${d ? "You've read this breakdown" : "Finished reading?"}</b><span>${d ? `Logged ${(t => MON[t.getMonth()] + " " + t.getDate() + " " + t.getFullYear())(new Date(d.t))}. Click again to undo.` : `${k} of ${n} phases seen.`}</span></div>`
        + `<button class="btn ${d ? "btn-s dok" : "btn-p"}" type="button" data-markread aria-pressed="${!!d}">${d ? CKI + "Completed" : "Mark as read"}</button></div>`
        + (nx ? `<a class="dnext" href="${nx.href}"><span><small>Read next</small><b>${esc(nx.title || nx.name)}</b></span><i aria-hidden="true">→</i></a>` : ""); };
    box.addEventListener("click", e => { if (!e.target.closest("[data-markread]")) return;
      // ponytail: stored as how "check" because the synced progress table only accepts 'check' | 'feedback'; add 'read' there if it ever matters
      if (doneOf(slug)) { try { localStorage.removeItem("lv-done-" + slug); } catch {} }
      else { ls.set("lv-done-" + slug, {how: "check", t: Date.now()}); logAct(`Read ${nm}`); }
      dispatchEvent(new Event("lv:changed")); renderAll(); paint(); $("[data-markread]", box).focus(); });
    paint();
  });

  // right rail ticks: a section is done when its phases are all seen / its steps all ticked / the story is logged complete
  const railDone = () => { if (!rd) return; const slug = rd.dataset.reader, t = ticks(slug), ok = {phases: seen(slug).length >= +rd.dataset.phases, todo: t.length > 0 && t.every(Boolean), done: !!doneOf(slug)};
    $$("[data-rdone]").forEach(n => n.hidden = !ok[n.dataset.rdone]); };
  // coming-soon page: two finished breakdowns of the same type (any ready story fills a gap)
  // app 404: this week's story and the two newest others
  const renderNF = () => $$("[data-nfcards]").forEach(n => { n.innerHTML = [S[WEEKS], ...READY.filter(s => s.slug !== WEEKS)].filter(Boolean).slice(0, 3).map(s => nextCard(s)).join(""); });
  const renderSoon = () => $$("[data-sooncards]").forEach(n => { const L = READY.filter(s => s.tab === n.dataset.sooncards); n.innerHTML = L.concat(READY.filter(s => !L.includes(s))).slice(0, 2).map(s => nextCard(s)).join(""); });
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');   // an in-page link opens any folded panel its target sits in
    if (a && a.hash.length > 1) for (let d = document.getElementById(a.hash.slice(1)); d; d = d.parentElement) if (d.tagName === "DETAILS") d.open = true;
    const m = e.target.closest("[data-fcmore]"); if (m) { const on = m.previousElementSibling.classList.toggle("open"); m.setAttribute("aria-expanded", on); m.textContent = on ? (m.dataset.less || "Less") : (m.dataset.more || "More"); }
    const tb = e.target.closest("[data-showtab]"); if (tb) { const d = tb.closest(".lvchart").querySelector(".ctab"); if (d) { d.open = true; d.scrollIntoView({block: "nearest"}); } }
  });
  // chart.js blocked or failed to load: say so and point at the table (chart.js handles its own runtime errors the same way)
  addEventListener("load", () => $$(".lvchart").forEach(r => { const pl = $(".plot", r); if (!pl || $("svg", pl).childElementCount || $(".cfail", r)) return;
    pl.hidden = true; pl.insertAdjacentHTML("afterend", '<div class="cfail" role="status"><span>The chart didn\'t load. Reload, or read the table.</span><button class="btn btn-s" type="button" data-showtab>Show the table</button></div>'); }));
  const renderAll = () => { renderHome(); renderTL(); renderSaved(); renderSoon(); renderNF(); libDraw(); syncStars(); paint(); railDone(); };
  addEventListener("storage", renderAll);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) renderAll(); });
  addEventListener("lv:changed", () => { clearTimeout(renderAll.t); renderAll.t = setTimeout(() => { renderHome(); renderSaved(); syncStars(); railDone(); }, 50); });

  // ---------- my path: one route, one open step at a time ----------
  const stepsEl = $("[data-steps]"); let openStep = null;
  function renderPath() {
    if (!stepsEl) return; const st = pathSteps(), q = quiz(), src = CL[D.path.source], dn = pathDone();
    if (openStep == null) openStep = st.findIndex(s => !s.done);
    const nxi = st.findIndex(s => !s.done);
    const sp = $("[data-pathstate]"); if (sp) sp.innerHTML = pill(statusKey(dn, st.length));
    stepsEl.innerHTML = st.map((s, i) => { const open = i === openStep;
      const link = s.extra ? (s.href ? `<a class="tl" href="${s.href}">${esc(s.from)}: open the breakdown</a>` : "") : `<a class="tl" href="${src.href}#${s.ph ? "ph" + s.ph : "todo"}">Open in the ${esc(src.name)} breakdown${s.ph ? ", phase " + esc(s.from) : ""}</a>`;
      return `<div class="rstep${open ? " open" : ""}${s.done ? " done" : ""}"><button class="rsh" type="button" data-stepopen="${i}" aria-expanded="${open}"><span class="dot">${s.done ? CKS : i + 1}</span><span class="rst">${esc(s.task || s.text)}</span>${s.done ? pill("done", s.date ? "Done " + s.date : "Completed") : i === nxi ? pill("prog", "Up next") : ""}</button>`
        + (open ? `<div class="rsb">${s.task ? `<p class="fs">From the story: ${esc(s.text)}</p>` : ""}${s.why ? `<p class="why"><b>Why:</b> ${esc(s.why)}</p>` : ""}<div class="rsa"><button class="btn ${s.done ? "btn-s" : "btn-p"}" type="button" data-step${s.done ? "undo" : "done"}="${i}">${s.done ? "Mark as not done" : "Mark step done"}</button>${link}</div></div>` : "") + "</div>"; }).join("");
    $$("[data-pathtitle]").forEach(n => n.textContent = q ? D.path.title : "A starter path");
    const ps = $("[data-pathsrc]"); if (ps) ps.innerHTML = `<img src="${esc(src.logo)}" alt="" width="16" height="16" style="vertical-align:-3px;margin-right:6px;border-radius:4px">From the ${esc(src.name)} breakdown`;
    const pc = $("[data-pathcount3]"); if (pc) pc.textContent = `${dn} of ${st.length} steps`;
    const pq = $("[data-pquiz]"); if (pq) pq.hidden = !!q;
    const ed = $("[data-editq]"); if (ed) ed.textContent = q ? "Edit answers" : "Take the quiz";
    const m = $("[data-matched]"); if (m) { m.hidden = !q; if (q) m.innerHTML = q.top && q.why && q.why.length ? `<span>Matched on</span>${q.why.slice(0, 4).map(x => `<span class="wc">${esc(x)}</span>`).join("")}` : "<span>No single story matched your answers, so this is the general path.</span>"; }
    $$("[data-likeyou]").forEach(n => n.innerHTML = matches().map(miniRow).join(""));
    paint();
  }
  if (stepsEl) {
    stepsEl.addEventListener("click", e => {
      const o = e.target.closest("[data-stepopen]");
      if (o) { const i = +o.dataset.stepopen; openStep = openStep === i ? -1 : i; renderPath(); const b = $(`[data-stepopen="${i}"]`, stepsEl); if (b) b.focus(); return; }
      const d = e.target.closest("[data-stepdone],[data-stepundo]"); if (!d) return;
      const i = +(d.dataset.stepdone ?? d.dataset.stepundo), s = pathSteps()[i];
      openStep = s.done ? i : null;   // after finishing a step the next open one unfolds; undoing keeps this one open
      if (s.extra) { const v = s.done ? null : today(); ls.set("lv-path-extra", v); renderPath(); toast(v ? "Step done. " + savedTo() : "Step reopened."); }
      else toggleTick(D.path.source, s.n - 1);
    });
    renderPath();
  }

  // ---------- checklists page: a "Next up" card, then one accordion per story (in progress first, then this week's) ----------
  // ---------- checklists page (Paper Checklists): one card per story with its image; To do / Done ----------
  const cls = $("[data-cllists]");
  if (cls && !D.checklists.length) cls.innerHTML = emptyCard("list", "No checklists yet", "Every story ends with one. Open the Library to start ticking.", "/app/library/", "Browse the Library");
  else if (cls) {
    const cnt = c => ticks(c.slug).filter(Boolean).length, inprog = c => { const n = cnt(c); return n > 0 && n < c.items.length; };
    const order = D.checklists.slice().sort((a, b) => (inprog(b) - inprog(a)) || ((b.slug === WEEKS) - (a.slug === WEEKS)));
    cls.innerHTML = order.map(c => `<section class="card ckc" data-ckcard="${c.slug}"><a class="cv ckcv" href="${c.href}#todo" tabindex="-1" aria-hidden="true">${COV[c.slug] ? `<img src="${esc(COV[c.slug])}" alt="" width="960" height="540" loading="lazy">` : ""}</a>`
      + `<div class="ckb"><div class="ckt">${tile(c, 28)}<span class="nm"><b>${esc((S[c.slug] || {}).pattern || c.name)}</b><small>From <a href="${c.href}">${esc(c.name)}</a></small></span><span class="ckn" data-ckc="${c.slug}"></span></div>${ckListHTML(c)}</div></section>`).join("")
      + `<p class="ckempty" hidden>Nothing here yet. Tick a step and it shows up in Done.</p>`;
    const sync = () => { let td = 0, dn = 0; order.forEach(c => { const t = ticks(c.slug), k = t.filter(Boolean).length, el = $(`[data-ckcard="${c.slug}"]`, cls); td += t.length - k; dn += k; el.dataset.all = k === t.length; el.dataset.none = k === 0; });
      $("[data-cktodo]").textContent = td; $("[data-ckdone]").textContent = dn; $(".ckempty", cls).hidden = !(cls.dataset.f === "done" ? dn === 0 : td === 0); };
    sync(); addEventListener("lv:changed", sync);
    $$("[data-ckf]").forEach(b => b.addEventListener("click", () => { cls.dataset.f = b.dataset.ckf; $$("[data-ckf]").forEach(x => x.setAttribute("aria-pressed", x === b)); sync(); }));
  }

  // ---------- account ----------
  const bd = $("#bday");
  if (bd) {   // Settings > Profile > Birthday: same rule as the gate (assets/gate.js). The age range the rules read is re-derived from it.
    const G = window.LVGate || {}, note = $("[data-agenote]"), NOTE = note.textContent;
    if (G.today) bd.max = G.today();
    bd.value = ls.get("lv-dob") || ""; if (!bd.value) note.textContent = "Add your birthday so the right rules apply. " + NOTE;
    bd.addEventListener("change", () => { const v = bd.value; if (!v) return;
      const r = G.rangeForDob ? G.rangeForDob(v) : null;
      if (!r) { note.textContent = "LaunchVault is for ages 13 and up, so that date can't be saved."; bd.value = ls.get("lv-dob") || ""; return; }
      note.textContent = NOTE; held(); });
    // the stated monthly prices lead; yearly is the secondary line (and the other way round on the Yearly toggle)
    const bill = y => { $$("[data-bill]").forEach(b => b.setAttribute("aria-pressed", (b.dataset.bill === "y") === y));
      $('[data-pr="pro"]').textContent = y ? "$6.49" : "$7.99"; $('[data-pr="developer"]').textContent = y ? "$23.99" : "$29.99";
      $('[data-ps="pro"]').textContent = y ? "a month, billed yearly ($77.88). Monthly is $7.99" : "a month, or $6.49 a month billed yearly ($77.88)";
      $('[data-ps="developer"]').textContent = y ? "a month, billed yearly ($287.88). Monthly is $29.99" : "a month, or $23.99 a month billed yearly ($287.88)"; };
    $$("[data-bill]").forEach(b => b.addEventListener("click", () => bill(b.dataset.bill === "y"))); bill(false);
    // Display size: read by the zoom script in every page's head (lv-display), so it applies on every page of this device
    const disp = v => $$("[data-display]").forEach(b => b.setAttribute("aria-pressed", b.dataset.display === v)); disp(ls.get("lv-display") || "auto");
    let dispV = ls.get("lv-display") || "auto";
    $$("[data-display]").forEach(b => b.addEventListener("click", () => { dispV = b.dataset.display; disp(dispV); held(); }));
    // Preferences: welcome answers (this device) are the base; notes Ask LaunchVault saved live on the account (profiles.assistant_notes)
    { const base = $("[data-pref-base]"), box = $("[data-pref-notes]");
      if (base) { const q = quiz(); base.textContent = q && q.summary ? q.summary : "Not answered yet"; }
      if (box) (async () => {
        const c = window.LVAuth && LVAuth.live ? await LVAuth.load().catch(() => null) : null;
        if (!c || !c.user) { box.innerHTML = `<p class="prefe">Sign in to see what Ask LaunchVault remembers.</p>`; return; }
        for (let i = 0; i < 40 && !window.LVSync; i++) await new Promise(r => setTimeout(r, 250));
        const sb = window.LVSync ? await LVSync.make(c).catch(() => null) : null; if (!sb) return;
        let notes = [];
        const save = async next => { const {error} = await sb.from("profiles").update({assistant_notes: next}).eq("user_id", c.user.id);
          if (error) return toast("Couldn't save. Try again."); notes = next; draw(); };
        const draw = () => { box.innerHTML = notes.length
          ? notes.map((n, i) => `<div class="prefn"><span>${esc(n)}</span><button class="tl" type="button" data-rmnote="${i}" aria-label="Remove: ${esc(n)}">Remove</button></div>`).join("")
            + `<div class="prefa"><button class="tl" type="button" data-clrnotes>Clear all</button></div>`
          : `<p class="prefe">Nothing saved from chats yet. Tell <a href="/app/assistant/">Ask LaunchVault</a> about your project and it keeps the useful parts here.</p>`; };
        box.addEventListener("click", e => { const r = e.target.closest("[data-rmnote]"); if (r) { const i = +r.dataset.rmnote; r.closest(".prefn").classList.add("bye"); return setTimeout(() => save(notes.filter((_, j) => j !== i)), reduce ? 0 : 180); }
          if (e.target.closest("[data-clrnotes]") && confirm("Clear everything Ask LaunchVault remembers?")) save([]); });
        const {data} = await sb.from("profiles").select("assistant_notes").eq("user_id", c.user.id).maybeSingle();
        notes = (data && data.assistant_notes) || []; draw();
      })(); }
    const prefs = Object.assign({new_story: false, path: false, news: false}, ls.get("lv-prefs", {}));
    $$("[data-pref]").forEach(b => { b.setAttribute("aria-checked", !!prefs[b.dataset.pref]); b.addEventListener("click", () => { prefs[b.dataset.pref] = !prefs[b.dataset.pref]; b.setAttribute("aria-checked", prefs[b.dataset.pref]); held(); }); });
    // ---------- nothing in Settings saves as you go: changes are held until Save. The bar at the bottom offers Save or Discard,
    //            goes red and shakes if you try to leave, and Discard asks first. (The public profile form saves through the same bar.) ----------
    const ppf = $("[data-pp-form]"), ppNow = () => JSON.stringify(["#ppName", "#ppUser", "#ppBio"].map(q => ($(q) || {}).value || ""));
    const ppDirty = () => !!ppf && !ppf.hidden && ppf.dataset.clean != null && (ppf.dataset.ppav === "1" || ppf.dataset.clean !== ppNow());
    const snap = () => JSON.stringify([ls.get("lv-dob") || "", Object.assign({new_story: false, path: false, news: false}, ls.get("lv-prefs", {})), ls.get("lv-display") || "auto"]);
    const mine = () => JSON.stringify([bd.value || ls.get("lv-dob") || "", prefs, dispV]);
    const dirty = () => mine() !== snap() || ppDirty();
    const bar = document.createElement("div"); bar.className = "savebar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Unsaved changes"); bar.hidden = true;
    bar.innerHTML = '<p data-sbmsg role="status">You have unsaved changes</p><button class="btn btn-s" type="button" data-sbno>Discard</button><button class="btn btn-p" type="button" data-sbyes>Save changes</button>';
    document.body.appendChild(bar);
    const sbm = $("[data-sbmsg]", bar);
    function held() { const d = dirty(); if (d) sbm.textContent = "You have unsaved changes"; bar.hidden = !d; if (!d) bar.classList.remove("warn"); }
    const nudge = () => { bar.classList.remove("warn"); void bar.offsetWidth; bar.classList.add("warn"); sbm.textContent = "Save or discard your changes first"; };
    if (ppf) { ppf.addEventListener("input", held); new MutationObserver(held).observe(ppf, {attributes: true, attributeFilter: ["data-clean", "data-ppav", "hidden"]}); }
    const revert = () => { bd.value = ls.get("lv-dob") || ""; Object.assign(prefs, {new_story: false, path: false, news: false}, ls.get("lv-prefs", {}));
      $$("[data-pref]").forEach(b => b.setAttribute("aria-checked", !!prefs[b.dataset.pref])); dispV = ls.get("lv-display") || "auto"; disp(dispV);
      if (ppf) ppf.dispatchEvent(new Event("lv:pp-reset")); held(); };
    $("[data-sbyes]", bar).addEventListener("click", () => {
      if (mine() !== snap()) { const v = bd.value, r = v && window.LVGate && LVGate.rangeForDob ? LVGate.rangeForDob(v) : null;
        if (v && r) { ls.set("lv-dob", v); ls.set("lv-age", r); }
        ls.set("lv-prefs", prefs); dispV === "auto" ? ls.del("lv-display") : ls.set("lv-display", dispV); if (window.lvZoom) lvZoom(); }
      if (ppDirty()) { ppf.requestSubmit(); sbm.textContent = "Saving…"; return; }   // the form reports its own result; the bar leaves when it is clean again
      held(); });
    $("[data-sbno]", bar).addEventListener("click", () => {
      const d = document.createElement("dialog"); d.className = "rdlg sbdlg"; d.setAttribute("aria-labelledby", "sbh");
      d.innerHTML = '<form method="dialog"><h2 id="sbh">Discard your changes?</h2><p>Everything you changed on this page goes back to how it was.</p><div class="sbdr"><button class="btn btn-s" value="no" autofocus>Cancel</button><button class="btn sbred" value="yes">Discard</button></div></form>';
      document.body.appendChild(d); d.addEventListener("close", () => { if (d.returnValue === "yes") revert(); d.remove(); }); d.showModal(); });
    // leaving with changes held: the link doesn't open, the bar asks instead (same-page section links are fine)
    document.addEventListener("click", e => { const a = e.target.closest("a[href]"); if (!a || bar.hidden || a.target === "_blank" || a.closest(".savebar,dialog")) return;
      const u = new URL(a.href, location.href); if (u.origin === location.origin && u.pathname === location.pathname) return;
      e.preventDefault(); e.stopPropagation(); nudge(); }, true);
    $("#dl").addEventListener("click", () => { const o = {}; ls.keys().forEach(k => o[k] = ls.get(k)); const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify({exported: new Date().toISOString(), note: "Everything LaunchVault saved on this device.", data: o}, null, 2)], {type: "application/json"}));
      a.download = "launchvault-data.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
    // Delete your data: the device is cleared straight away. assets/supabase.js listens for "lv:delete-account" when someone is signed in,
    // deletes the server copy and calls detail.done(null) (or done("server") if it couldn't). Signed out: nobody calls done.
    $("#del").addEventListener("click", () => { if (!confirm(window.LVAuth && LVAuth.email && LVAuth.email() ? "Delete your progress, quiz answers, preferences and profile from this device and your account? This can't be undone." : "Delete everything LaunchVault saved on this device? This can't be undone.")) return;
      const msg = $("[data-delmsg]"), say = t => { $("p", msg).textContent = t; };
      dispatchEvent(new CustomEvent("lv:delete-account", {detail: {done: err => say(err ? "Your device data is cleared, but we couldn't reach the server. Try again in a minute." : "Your device data is cleared. Also removed from your account.")}}));
      wiped = true; ls.keys().forEach(ls.del); try { Object.keys(sessionStorage).filter(k => k.startsWith("lv-")).forEach(k => sessionStorage.removeItem(k)); } catch {}
      say("Your device data is cleared."); msg.hidden = false; $("#del").disabled = true; $("#dl").disabled = true; $("a", msg).focus(); });
    const so = $("#so"); if (so && window.LVAuth) so.addEventListener("click", () => LVAuth.signOut());
    const nav = $$(".anav a, .anavm a"), strip = $(".anavm .snav-in");
    // the section in view is highlighted in both navs; at the very bottom the last section wins (it may never reach the top)
    const H = ["#profile", "#plan", "#email", "#prefs", "#site", "#data"];   // the order the sections are in on the page (build_newapp.py ASEC)
    const mark = cur => { nav.forEach(a => { const on = a.getAttribute("href") === cur; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
      const on = strip && $("a.on", strip); if (on && strip.scrollWidth > strip.clientWidth) strip.scrollTo({left: on.offsetLeft - 16, behavior: reduce ? "auto" : "smooth"});
      glide($(".acc .anav"), "a.on"); glide(strip, "a.on"); };
    // a section counts as current once its top passes ~a third of the window (a jump lands it just under the top bar, never exactly at 0)
    let lock = 0;
    const spy = () => { if (Date.now() < lock) return; const line = Math.max(200, innerHeight * 0.35); let cur = H[0];
      H.forEach(h => { const t = document.querySelector(h); if (t && !t.hidden && t.getBoundingClientRect().top < line) cur = h; });
      const box = $(".asecs"), inner = box && box.scrollHeight > box.clientHeight + 4;   // desktop: the cards scroll inside their own box
      if (inner ? box.scrollTop + box.clientHeight >= box.scrollHeight - 4 : innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = H.at(-1);
      mark(cur); };
    // a click highlights its own tab straight away and holds it while the page scrolls there
    nav.forEach(a => a.addEventListener("click", () => { mark(a.getAttribute("href")); lock = Date.now() + 1200; }));
    let spyQ = 0; const onS = () => { if (!spyQ) spyQ = requestAnimationFrame(() => { spyQ = 0; spy(); }); };
    addEventListener("scroll", onS, {passive: true}); if ($(".asecs")) $(".asecs").addEventListener("scroll", onS, {passive: true}); spy();   // once per frame, not per scroll event
  }

  // ---------- onboarding: 10 questions (Skip any) -> result -> Home. The age question is the gate (assets/gate.js), asked once, before this. ----------
  const obc = $("#obc");
  if (obc) {
    const age = ls.get("lv-age"); let step = 0, ans = ((quiz() || {}).answers || []).slice();
    while (ans.length < D.quiz.length) ans.push(null);
    const H = $("[data-obh]"), P = $("[data-obp]");
    const opt = (t, on, i) => `<button class="opt" type="button" role="radio" aria-checked="${on}" data-o="${i}"><i></i>${esc(t)}</button>`;
    const scores = () => { const sc = {}; ans.forEach((a, qi) => { if (a == null) return; const w = D.quiz[qi].w[a] || {}; for (const k in w) sc[k] = (sc[k] || 0) + w[k]; }); return sc; };
    const base = READY.map(s => s.slug);
    const score = () => { const sc = scores(); return base.slice().sort((a, b) => (sc[b] || 0) - (sc[a] || 0) || base.indexOf(a) - base.indexOf(b)).slice(0, 3); };
    // a real match needs a clear lead over every other PATTERN (two stories with one pattern always score the same); a tie or no answers is said plainly
    const topOf = () => { const sc = scores(), t = score()[0]; if (!t || !(sc[t] > 0)) return null;
      return sc[t] > Math.max(0, ...base.filter(k => S[k].pattern !== S[t].pattern).map(k => sc[k] || 0)) ? t : null; };
    const lab = (i, a) => (D.quiz[i].t ? D.quiz[i].t + ": " : "") + D.quiz[i].o[a];   // "Coding: Not yet" reads on its own
    const summary = () => [age ? "Age " + age : null, ...ans.map((a, i) => a == null ? null : lab(i, a))].filter(Boolean).join(" · ");
    const why = t => t ? ans.map((a, i) => a != null && (D.quiz[i].w[a] || {})[t] ? lab(i, a) : null).filter(Boolean) : [];
    const save = () => { const t = topOf(), m = score(); ls.set("lv-quiz-app", {answers: ans, matches: m, top: t, why: why(t), whys: Object.fromEntries(m.map(k => [k, why(k)])), summary: summary(), date: today()}); D.path = t ? pathFor(m) : PATH0; };
    const main = $(".ob"), out = $(".obout");
    const render = (dir = "f") => {
      const n = D.quiz.length; main.dataset.s = step < n ? step : "end"; obc.dataset.dir = dir;
      if (out) out.hidden = step >= n;
      if (step < n) { const Q = D.quiz[step];
        H.innerHTML = "Ten questions. <em>Under two minutes.</em>"; P.textContent = "Your answers pick 3 stories that started a lot like you. Skip any question you don't want to answer.";
        obc.innerHTML = `<div class="obq"><div class="qp"><span>${step + 1} of ${n}</span><span class="bar" role="progressbar" aria-label="Question ${step + 1} of ${n}" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${step + 1}"><i style="--w:${(step + 1) / n * 100}%;--w0:${(dir === "b" ? step + 2 : step) / n * 100}%"></i></span></div><h2 id="qh">${esc(Q.q)}</h2>${Q.h ? `<p class="qhint" id="qhint">${esc(Q.h)}</p>` : ""}<div class="opts" role="radiogroup" aria-labelledby="qh"${Q.h ? ' aria-describedby="qhint"' : ""}>${Q.o.map((o, i) => opt(o, ans[step] === i, i)).join("")}</div>
          <div class="obnav">${step ? '<button class="bk" type="button" data-back>Back</button>' : ""}<span class="sp"></span><button class="sk" type="button" data-skip>Skip</button><button class="btn btn-p" type="button" data-next>${step === n - 1 ? "See my path" : "Next"}${ARW}</button></div></div>`; }
      else { save(); ls.set("lv-pathnote", "new"); const m = score(), qq = quiz(), x = S[m[0]];
        H.innerHTML = "Your path <em>is ready.</em>";
        P.innerHTML = `${D.path.steps.length + 1} steps${ADULT() ? "" : " that fit around school"}, from the ${esc(D.path.name || "Postiz")} breakdown.`
          + (qq.top ? "" : `<small>Your answers didn't point to one story more than the others, so this is the general path. The 3 stories below are the closest.</small>`);
        const on = k => { const w = why(k).slice(0, 4); return w.length ? `<p class="obw">Matched on ${w.map(a => `<em>${esc(a)}</em>`).join(", ")}</p>` : ""; };
        obc.innerHTML = `<div class="obq obe"><section class="card obm"><div class="ch"><h2>${qq.top ? "Your top match" : "The closest stories"}</h2></div>${COV[x.slug] ? cov(x, "cv obcv") : ""}
          <div class="obmh">${tile(x, 44)}<span><b>${esc(x.name)}</b><small>${esc(x.pattern)}</small></span></div><p class="obmt">${esc(x.title || x.what)}</p>${x.first ? `<p class="obmf">First customers: ${esc(x.first)} ${chip(x.firstl)}</p>` : ""}${on(m[0])}<a class="btn btn-s" href="${x.href}">Read the ${esc(x.name)} breakdown</a></section>
          ${m.length > 1 ? `<section class="card oba"><div class="ch"><h2>Also close to your answers</h2></div><div class="obrs">${m.slice(1).map(k => { const y = S[k]; return `<a class="obr" href="${y.href}">${tile(y, 32)}<span class="m"><span class="t"><b>${esc(y.name)}</b><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span><small>${esc(y.pattern)}</small>${on(k)}</span></a>`; }).join("")}</div></section>` : ""}
          <div class="obend"><a class="btn btn-p" href="/app/path/">See my path${ARW}</a><span class="obl"><a class="tl" href="/app/">Go to Home</a><a class="tl" href="/app/start/?quiz=1">Edit answers</a></span></div><p class="fine">${savedTo()}</p></div>`; }
      if (render.n++) obc.focus({preventScroll: true});
      if (render.n > 1) scrollTo({top: 0});
    };
    render.n = 0;
    obc.addEventListener("click", e => {
      const o = e.target.closest(".opt");
      if (o) { const i = +o.dataset.o; ans[step] = ans[step] === i ? null : i; $$(".opt", obc).forEach(x => x.setAttribute("aria-checked", +x.dataset.o === i && ans[step] === i)); return; }
      if (e.target.closest("[data-next]")) { step++; render(); return; }
      if (e.target.closest("[data-skip]")) { ans[step] = null; step++; render(); return; }
      if (e.target.closest("[data-back]")) { step = Math.max(0, step - 1); render("b"); return; }
    });
    // arrows move and pick; Enter on an option picks it and goes on to the next question
    obc.addEventListener("keydown", e => { const os = $$(".opt", obc); if (!os.length) return;
      const k = os.indexOf(document.activeElement);
      if (e.key === "Enter" && k >= 0) { e.preventDefault(); if (ans[step] !== k) os[k].click(); step++; render(); return; }
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return; e.preventDefault();
      const fw = e.key === "ArrowDown" || e.key === "ArrowRight", j = k < 0 ? (fw ? 0 : os.length - 1) : (k + (fw ? 1 : -1) + os.length) % os.length;
      os[j].focus(); if (ans[step] !== j) os[j].click(); });
    render();
  }

  // ---------- report a mistake: inserts into public.reports (insert-only RLS) with the publishable key ----------
  const SB_URL = "https://azriqynpnbltvxucwmpo.supabase.co", SB_KEY = "sb_publishable_HuWp3C44Bd6dLqGW3DiaxA_qCSpDZZa";   // same public values as supabase.js
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-report]"); if (!b) return;
    const d = document.createElement("dialog"); d.className = "rdlg"; d.setAttribute("aria-labelledby", "rdh");
    d.innerHTML = `<form method="dialog"><h2 id="rdh">Report a mistake</h2><p>Tell us which number or sentence looks wrong, and why. We read every report.</p>
      <label for="rwhat">What's wrong?</label><textarea id="rwhat" required minlength="5" maxlength="2000"></textarea>
      <label for="rcontact">How can we reply? (optional)</label><input id="rcontact" maxlength="200" autocomplete="off" placeholder="Email or username">
      <p class="rmsg" role="status" aria-live="polite"></p><div class="rb"><button class="btn btn-s" type="button" data-rclose>Cancel</button><button class="btn btn-p" type="submit">Send</button></div></form>`;
    document.body.appendChild(d); d.addEventListener("close", () => { d.remove(); b.focus(); });
    $("[data-rclose]", d).addEventListener("click", () => d.close());
    const msg = $(".rmsg", d), send = $('[type="submit"]', d);
    $("form", d).addEventListener("submit", async ev => { ev.preventDefault();
      const what = $("#rwhat", d).value.trim(), contact = $("#rcontact", d).value.trim();
      if (what.length < 5) { msg.className = "rmsg err"; msg.textContent = "Please write at least a few words."; $("#rwhat", d).focus(); return; }
      send.disabled = true; msg.className = "rmsg"; msg.textContent = "Sending…";
      try {
        const r = await fetch(SB_URL + "/rest/v1/reports", {method: "POST", headers: {apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal"},
          body: JSON.stringify({story_slug: b.dataset.report || null, page: location.pathname, what, contact: contact || null})});
        if (!r.ok) throw new Error(r.status);
        msg.className = "rmsg ok"; msg.textContent = "Thanks, we'll check it."; send.hidden = true; $("[data-rclose]", d).textContent = "Close";
      } catch (err) { send.disabled = false; msg.className = "rmsg err"; msg.textContent = sendErr(err); }
    });
    d.showModal(); $("#rwhat", d).focus();
  });

  // ---------- hackathon judge code: typed on /sign-in/ (the wall) or form[data-judge]; no URL shortcut ----------
  const JCODE = "SPARK2026";
  const urlJ = new URLSearchParams(location.search).get("judge");
  const urlHit = false;
  if (urlJ !== null) { const u = new URL(location.href); u.searchParams.delete("judge"); try { history.replaceState(null, "", u.pathname + u.search + u.hash); } catch {} }   // strip old ?judge= links; they no longer unlock anything
  // paid plan = the account's public.plans row (cached as lv-plan by supabase.js; written only by the stripe-webhook function)
  const paidRow = () => { const p = ls.get("lv-plan"); return p && (p.plan === "pro" || p.plan === "builder") && (p.status === "active" || p.status === "trialing") ? p : null; };
  const paidName = p => p.plan === "pro" ? "Pro" : p.billing === "lifetime" ? "Lifetime" : "Developer";
  // a paid plan unlocks Pro content exactly like the judge pass; the judge view keeps its own label
  const syncJudge = () => {
    const j = ls.get("lv-judge") === JCODE, p = paidRow(), on = j || !!p, name = j ? "Judge pass" : p ? paidName(p) : "";
    $$('[data-locked="1"]').forEach(el => { el.hidden = !on; });
    $$(".gatewrap, #gate").forEach(el => { el.hidden = on; });
    $$("[data-plan]").forEach(el => { el.textContent = j ? "Judge view" : on ? name + " plan" : "Free plan"; });
    $$("[data-plansub]").forEach(el => { el.textContent = on ? `All ${READY.length} stories` : `1 of ${READY.length} stories`; });
    $$("[data-upg]").forEach(el => { el.textContent = on ? "Manage" : "Get Pro"; });
    $$(".side .plan").forEach(el => { el.dataset.state = j ? "judge" : p ? "paid" : "free"; });   // sidebar card look: upgrade card, calm paid state, judge badge
    $$("[data-plan-chip]").forEach(el => { el.textContent = on ? name : "Free"; });
    $$("[data-plan-sm]").forEach(el => { el.hidden = on; });
    $$("[data-judge-off]").forEach(el => { el.hidden = !j; });
    $$(".jcard form[data-judge]").forEach(el => { el.hidden = on; });
    $$(".jcard").forEach(el => { el.hidden = !j && !!p; });   // paying members don't need the judge code box
    syncPay();
  };

  // ---------- payments: Stripe Checkout + customer portal through Supabase Edge Functions (db/supabase/functions/billing-*) ----------
  // Honest by default: buttons only appear when the function says that price is set up; otherwise "Payments open soon" stays.
  const FN = SB_URL + "/functions/v1/";
  let payCfg = null;   // {"pro:monthly": true, ...} from GET billing-checkout; null = not set up or unreachable
  const signedIn = () => !!(window.LVAuth && LVAuth.email && LVAuth.email());
  const yearly = () => !!$('[data-bill="y"][aria-pressed="true"]');
  const minor = () => ["13 to 15", "16 to 17"].includes(ls.get("lv-age"));
  function syncPay() {
    if (!$("[data-paynote]")) return;
    const j = ls.get("lv-judge") === JCODE, p = j ? null : paidRow(), y = yearly() ? "yearly" : "monthly";
    const can = k => !j && !p && signedIn() && !!payCfg && !!payCfg[k];
    const ok = {pro: can("pro:" + y), builder: can("builder:" + y), lifetime: can("lifetime:once")}, any = ok.pro || ok.builder || ok.lifetime;
    $$("[data-buy]").forEach(b => { if (b.dataset.buy !== "lifetime") b.hidden = !ok[b.dataset.buy]; });
    $$("[data-buywrap]").forEach(w => { w.hidden = !ok.lifetime; });
    $$("[data-paysoon]").forEach(s => { const k = s.dataset.paysoon; s.hidden = !!p || (k === "parent" ? any : ok[k]); });
    $$("[data-paylive]").forEach(s => { s.hidden = !any; });
    $$("[data-portal]").forEach(b => { b.hidden = !p || p.plan !== b.dataset.portal; });
    $$(".plan2[data-tier]").forEach(c => { const t = c.dataset.tier, cur = p ? p.plan === t : t === "free", bd = $("[data-badge]", c);
      c.classList.toggle("cur", cur); bd.dataset.orig = bd.dataset.orig || bd.textContent;
      bd.textContent = p && cur ? (p.billing === "lifetime" ? "Lifetime" : "Current plan") : bd.dataset.orig; bd.hidden = (t === "free" && !!p) || (t === "builder" && !cur && ok.builder); });
    $$("[data-freestat]").forEach(s => { s.hidden = !!p; });
    $$(".plan2.pro [data-jfocus]").forEach(a => { a.hidden = !!p; });
    $("[data-paynote]").textContent = p ? `You're on ${paidName(p)}${p.billing === "lifetime" ? "" : ", billed " + p.billing}. Change or cancel any time with Manage billing.`
      : any ? "Pay securely through Stripe. Cancel any time." : "Payments open soon. Nothing to pay yet.";
    $("[data-paynote2]").textContent = p || any ? "Payments run through Stripe and receipts go to whoever pays." : "Payments will run through Stripe and receipts go to whoever pays. Nothing can be bought yet.";
  }
  if ($("[data-paynote]")) {
    const cfg = () => { if (cfg.p || !signedIn()) return; cfg.p = fetch(FN + "billing-checkout").then(r => r.ok ? r.json() : null).then(d => { payCfg = d && d.configured || null; syncPay(); }).catch(() => {}); };
    if (window.LVAuth && LVAuth.live) LVAuth.load().then(() => { cfg(); syncPay(); }).catch(() => {});
    addEventListener("lv:plan", () => cfg());   // the account sync is running, so someone is signed in
    document.addEventListener("click", e => { if (e.target.closest("[data-bill]")) syncPay(); });
    document.addEventListener("click", async e => {
      const b = e.target.closest("[data-buy], [data-portal]"); if (!b || b.disabled) return;
      const label = b.textContent; b.disabled = true; b.textContent = "Opening Stripe…";
      const fail = t => { toast(t); b.disabled = false; b.textContent = label; };
      try {
        const c = await LVAuth.load(), tok = c && c.session ? await c.session.getToken() : null;
        if (!tok) return fail("Sign in again to continue. Nothing was charged.");
        const r = await fetch(FN + (b.dataset.buy ? "billing-checkout" : "billing-portal"), {method: "POST", headers: {Authorization: "Bearer " + tok, "Content-Type": "application/json"},
          body: JSON.stringify(b.dataset.buy ? {plan: b.dataset.buy, billing: yearly() ? "yearly" : "monthly", parent_pays: minor()} : {})});
        const d = await r.json().catch(() => ({}));
        if (d.url) { location.href = d.url; return; }
        if (d.error === "payments_not_configured") { payCfg = null; syncPay(); return fail("Payments open soon. Nothing was charged."); }
        if (d.error === "already_subscribed") { if (window.LVSync) LVSync.plan().catch(() => {}); return fail("You already have a plan. Use Manage billing to change it."); }
        if (d.error === "no_customer") { try { localStorage.removeItem("lv-plan"); } catch {} if (window.LVSync) LVSync.plan().catch(() => {}); syncJudge(); return fail("This account has no billing yet. Pick a plan below to start one."); }
        if (d.error === "not_signed_in") return fail("Sign in again to continue. Nothing was charged.");
        fail("Couldn't reach Stripe. Nothing was charged. Try again in a minute.");
      } catch { fail("Couldn't reach Stripe. Nothing was charged. Try again in a minute."); }
    });
    // back from Stripe: the webhook writes the plan a moment later, so re-read it a few times
    const ck = new URLSearchParams(location.search).get("checkout");
    if (ck) { try { history.replaceState(null, "", location.pathname + location.hash); } catch {}
      if (ck === "success") { toast("Payment received. Your plan updates in a few seconds.");
        let n = 0; const poll = () => { if (paidRow() || ++n > 6) return; if (window.LVSync) LVSync.plan().catch(() => {}); setTimeout(poll, 3000); }; setTimeout(poll, 1500); } }
  }
  addEventListener("lv:plan", () => { syncJudge(); renderAll(); });
  $$("form[data-judge]").forEach(f => f.addEventListener("submit", e => {
    e.preventDefault();
    const inp = $("input[name=code]", f), err = $(".jerr", f), v = (inp ? inp.value : "").trim().toUpperCase();
    if (v === JCODE) {
      if (err) err.hidden = true;
      if (inp) inp.value = "";
      ls.set("lv-judge", JCODE); syncJudge(); renderAll(); toast("Judge pass on. All 10 breakdowns are unlocked in this browser.");
    } else if (err) { err.hidden = false; if (inp) inp.focus(); }
  }));
  document.addEventListener("click", e => {
    if (e.target.closest("[data-jfocus]")) { const j = document.getElementById("jca"); if (j && j.offsetParent) { e.preventDefault(); j.scrollIntoView({block: "center", behavior: reduce ? "auto" : "smooth"}); j.focus({preventScroll: true}); } }
    if (e.target.closest("[data-judge-off-btn]")) { try { localStorage.removeItem("lv-judge"); } catch {} syncJudge(); renderAll(); toast("Judge pass off. Back to the Free view."); }
  });

  syncJudge(); if (urlHit) toast("Judge pass on. All 10 breakdowns are unlocked in this browser."); syncChecklists(); renderAll();

  // segmented controls: the white chip slides to the pressed button (handlers set aria-pressed first, so place it a frame later)
  $$(".seg").forEach(s => glide(s, '[aria-pressed="true"]'));
  document.addEventListener("click", e => { const s = e.target.closest(".seg"); if (s) requestAnimationFrame(() => glide(s, '[aria-pressed="true"]')); });
  // a sheet or dialog opening makes its controls measurable: place their sliders then
  document.addEventListener("toggle", e => { if (e.target.tagName === "DIALOG" && e.target.open) requestAnimationFrame(() => $$(".seg", e.target).forEach(s => glide(s, '[aria-pressed="true"]'))); }, true);

  // ---------- Your website: connect + prove ownership (DNS TXT or meta tag) + AI review. Account #site and a Home card. ----------
  // Server: Edge Function "site" (db/supabase/functions/site). Nothing here is trusted: the server re-checks everything.
  { const acct = $("[data-site]"), homeRail = $(".home2 .hrail");
    if (acct || homeRail) {
      const home = homeRail ? Object.assign(document.createElement("section"), {className: "card hsite"}) : null;
      if (home) { home.setAttribute("aria-labelledby", "hsiteH"); homeRail.prepend(home); }
      const ERR = {bad_domain: "That doesn't look like a website address. Try something like yourproject.com.", not_found: "We couldn't find the code yet. A DNS record can take up to an hour to show up; the meta tag works as soon as your site is published.",
        review_daily: "You can get one review a day. Try again tomorrow.", daily_limit: "You've used today's Ask LaunchVault messages. Try again tomorrow.", site_unreachable: "We couldn't open your site. Check it loads at https:// and try again.",
        assistant_not_configured: "Site reviews open soon.", busy: "Lots of people are asking right now. Try again in a minute.", refused: "We couldn't review this site.", not_signed_in: "Sign in again to continue."};
      const call = async (method, body) => { try { const c = window.LVAuth && LVAuth.live ? await LVAuth.load() : null, tok = c && c.session ? await c.session.getToken() : null;
        if (!tok) return {error: "not_signed_in"};
        const r = await fetch(FN + "site", {method, headers: {Authorization: "Bearer " + tok, "Content-Type": "application/json"}, ...(body ? {body: JSON.stringify(body)} : {})});
        return await r.json().catch(() => ({error: "server"})); } catch { return {error: "server"}; } };
      let site = null, ai = false;
      const story = s => S[s] ? `<a href="${esc(S[s].href)}">${esc(S[s].name)}</a>` : "";
      const reviewHTML = (rv, max, short) => `<ol class="sgl">${rv.suggestions.slice(0, max).map(x => `<li><b>${esc(x.title)}</b>${short ? "" : `<p>${esc(x.why)}</p>`}<p class="sgs"><span>This week:</span> ${esc(x.step)}</p>${x.story ? `<p class="sgf">From the ${story(x.story)} story</p>` : ""}</li>`).join("")}</ol>`;
      const copyBtn = (v, l) => `<button class="btn btn-s sm" type="button" data-copy="${esc(v)}">${l}</button>`;
      const drawAcct = (msg = "") => { if (!acct) return; const say = msg ? `<p class="smsg" role="status">${esc(msg)}</p>` : "";
        if (!site) { acct.innerHTML = `<form class="sform" data-sclaim novalidate><label for="sDom">Website address</label><div class="srow"><input id="sDom" type="text" inputmode="url" autocomplete="url" autocapitalize="none" spellcheck="false" placeholder="yourproject.com" maxlength="253"><button class="btn btn-p" type="submit">Connect</button></div>${say}<p class="fine">Use a site you made or run. We only read your homepage, and only after you prove it's yours.</p></form>`; return; }
        if (!site.verified) { acct.innerHTML = `<div class="spend"><p class="sdom"><b>${esc(site.domain)}</b> <span class="lb n">Not verified yet</span></p><p>Add <b>one</b> of these, then press Verify.</p>
          <div class="sopt"><h3>Option 1: a DNS record</h3><p>In your domain's DNS settings, add a <b>TXT</b> record.</p><dl><dt>Name</dt><dd><code>${esc(site.txt_name)}</code>${copyBtn(site.txt_name, "Copy")}</dd><dt>Value</dt><dd><code>${esc(site.txt_value)}</code>${copyBtn(site.txt_value, "Copy")}</dd></dl><p class="fine">Some DNS screens want only <code>_launchvault</code> as the name. Changes can take up to an hour.</p></div>
          <div class="sopt"><h3>Option 2: a tag on your homepage</h3><p>Paste this into your site's <b>head</b> (Wix, Squarespace, Shopify and Carrd all have a "custom code" or "header code" box).</p><dl><dt>Tag</dt><dd><code>${esc(site.meta)}</code>${copyBtn(site.meta, "Copy")}</dd></dl></div>
          ${say}<div class="sact"><button class="btn btn-p" type="button" data-sverify>Verify</button><button class="tl" type="button" data-sremove>Use a different site</button></div></div>`; return; }
        const rv = site.review;
        acct.innerHTML = `<div class="sok"><p class="sdom"><b>${esc(site.domain)}</b> <span class="lb v">Verified</span><small>${site.method === "dns" ? "by DNS record" : "by homepage tag"}</small></p>
          <p>Ask LaunchVault can now read this site when you chat about your project.</p>
          ${rv ? `<div class="srev"><h3>Your site review</h3>${rv.summary ? `<p class="ssum">${esc(rv.summary)}</p>` : ""}${reviewHTML(rv, 5)}<p class="fine">Reviewed ${esc(new Date(site.reviewed_at).toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric"}))}. Suggestions come from AI and the stories in the library; they're ideas, not guarantees.</p></div>` : ""}
          ${say}<div class="sact">${ai ? `<button class="btn btn-p" type="button" data-sreview>${rv ? "Review again" : "Review my site"}</button>` : `<span class="fine">Site reviews open soon.</span>`}<button class="tl" type="button" data-sremove>Remove website</button></div></div>`; };
      const drawHome = (state) => { if (!home) return;
        const head = `<div class="ch"><h2 id="hsiteH">Your website</h2>${site ? `<a class="tl" href="/app/account/#site">Manage</a>` : ""}</div>`;
        if (state === "judge") { home.innerHTML = head + `<div class="cb"><p>Members connect their project's website here. Ask LaunchVault then reviews it and suggests what to fix first, each idea tied to a story in the library.</p></div>`; return; }
        if (state === "out") { home.innerHTML = head + `<div class="cb"><p>Sign in to connect your website and get suggestions made for it.</p></div>`; return; }
        if (!site) { home.innerHTML = head + `<div class="cb"><p>Connect your project's site. Once it's verified, Ask LaunchVault reads it and tells you what to fix first.</p><a class="btn btn-s" href="/app/account/#site">Connect your website</a></div>`; return; }
        if (!site.verified) { home.innerHTML = head + `<div class="cb"><p><b>${esc(site.domain)}</b> is waiting for you to finish verifying.</p><a class="btn btn-s" href="/app/account/#site">Finish verifying</a></div>`; return; }
        const rv = site.review;
        home.innerHTML = head + `<div class="cb"><p class="sdom"><b>${esc(site.domain)}</b> <span class="lb v">Verified</span></p>${rv ? reviewHTML(rv, 3, true) + `<a class="tl" href="/app/account/#site">See why, and the full review</a>` : ai ? `<p>Get a review: what to fix first on your site, and which story to copy.</p><button class="btn btn-s" type="button" data-sreview>Review my site</button>` : `<p>Site reviews open soon. Ask LaunchVault can already read your site when you chat.</p>`}</div>`; };
      const draw = (msg, state) => { drawAcct(msg); drawHome(state); };
      const busy = (b, t) => { b.disabled = true; b.dataset.l = b.textContent; b.textContent = t; };
      document.addEventListener("click", async e => {
        const cp = e.target.closest("[data-copy]"); if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copy); toast("Copied"); } catch { toast("Couldn't copy. Select it and copy by hand."); } return; }
        const v = e.target.closest("[data-sverify]"), rm = e.target.closest("[data-sremove]"), rvb = e.target.closest("[data-sreview]");
        if (v) { busy(v, "Checking…"); const d = await call("POST", {action: "verify"}); if (d.site) site = d.site; draw(d.ok ? "" : ERR[d.error] || "Something went wrong. Try again.", null); if (d.ok) toast("Website verified"); return; }
        if (rm) { if (!confirm(site && site.verified ? "Remove this website? Its review is deleted too." : "Use a different website?")) return; const d = await call("POST", {action: "remove"}); if (!d.error) site = null; draw(ERR[d.error] || ""); return; }
        if (rvb) { busy(rvb, "Reviewing… (about 20 seconds)"); const d = await call("POST", {action: "review"}); if (d.site) site = d.site; draw(d.error ? ERR[d.error] || "The review didn't work. Try again in a minute." : ""); if (!d.error) toast("Review ready"); }
      });
      document.addEventListener("submit", async e => { const f = e.target.closest("[data-sclaim]"); if (!f) return; e.preventDefault();
        const b = $("button", f), val = $("#sDom", f).value.trim(); if (!val) return $("#sDom", f).focus(); busy(b, "Connecting…");
        const d = await call("POST", {action: "claim", domain: val}); if (d.site) site = d.site; ai = !!d.ai; draw(ERR[d.error] || (d.error ? "Something went wrong. Try again." : "")); });
      (async () => {
        const judge = ls.get("lv-judge") === JCODE, c = window.LVAuth && LVAuth.live ? await LVAuth.load().catch(() => null) : null;
        if (!c || !c.user) { if (acct) acct.innerHTML = `<div class="arow"><span class="v"><small>${judge ? "Judge view has no account, so there's no website to connect. Members connect theirs here." : "Sign in to connect your website."}</small></span></div>`; drawHome(judge ? "judge" : "out"); return; }
        const d = await call("GET"); site = d.site || null; ai = !!d.ai; draw("");
      })();
    } }

  // scroll reveal: blocks that start below the fold fade up as they come into view (app.css .rv/.in). Nothing above the fold is
  // touched, so a slow or failed script never hides what's on screen; reduced motion skips it.
  if ("IntersectionObserver" in window && !reduce) requestAnimationFrame(() => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), {rootMargin: "0px 0px -6% 0px"});
    $$(".pg .asec, .pg .card, .pg .hsec, .pg .lrow, .pg .scard, .pg .plan2").forEach(el => {
      if (el.closest(".rv") || el.getBoundingClientRect().top < innerHeight) return;
      el.classList.add("rv"); io.observe(el); });
  });
})();
