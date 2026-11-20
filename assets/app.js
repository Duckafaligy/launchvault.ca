/* LaunchVault app: storage (this device only, safe without storage), ⌘K search, Library, reader, checklists, path, account, onboarding.
   Calm by design: no magnetic buttons, no cursor effects, no particles. Respects prefers-reduced-motion. */
(() => {
  if (!window.LVGate || !LVGate.ok) return;   // age gate (assets/gate.js): the app does nothing, and stores nothing, until it passes
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
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
    toast(t[i] ? "Ticked. Saved on this device." : "Unticked.", () => { setTicks(slug, before); syncChecklists(); paint(); renderPath(); });
  };
  const syncChecklists = () => $$(".ckl[data-slug]").forEach(box => { const s = box.dataset.slug, t = ticks(s);
    $$(".ck", box).forEach((b, i) => b.setAttribute("aria-checked", !!t[i]));
    const n = t.filter(Boolean).length, p = box.querySelector(".ckp"); if (p) p.textContent = `${n} of ${t.length} · ${Math.round(n / t.length * 100)}%`;
    const bar = box.querySelector(".ckh .bar i"); if (bar) bar.style.width = (n / t.length * 100) + "%"; });
  document.addEventListener("click", e => { const b = e.target.closest(".ckl[data-slug] .ck"); if (!b) return;
    const box = b.closest(".ckl"); toggleTick(box.dataset.slug, $$(".ck", box).indexOf(b)); });
  const ckListHTML = (c, open = true) => `<div class="ckl" data-slug="${c.slug}"><div class="ckh"><span class="ckp"></span><span class="bar"><i></i></span><span class="dev">On this device</span></div>` +
    c.items.map(it => `<button class="ck" type="button" role="checkbox" aria-checked="false"><span class="bx"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><span class="ct">${esc(it.text)}</span><span class="cf">${esc(it.from || "")}</span></button>`).join("") +
    `<div class="ckf"><span>Ticks stay on this device.</span></div></div>`;
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
  const openCmd = () => {
    if (cmdEl) return; idx = idx || cmdIndex();
    const act = document.activeElement, prev = act && act !== document.body ? act : [...document.querySelectorAll("[data-cmd]")].find(b => b.offsetParent);
    cmdEl = document.createElement("div"); cmdEl.className = "cmd"; cmdEl.setAttribute("role", "dialog"); cmdEl.setAttribute("aria-modal", "true"); cmdEl.setAttribute("aria-label", "Search");
    cmdEl.innerHTML = `<div class="box"><div class="in"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="text" placeholder="Search breakdowns, moves, patterns, sources" aria-label="Search" aria-controls="cmdres" autocomplete="off"><kbd>esc</kbd></div><div class="res" id="cmdres" role="listbox"></div><div class="ft">↑↓ to move · ↵ to open · esc to close</div></div>`;
    document.body.appendChild(cmdEl); const inp = $("input", cmdEl), res = $(".res", cmdEl);
    const draw = () => { const q = inp.value.trim().toLowerCase(), hits = (q ? idx.filter(x => x.k.toLowerCase().includes(q)) : idx.filter(x => x.g === "Breakdowns" || x.g === "Pages")).slice(0, 14);
      sel = Math.min(sel, Math.max(0, hits.length - 1));
      let g = ""; res.innerHTML = hits.length ? hits.map((x, i) => (x.g !== g ? `<div class="grp">${g = x.g}</div>` : "") +
        `<a class="it" role="option" id="ci${i}" aria-selected="${i === sel}" href="${esc(x.h)}" ${x.h.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${x.img ? `<img src="${esc(x.img)}" alt="">` : ""}<span>${esc(x.t)}</span>${x.r ? `<span class="r">${esc(x.r)}</span>` : ""}</a>`).join("") : '<div class="none">No matches. Try a company or a pattern.</div>';
      inp.setAttribute("aria-activedescendant", hits.length ? "ci" + sel : ""); return hits; };
    let hits = draw();
    inp.addEventListener("input", () => { sel = 0; hits = draw(); });
    const close = () => { cmdEl.remove(); cmdEl = null; if (prev) prev.focus(); };
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
      let cur = null; secs.forEach(s => { if (s.getBoundingClientRect().top < innerHeight * .3) cur = s.id; });
      links.forEach(a => a.classList.toggle("on", a.dataset.r === cur));
      let ph = 1; $$(".ph", rd).forEach(p => { if (!p.closest("[hidden]") && !p.closest(".fade") && p.getBoundingClientRect().top < innerHeight * .4) ph = +p.dataset.ph; });
      $$(".ph", rd).forEach(p => p.classList.toggle("cur", +p.dataset.ph === ph));
      $$("[data-curph]").forEach(x => x.textContent = ph); $$("[data-curname]").forEach(x => x.textContent = names[ph - 1] || "");
      $$("#phsheet [data-goph]").forEach(b => { const k = +b.dataset.goph; b.classList.toggle("on", k === ph); b.querySelector(".r").textContent = k === ph ? "Reading" : k < ph ? "read" : ""; });
      if (pct > (saved.pct || 0) && Date.now() - lastSave > 800) { saved = {pct, ph, name: names[ph - 1] || "", n}; ls.set("lv-read-" + slug, saved); lastSave = Date.now(); paint(); }
    };
    addEventListener("scroll", onScroll, {passive: true}); onScroll();
    if (location.hash) setTimeout(() => { const t = document.getElementById(location.hash.slice(1)); if (t && !t.closest("[hidden]")) t.scrollIntoView(); }, 50);
  }

  // ---------- progress: lessons seen, saved, story checks, activity (all on this device) ----------
  const READY = D.stories.filter(s => s.status === "ready");
  const arr = (k, d = []) => { const v = ls.get(k, d); return Array.isArray(v) ? v : d; };
  const nph = s => s.phases || (CL[s.slug] || {}).phases || 1;
  const seen = slug => arr("lv-seen-" + slug);
  const doneOf = slug => { const d = ls.get("lv-done-" + slug); return d && d.how ? d : null; };   // logged complete: passed the check or answered the feedback questions
  const stateOf = s => doneOf(s.slug) ? "done" : seen(s.slug).length || readPct(s.slug) ? "prog" : "new";
  const savedList = () => arr("lv-saved");
  const savedItems = () => arr("lv-saved-items");
  const checkRes = slug => { const r = ls.get("lv-check-" + slug); return r && r.n ? r : null; };
  function logAct(m) { ls.set("lv-activity", [{m, t: Date.now()}, ...arr("lv-activity")].slice(0, 20)); }
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
  const STAR = '<svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
  const WEEKS = (READY.find(s => !s.stale) || READY[0] || {}).slug;
  const bar = (f, cls = "") => `<span class="bar${cls}"><i style="--w:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%"></i></span>`;
  const storyCard = s => { const st = stateOf(s), k = Math.min(seen(s.slug).length, nph(s)), sv = savedList().includes(s.slug), wk = s.slug === WEEKS;
    return `<article class="scard${wk ? " wk" : ""}"><a class="scl" href="${s.href}"><span class="sct">${logo(s, 32)}<span class="nm"><b>${esc(s.name)}</b><small>${esc(s.type)}</small></span></span>`
      + `<span class="stt">${esc(s.title || s.what)}</span>`
      + (s.first ? `<span class="sfc">First customers: ${esc(s.first)}${s.firstl ? " " + chip(s.firstl) : ""}</span>` : "")
      + `<span class="num"><b>${esc(s.hv)}</b><span>${esc(s.hm || s.hu)}</span>${chip(s.hl)}${staleChip(s)}<span>${esc([s.hs, s.hd].filter(Boolean).join(" · "))}</span></span>${s.spark}`
      + `<span class="sft"><span class="spt">${esc(s.pattern)}</span><span class="smt">${wk ? '<span class="tag wkc">This week</span>' : ""}${s.read} min · ${nph(s)} phases</span>`
      + (st === "new" ? "" : `<span class="sp">${bar(k / nph(s))}${st === "done" ? '<span class="done">Done</span>' : `<span>${k} of ${nph(s)} phases</span>`}</span>`)
      + `</span></a>${s.site ? `<a class="web" href="${esc(s.site)}" target="_blank" rel="noopener" aria-label="${esc(s.name)} website"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></a>` : ""}<button class="star" type="button" data-star="${s.slug}" aria-pressed="${sv}" aria-label="${sv ? "Remove" : "Save"} ${esc(s.name)}">${STAR}</button></article>`; };
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
      return `<a class="clrow" href="${c.href}#todo"><img src="${esc(c.logo)}" alt="" width="20" height="20" style="border-radius:4px"><span class="mid"><b>${esc(c.name)}</b><small>${i < 0 ? "All done." : "Next: " + esc(c.items[i].text)}</small></span>${bar(k / t.length)}<span class="ct">${k} of ${t.length}</span></a>`; }).join("")
      + (q ? `<a class="clrow" href="/app/path/"><span style="color:var(--brand)">●</span><span class="mid"><b>Your path · ${esc(D.path.title)}</b><small>${(() => { const s = pathSteps().find(x => !x.done); return s ? "Next: " + esc(s.text) : "All done."; })()}</small></span><span class="bar"><i data-pathbar></i></span><span class="ct" data-pathcount2></span></a>` : ""); };
  let hf = "all";
  const hcards = $("[data-hcards]");
  const CKS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const renderHome = () => {
    if (!hcards) return;
    const started = READY.filter(s => stateOf(s) !== "new");
    const totPh = READY.reduce((a, s) => a + nph(s), 0), seenPh = READY.reduce((a, s) => a + Math.min(nph(s), seen(s.slug).length), 0);
    const tk = D.checklists.reduce((a, c) => { const t = ticks(c.slug); return [a[0] + t.filter(Boolean).length, a[1] + t.length]; }, [0, 0]);
    const sc = READY.map(s => checkRes(s.slug)).filter(Boolean), avg = sc.length ? Math.round(sc.reduce((a, r) => a + r.last / r.n, 0) / sc.length * 100) : 0;
    const q = quiz(), prog = started.length > 0 || tk[0] > 0 || sc.length > 0, adult = ADULT(), W = S[WEEKS];
    $("[data-hh1]").textContent = prog || q ? "Welcome back" : "Start here";
    $("[data-hsum]").textContent = started.length ? `You've started ${started.length} of ${READY.length} breakdowns and seen ${seenPh} lessons.${tk[0] ? ` ${tk[0]} checklist ticks so far.` : ""}`
      : `${READY.length} breakdowns ready. Start with this week's${adult ? "." : ": each one ends with steps that fit around school."}`;
    // the one dominant card: your open path step, else the story you were reading, else this week's breakdown
    const st = pathSteps(), nx = q ? st.find(s => !s.done) : null, last = ls.get("lv-last"), L = last && S[last.slug] && S[last.slug].status === "ready" ? S[last.slug] : null;
    let c;
    if (nx) c = {img: CL[D.path.source], t: "Your next step: " + nx.text, m: `Step ${st.indexOf(nx) + 1} of ${st.length} · ${nx.extra ? esc(nx.from) : "from the " + esc(srcName()) + " breakdown"}`, b: "Open step", h: "/app/path/"};
    else if (L) { const n = nph(L), k = Math.min(n, seen(L.slug).length), ph = Math.min(n, last.ph || 1); c = {img: L, t: "Continue: " + (L.title || L.name), m: `Phase ${ph} of ${n} · ${k} of ${n} seen`, b: "Resume", h: `${L.href}#ph${ph}`}; }
    else if (W) c = {img: W, t: "This week's breakdown: " + (W.title || W.name), m: `${nph(W)} phases · ${W.read} min <span class="tag wkc">This week</span>`, b: "Start", h: W.href};
    if (c) $("[data-hnext]").innerHTML = `<span class="logo">${logo(c.img, 40)}</span><div class="mid"><h2>${esc(c.t)}</h2><p>${c.m}</p></div><a class="btn btn-p" href="${c.h}">${c.b} <span class="arr" aria-hidden="true">→</span></a>`;
    // progress strip once there is progress; the 3-step start list until this week's story has been read, ticked and checked
    const stat = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
    const w3 = W ? [seen(WEEKS).length > 0, ticks(WEEKS).some(Boolean), !!checkRes(WEEKS)] : [true, true, true];
    const srow = (i, t, h) => `<li><a href="${h}"><span class="n${w3[i] ? " d" : ""}">${w3[i] ? CKS : i + 1}</span><span>${t}${w3[i] ? '<span class="sr"> (done)</span>' : ""}</span></a></li>`;
    $("[data-hstats]").innerHTML = (prog ? `<div class="hstrip">${stat(`${started.length} of ${READY.length}`, "Stories started")}${stat(`${seenPh} of ${totPh}`, "Lessons seen")}${stat(`${tk[0]} of ${tk[1]}`, "Steps ticked")}${stat(sc.length ? avg + "%" : "Not taken yet", "Check average")}</div>` : "")
      + (W && !w3.every(Boolean) && started.length <= 1 ? `<ol class="hstart" aria-label="Start here">${srow(0, `Read this week's breakdown (${W.read} min)`, W.href)}${srow(1, "Tick one step on its checklist", W.href + "#todo")}${srow(2, "Take the story check", W.href + "#check")}</ol>` : "");
    const hp = $("[data-hpath]"), dn = pathDone();
    hp.innerHTML = q ? (() => { const t = q.top && S[q.top] ? S[q.top] : S[(q.matches || [])[0]];
        return `<div class="ch"><h2>Your path, from the ${esc(srcName())} breakdown</h2><a class="tl" href="/app/start/?quiz=1">Retake quiz</a></div><div class="cb"><div class="hpr">${bar(dn / st.length)}<span>${dn} of ${st.length} steps</span></div>`
          + (t ? `<a class="mini hm" href="${t.href}">${logo(t, 24)}<span><b>${esc(t.name)}</b><span class="pill">${q.top ? "Top match" : "Closest match"}</span></span></a>` : "")
          + `<p class="qm">${q.top && q.why && q.why.length ? "Matched on: " + esc(q.why.join(" · ")) : "No single story matched your answers, so this is the general path."}</p><a class="btn btn-s" style="margin-top:12px" href="/app/path/">Open my path</a></div>`; })()
      : `<div class="ch"><h2>Get a path that fits you</h2></div><div class="cb"><p>Eight quick questions match you with 3 stories that started a lot like you, and a ${st.length}-step path.</p><a class="btn btn-p" style="margin-top:12px" href="/app/start/?quiz=1">Take the 2-minute quiz</a></div>`;
    $$("[data-hf]").forEach(b => b.setAttribute("aria-pressed", b.dataset.hf === hf));
    const sv = savedList(), list = READY.filter(s => hf === "all" || (hf === "saved" ? sv.includes(s.slug) : stateOf(s) === hf)).sort((a, b) => (b.slug === WEEKS) - (a.slug === WEEKS));
    hcards.innerHTML = list.length ? list.map(storyCard).join("") : `<div class="empty"><p>${hf === "saved" ? "Nothing saved yet. Tap the star on a story to keep it here." : "No stories here yet."}</p></div>`;
    const act = arr("lv-activity");
    $("[data-hact]").innerHTML = act.length ? act.map(a => `<li><span>${esc(a.m)}</span><time>${ago(a.t)}</time></li>`).join("") : '<li class="empty">Read a phase, tick an item or take a story check, and it shows up here.</li>';
    homeCL();
  };
  $$("[data-hf]").forEach(b => b.addEventListener("click", () => { hf = b.dataset.hf; renderHome(); syncStars(); }));

  // ---------- saved: one empty state (what it is, how to fill it, three stories to star), else the two lists ----------
  const renderSaved = () => { const sc = $("[data-savedcards]"); if (!sc) return;
    const L = savedList().map(k => S[k]).filter(Boolean);
    const I = savedItems().map(k => { const [slug, i] = k.split(":"), c = CL[slug]; return c && c.items[+i] ? {k, c, i: +i, it: c.items[+i]} : null; }).filter(Boolean);
    $("[data-savedsec]").hidden = !L.length; $("[data-savedsec2]").hidden = !I.length;
    $("[data-savedcount]").textContent = L.length ? `${L.length} saved` : "";
    sc.innerHTML = L.map(storyCard).join("");
    $("[data-saveditems]").innerHTML = I.map(({k, c, i, it}) => `<div class="sitem"><a href="${c.href}#todo">${logo(c, 20)}<span><b>${esc(it.text)}</b><small>${esc(c.name)} · step ${i + 1}${ticks(c.slug)[i] ? " · ticked" : ""}</small></span></a><button class="ckstar" type="button" data-staritem="${k}" aria-pressed="true" aria-label="Remove this step">${STAR}</button></div>`).join("");
    const sug = [...new Set([WEEKS, ...matches()])].map(k => S[k]).filter(Boolean).slice(0, 3);
    $("[data-savedempty]").innerHTML = L.length || I.length ? "" : `<section class="card sempty"><h2>Nothing saved yet</h2><p>Star a story to keep it here. Star a checklist step to keep the step.</p><div class="scards">${sug.map(storyCard).join("")}</div><a class="btn btn-p" href="/app/library/">Open the Library</a></section>`; };

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
      lout.innerHTML = L.length ? L.map(storyCard).join("") : `<div class="card empty"><h3>No stories match these filters</h3><p>One new breakdown arrives each week.</p><button class="btn btn-s" type="button" data-clearall>Clear filters</button></div>`;
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
    const nav = $(".snav-in"); let lastOn = null;
    addEventListener("scroll", () => { const on = nav && $("a.on", nav); if (on && on !== lastOn) { lastOn = on; nav.scrollTo({left: on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2, behavior: reduce ? "auto" : "smooth"}); } }, {passive: true});
  }
  // story check (one question per screen) + logging a story complete: pass the check (all but one right) OR answer the feedback questions
  const CKI = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const XI = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const FBQ = [["clarity", "How clear was this breakdown?", ["Very clear", "Mostly clear", "Confusing in places", "Hard to follow"]],
    ["useful", "Will you use anything from it?", ["Yes, soon", "Maybe later", "Not really"]],
    ["best_part", "Which part helped most?", ["The numbers and chart", "The phases and lessons", "The checklist", "Fact checks and sources"]]];
  $$("[data-check]").forEach(box => {
    const slug = box.dataset.check, me = S[slug] || {}, nm = me.name || slug, body = $("[data-checkbody]", box); let Q;
    try { Q = JSON.parse($("script", box).textContent); } catch { return; }
    const need = Math.max(1, Q.length - 1), cbox = document.createElement("div"); cbox.className = "cdone"; box.after(cbox);
    const go = h => { const t = document.getElementById(h.slice(1)); return t && !t.closest("[hidden]") ? h : "#gate"; };   // a locked section points at the gate
    const logDone = how => { if (doneOf(slug)) return; ls.set("lv-done-" + slug, {how, t: Date.now()}); logAct(`Completed ${nm}`); renderAll(); };
    // read next: a quiz match first, else the newest story not started, else any story not done
    const nextStory = () => { const q = quiz(), open = s => s && s.status === "ready" && s.slug !== slug && !doneOf(s.slug);
      return ((q && q.matches) || []).map(k => S[k]).find(open) || READY.find(s => open(s) && stateOf(s) === "new") || READY.find(open); };
    const paintDone = () => { const d = doneOf(slug); cbox.classList.toggle("fin", !!d);
      if (!d) { cbox.innerHTML = `<h3>Log this story as complete</h3><p>Two ways: get ${need} of ${Q.length} right on the check above, or answer a few quick questions that help us make LaunchVault better.</p><button class="btn btn-s" type="button" data-fb>Answer questions instead</button>`;
        $("[data-fb]", cbox).addEventListener("click", feedback); return; }
      const r = checkRes(slug), n = nph(me), k = Math.min(n, seen(slug).length), t = ticks(slug), i = t.indexOf(false), nx = nextStory();
      const row = (h, a, b) => `<a href="${h}"><span><b>${a}</b><small>${esc(b)}</small></span><i aria-hidden="true">→</i></a>`;
      cbox.innerHTML = `<div class="cok" tabindex="-1"><span class="fck">${CKI}</span><div><h3>Story complete</h3><p>${k ? `You read ${k} of ${n} phases and ` : "You "}${d.how === "check" ? "passed the check" + (r ? ` with ${r.best} of ${r.n}` : "") : "answered the feedback questions"}. Logged ${(t => MON[t.getMonth()] + " " + t.getDate() + " " + t.getFullYear())(new Date(d.t))}.</p></div></div><div class="fnext">`
        + (i >= 0 ? row("#todo", `Do step ${i + 1} of the checklist`, CL[slug].items[i].text) : "") + (nx ? row(nx.href, "Read next", nx.title || nx.name) : "") + row("/app/path/", "See your path", D.path.title) + "</div>"; };
    const feedback = () => {
      cbox.innerHTML = `<form class="ckform fbform" novalidate><h3>Help us improve this breakdown</h3>${FBQ.map(([k, q, o], i) => `<fieldset><legend><span class="qn">${i + 1}</span>${esc(q)}</legend>${o.map(t => `<label class="opt2"><input type="radio" name="${k}" value="${esc(t)}" required><span>${esc(t)}</span></label>`).join("")}</fieldset>`).join("")}
        <label class="fbl" for="fbmiss"><span class="qn">4</span>What was confusing, missing or wrong? (optional)</label><textarea id="fbmiss" name="missing" maxlength="2000"></textarea>
        <label class="fbl" for="fbnext"><span class="qn">5</span>Which app or company should we break down next? (optional)</label><input id="fbnext" name="next_idea" maxlength="200" autocomplete="off">
        <p class="rmsg" role="status" aria-live="polite"></p><div class="ckact"><button class="btn btn-p" type="submit">Send and log complete</button><button class="btn btn-s" type="button" data-fbx>Cancel</button></div></form>`;
      const f = $("form", cbox), msg = $(".rmsg", cbox), send = $('[type="submit"]', cbox);
      $("[data-fbx]", cbox).addEventListener("click", paintDone); $("input", f).focus();
      f.addEventListener("submit", async ev => { ev.preventDefault(); const v = Object.fromEntries(new FormData(f));
        const un = FBQ.find(([k]) => !v[k]); if (un) { msg.className = "rmsg err"; msg.textContent = "Please answer questions 1 to 3."; $(`[name="${un[0]}"]`, f).focus(); return; }
        v.missing = (v.missing || "").trim(); v.next_idea = (v.next_idea || "").trim() || null;
        if (v.missing && v.missing.length < 5) { msg.className = "rmsg err"; msg.textContent = "Leave question 4 empty, or write at least 5 characters."; $("#fbmiss", f).focus(); return; }
        v.missing = v.missing || "(none)";   // the table needs 5 to 2000 characters; an empty box is sent as "(none)"
        send.disabled = true; msg.className = "rmsg"; msg.textContent = "Sending…";
        try { const r = await fetch(SB_URL + "/rest/v1/feedback", {method: "POST", headers: {apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal"}, body: JSON.stringify({story_slug: slug, ...v})});
          if (!r.ok) throw new Error(r.status); logDone("feedback"); paintDone(); $(".cok", cbox).focus();
        } catch (err) { send.disabled = false; msg.className = "rmsg err"; msg.textContent = sendErr(err); } }); };
    const finish = got => { const score = got.filter((g, i) => g === Q[i].a).length, prev = checkRes(slug) || {best: 0}, best = Math.max(prev.best, score);
      ls.set("lv-check-" + slug, {best, last: score, n: Q.length, t: Date.now()}); logAct(`Scored ${score}/${Q.length} on the ${nm} check`);
      const pass = score >= need; if (pass) logDone("check");
      const miss = Q.map((q, i) => ({q, g: got[i]})).filter(x => x.g !== x.q.a);
      body.innerHTML = `<div class="ckres" tabindex="-1"><p class="sc"><b>${score} of ${Q.length}</b> right${score === Q.length ? ". Every one." : ""}${pass || doneOf(slug) ? "" : ` · ${need} needed to log it complete`}</p>${bar(score / Q.length)}`
        + (miss.length ? `<h3>Worth another look</h3><ol>${miss.map(({q, g}) => `<li><b>${esc(q.q)}</b><span class="no">${XI}Not quite. You picked: ${esc(q.o[g])}</span><span class="ok">${CKI}Right answer: ${esc(q.o[q.a])}</span><small>${esc(q.e)}</small>${q.h ? `<a class="tl" href="${go(q.h)}">Go to ${esc(q.hl)}</a>` : ""}</li>`).join("")}</ol>` : "")
        + `<div class="ckact"><button class="btn btn-s" type="button" data-retake>Retake</button><span>Best so far: ${best} of ${Q.length}</span></div></div>`;
      paintDone(); $(".ckres", body).focus(); $("[data-retake]", body).addEventListener("click", () => run(true)); };
    const run = focus => { const got = Q.map(() => null); let i = 0;
      const show = focus => { const q = Q[i], g = got[i], done = g != null, r = checkRes(slug), last = i === Q.length - 1;
        body.innerHTML = `<form class="ckform kq" novalidate><div class="kqh"><b>Story check · Question ${i + 1} of ${Q.length}</b>${r ? `<span>Best so far: ${r.best} of ${r.n}</span>` : ""}</div>${bar((i + (done ? 1 : 0)) / Q.length)}`
          + `<fieldset${done ? " disabled" : ""}><legend>${esc(q.q)}</legend>${q.o.map((o, j) => { const c = !done ? "" : j === q.a ? " ok" : j === g ? " no" : "";
            return `<label class="opt2${c}"><input type="radio" name="q" value="${j}"${g === j ? " checked" : ""}><span>${esc(o)}</span>${c === " ok" ? `<em>${CKI}Right answer</em>` : c === " no" ? `<em>${XI}Not quite</em>` : ""}</label>`; }).join("")}</fieldset>`
          + `<p class="kqe" id="kqe-${slug}">${done ? `<b>${g === q.a ? "Right." : "Not quite."}</b> ${esc(q.e)}` : ""}</p>`
          + `<div class="ckact">${i ? '<button class="tl" type="button" data-kback>Back</button>' : ""}<button class="btn btn-p" type="submit" aria-describedby="kqe-${slug}"${done ? "" : " disabled"}>${!done ? "Check" : last ? "See my result" : "Next"}</button></div></form>`;
        const f = $("form", body), sb = $('[type="submit"]', f), bk = $("[data-kback]", f);
        f.addEventListener("change", () => { sb.disabled = false; });
        f.addEventListener("submit", ev => { ev.preventDefault();
          if (got[i] == null) { const v = new FormData(f).get("q"); if (v == null) return; got[i] = +v; show(true); }
          else if (!last) { i++; show(true); } else finish(got); });
        if (bk) bk.addEventListener("click", () => { i--; show(true); });
        if (focus) (done ? sb : $("input", f)).focus(); };
      show(focus); };
    run(false); paintDone();
  });

  // right rail ticks: a section is done when its phases are all seen / its steps all ticked / the story is logged complete
  const railDone = () => { if (!rd) return; const slug = rd.dataset.reader, t = ticks(slug), ok = {phases: seen(slug).length >= +rd.dataset.phases, todo: t.length > 0 && t.every(Boolean), check: !!doneOf(slug)};
    $$("[data-rdone]").forEach(n => n.hidden = !ok[n.dataset.rdone]); };
  // coming-soon page: two finished breakdowns of the same type (any ready story fills a gap)
  // app 404: this week's story and the two newest others
  const renderNF = () => $$("[data-nfcards]").forEach(n => { n.innerHTML = [S[WEEKS], ...READY.filter(s => s.slug !== WEEKS)].filter(Boolean).slice(0, 3).map(storyCard).join(""); });
  const renderSoon = () => $$("[data-sooncards]").forEach(n => { const L = READY.filter(s => s.tab === n.dataset.sooncards); n.innerHTML = L.concat(READY.filter(s => !L.includes(s))).slice(0, 2).map(storyCard).join(""); });
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');   // an in-page link opens any folded panel its target sits in
    if (a && a.hash.length > 1) for (let d = document.getElementById(a.hash.slice(1)); d; d = d.parentElement) if (d.tagName === "DETAILS") d.open = true;
    const m = e.target.closest("[data-fcmore]"); if (m) { const on = m.previousElementSibling.classList.toggle("open"); m.setAttribute("aria-expanded", on); m.textContent = on ? (m.dataset.less || "Less") : (m.dataset.more || "More"); }
    const tb = e.target.closest("[data-showtab]"); if (tb) { const d = tb.closest(".lvchart").querySelector(".ctab"); if (d) { d.open = true; d.scrollIntoView({block: "nearest"}); } }
  });
  // chart.js blocked or failed to load: say so and point at the table (chart.js handles its own runtime errors the same way)
  addEventListener("load", () => $$(".lvchart").forEach(r => { const pl = $(".plot", r); if (!pl || $("svg", pl).childElementCount || $(".cfail", r)) return;
    pl.hidden = true; pl.insertAdjacentHTML("afterend", '<div class="cfail" role="status"><span>The chart didn\'t load. Reload, or read the table.</span><button class="btn btn-s" type="button" data-showtab>Show the table</button></div>'); }));
  const renderAll = () => { renderHome(); renderSaved(); renderSoon(); renderNF(); libDraw(); syncStars(); paint(); railDone(); };
  addEventListener("storage", renderAll);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) renderAll(); });
  addEventListener("lv:changed", () => { clearTimeout(renderAll.t); renderAll.t = setTimeout(() => { renderHome(); renderSaved(); syncStars(); railDone(); }, 50); });

  // ---------- my path: one route, one open step at a time ----------
  const stepsEl = $("[data-steps]"); let openStep = null;
  function renderPath() {
    if (!stepsEl) return; const st = pathSteps(), q = quiz(), src = CL[D.path.source], dn = pathDone();
    if (openStep == null) openStep = st.findIndex(s => !s.done);
    stepsEl.innerHTML = st.map((s, i) => { const open = i === openStep;
      const link = s.extra ? (s.href ? `<a class="tl" href="${s.href}">${esc(s.from)}: open the breakdown</a>` : "") : `<a class="tl" href="${src.href}#${s.ph ? "ph" + s.ph : "todo"}">Open in the ${esc(src.name)} breakdown${s.ph ? ", phase " + esc(s.from) : ""}</a>`;
      return `<div class="rstep${open ? " open" : ""}${s.done ? " done" : ""}"><button class="rsh" type="button" data-stepopen="${i}" aria-expanded="${open}"><span class="dot">${s.done ? CKS : i + 1}</span><span class="rst">${esc(s.task || s.text)}</span>${s.done && s.date ? `<span class="dt">Done ${esc(s.date)}</span>` : ""}</button>`
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
      if (s.extra) { const v = s.done ? null : today(); ls.set("lv-path-extra", v); renderPath(); toast(v ? "Step done. Saved on this device." : "Step reopened."); }
      else toggleTick(D.path.source, s.n - 1);
    });
    renderPath();
  }

  // ---------- checklists page: a "Next up" card, then one accordion per story (in progress first, then this week's) ----------
  const cls = $("[data-cllists]");
  if (cls) {
    const cnt = c => ticks(c.slug).filter(Boolean).length, inprog = c => { const n = cnt(c); return n > 0 && n < c.items.length; };
    const order = D.checklists.slice().sort((a, b) => (inprog(b) - inprog(a)) || ((b.slug === WEEKS) - (a.slug === WEEKS)));
    const lastK = ls.get("lv-ck-last"), nxc = (CL[lastK] && ticks(lastK).includes(false) && CL[lastK]) || order.find(inprog) || CL[WEEKS] || order[0];
    $("[data-clnext]").innerHTML = `<section class="hnext"><span class="logo">${logo(nxc, 40)}</span><div class="mid"><h2>Next up in the ${esc(nxc.name)} checklist</h2><p data-cknext="${nxc.slug}"></p></div><a class="btn btn-p" href="${nxc.href}#todo">Do it <span class="arr" aria-hidden="true">→</span></a></section>`;
    cls.innerHTML = order.map(c => `<details class="cla" name="cl"${c === nxc ? " open" : ""}><summary>${logo(c, 24)}<span class="mid"><b>${esc(c.name)}</b><small data-cknext="${c.slug}"></small></span><span class="ct" data-ckc="${c.slug}"></span><span class="bar"><i data-ckbar="${c.slug}"></i></span><span class="chev" aria-hidden="true"></span></summary>${ckListHTML(c)}<a class="tl clo" href="${c.href}">Open the ${esc(c.name)} breakdown</a></details>`).join("");
  }

  // ---------- account ----------
  const ageR = $$('input[name="age"]');
  if (ageR.length) {
    const cur = () => (ageR.find(r => r.checked) || {}).value || "";
    ageR.forEach(r => { r.checked = r.value === ls.get("lv-age"); });
    const note = () => { const a = cur(); $("[data-agenote]").textContent = !a ? "Set your age range so the right rules apply." : (a === "13 to 15" || a === "16 to 17") ? "A parent pays for paid plans." : a === "21 or older" ? "LaunchVault is built for 15 to 20, but anyone is welcome to read." : "You can pay for a plan yourself.";
      const minor = !a || a === "13 to 15" || a === "16 to 17"; const ps = $("#parent"); if (ps) ps.hidden = !minor; $$('nav a[href="#parent"]').forEach(l => { l.hidden = !minor; }); };
    note(); ageR.forEach(r => r.addEventListener("change", () => { ls.set("lv-age", cur()); note(); toast("Saved on this device."); }));
    // the stated monthly prices lead; yearly is the secondary line (and the other way round on the Yearly toggle)
    const bill = y => { $$("[data-bill]").forEach(b => b.setAttribute("aria-pressed", (b.dataset.bill === "y") === y));
      $('[data-pr="pro"]').textContent = y ? "$6.49" : "$7.99"; $('[data-pr="developer"]').textContent = y ? "$23.99" : "$29.99";
      $('[data-ps="pro"]').textContent = y ? "a month, billed yearly ($77.88). Monthly is $7.99" : "a month, or $6.49 a month billed yearly ($77.88)";
      $('[data-ps="developer"]').textContent = y ? "a month, billed yearly ($287.88). Monthly is $29.99" : "a month, or $23.99 a month billed yearly ($287.88)"; };
    $$("[data-bill]").forEach(b => b.addEventListener("click", () => bill(b.dataset.bill === "y"))); bill(false);
    const link = location.origin + "/#pricing", flow = () => { const s = ls.get("lv-parent"); $$("[data-pflow] span").forEach((x, i) => x.className = s ? (i === 0 ? "d" : i === 1 ? "c" : "t") : "t");
      if (s) $("[data-pflow] span").innerHTML = `<i></i>Link sent ${esc(s)}`; };
    flow();
    $("#pcopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(link); } catch {} ls.set("lv-parent", today()); flow(); toast("Parent link copied"); });
    $("#psend").addEventListener("click", () => { const e = $("#pemail").value.trim(); if (!/.+@.+\..+/.test(e)) { $("#pemail").focus(); return; }
      ls.set("lv-parent", today()); flow(); location.href = `mailto:${encodeURIComponent(e)}?subject=${encodeURIComponent("LaunchVault")}&body=${encodeURIComponent("Could you look at LaunchVault for me? Plans and prices are here: " + link)}`; });
    const prefs = Object.assign({new_story: false, path: false, news: false}, ls.get("lv-prefs", {}));
    $$("[data-pref]").forEach(b => { b.setAttribute("aria-checked", !!prefs[b.dataset.pref]); b.addEventListener("click", () => { prefs[b.dataset.pref] = !prefs[b.dataset.pref]; b.setAttribute("aria-checked", prefs[b.dataset.pref]); ls.set("lv-prefs", prefs); }); });
    $("#dl").addEventListener("click", () => { const o = {}; ls.keys().forEach(k => o[k] = ls.get(k)); const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify({exported: new Date().toISOString(), note: "Everything LaunchVault saved on this device.", data: o}, null, 2)], {type: "application/json"}));
      a.download = "launchvault-data.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
    // Delete your data: the device is cleared straight away. assets/supabase.js listens for "lv:delete-account" when someone is signed in,
    // deletes the server copy and calls detail.done(null) (or done("server") if it couldn't). Signed out: nobody calls done.
    $("#del").addEventListener("click", () => { if (!confirm("Delete everything LaunchVault saved on this device? This can't be undone.")) return;
      const msg = $("[data-delmsg]"), say = t => { $("p", msg).textContent = t; };
      dispatchEvent(new CustomEvent("lv:delete-account", {detail: {done: err => say(err ? "Your device data is cleared, but we couldn't reach the server. Try again in a minute." : "Your device data is cleared. Also removed from your account.")}}));
      wiped = true; ls.keys().forEach(ls.del); try { Object.keys(sessionStorage).filter(k => k.startsWith("lv-")).forEach(k => sessionStorage.removeItem(k)); } catch {}
      say("Your device data is cleared."); msg.hidden = false; $("#del").disabled = true; $("#dl").disabled = true; $("a", msg).focus(); });
    const so = $("#so"); if (so && window.LVAuth) so.addEventListener("click", () => LVAuth.signOut());
    const nav = $$(".anav a, .anavm a"), strip = $(".anavm .snav-in");
    addEventListener("scroll", () => { let cur = "#profile"; ["#profile", "#plan", "#parent", "#email", "#data"].forEach(h => { const t = document.querySelector(h); if (t && !t.hidden && t.getBoundingClientRect().top < 160) cur = h; });
      nav.forEach(a => a.classList.toggle("on", a.getAttribute("href") === cur)); const on = strip && $("a.on", strip); if (on && strip.scrollWidth > strip.clientWidth) strip.scrollTo({left: on.offsetLeft - 16}); }, {passive: true});
  }

  // ---------- onboarding: 8 questions (Skip any) -> result -> Home. The age question is the gate (assets/gate.js), asked once, before this. ----------
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
    const summary = () => [age, ...ans.map((a, i) => a == null ? null : D.quiz[i].o[a])].filter(Boolean).join(" · ");
    const why = t => t ? ans.map((a, i) => a != null && (D.quiz[i].w[a] || {})[t] ? D.quiz[i].o[a] : null).filter(Boolean) : [];
    const save = () => { const t = topOf(), m = score(); ls.set("lv-quiz-app", {answers: ans, matches: m, top: t, why: why(t), whys: Object.fromEntries(m.map(k => [k, why(k)])), summary: summary(), date: today()}); D.path = t ? pathFor(m) : PATH0; };
    const render = () => {
      if (step < D.quiz.length) { const Q = D.quiz[step];
        H.innerHTML = "Eight questions. <em>Under two minutes.</em>"; P.textContent = "Your answers pick 3 stories that started a lot like you. Skip any question you don't want to answer.";
        obc.innerHTML = `<div class="qp"><span class="bar v"><i style="--w:${step / D.quiz.length * 100}%"></i></span><span>${step + 1} of ${D.quiz.length}</span></div><h2 id="qh">${esc(Q.q)}</h2>${Q.h ? `<p class="qhint" id="qhint">${esc(Q.h)}</p>` : ""}<div class="opts" role="radiogroup" aria-labelledby="qh"${Q.h ? ' aria-describedby="qhint"' : ""}>${Q.o.map((o, i) => opt(o, ans[step] === i, i)).join("")}</div>
          <div class="obnav">${step ? '<button class="bk" type="button" data-back>Back</button>' : ""}<span class="sp"></span><button class="sk" type="button" data-skip>Skip</button><button class="btn btn-p" type="button" data-next>${step === D.quiz.length - 1 ? "See my path" : "Next"}</button></div><a class="tl obskip" href="/app/" data-skipall>Skip the quiz for now</a>`; }
      else { save(); ls.set("lv-pathnote", "new"); const m = score(), qq = quiz(), x = S[m[0]];
        H.innerHTML = "Your path <em>is ready.</em>";
        P.innerHTML = `${D.path.steps.length + 1} steps${ADULT() ? "" : " that fit around school"}, from the ${esc(D.path.name || "Postiz")} breakdown.`
          + (qq.top ? "" : `<small>Your answers didn't point to one story more than the others, so this is the general path. The 3 stories below are the closest.</small>`);
        const chips = k => { const w = why(k).slice(0, 4); return w.length ? `<span class="wchips"><span>Matched on</span>${w.map(a => `<span class="wc">${esc(a)}</span>`).join("")}</span>` : ""; };
        obc.innerHTML = `<h2>${qq.top ? "Your top match" : "The closest stories"}</h2>
          <div class="mtop"><div class="mth"><span class="logo">${logo(x, 40)}</span><span><b>${esc(x.name)}</b><small>${esc(x.pattern)}</small></span></div><p class="mtt">${esc(x.title || x.what)}</p>${x.first ? `<p class="mtf">First customers: ${esc(x.first)} ${chip(x.firstl)}</p>` : ""}${chips(m[0])}<a class="btn btn-p" href="${x.href}">Read the ${esc(x.name)} breakdown</a></div>
          ${m.slice(1).map(k => { const y = S[k]; return `<a class="mrow2" href="${y.href}">${logo(y, 24)}<span><b>${esc(y.name)}</b><small>${esc(y.pattern)}</small>${chips(k)}</span><i aria-hidden="true">›</i></a>`; }).join("")}
          <div class="obend"><a class="btn btn-s" href="/app/path/">See my path</a><a class="tl" href="/app/">Go to Home</a><a class="tl" href="/app/start/?quiz=1">Edit answers</a></div><p class="fine">Saved on this device.</p>`; }
      if (render.n++) obc.focus({preventScroll: true});
    };
    render.n = 0;
    obc.addEventListener("click", e => {
      const o = e.target.closest(".opt");
      if (o) { const i = +o.dataset.o; ans[step] = ans[step] === i ? null : i; $$(".opt", obc).forEach(x => x.setAttribute("aria-checked", +x.dataset.o === i && ans[step] === i)); return; }
      if (e.target.closest("[data-next]")) { step++; render(); return; }
      if (e.target.closest("[data-skip]")) { ans[step] = null; step++; render(); return; }
      if (e.target.closest("[data-back]")) { step = Math.max(0, step - 1); render(); return; }
    });
    obc.addEventListener("keydown", e => { if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return; const os = $$(".opt", obc); if (!os.length) return; e.preventDefault();
      const i = Math.max(0, os.indexOf(document.activeElement)), j = (i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + os.length) % os.length; os[j].focus(); os[j].click(); });
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

  syncChecklists(); renderAll();
})();
