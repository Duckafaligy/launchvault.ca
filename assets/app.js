/* LaunchVault app: storage (this device only, safe without storage), ⌘K search, Library, reader, checklists, path, account, onboarding.
   Calm by design: no magnetic buttons, no cursor effects, no particles. Respects prefers-reduced-motion. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  // preference-type keys are only saved when cookie consent allows Preferences (necessary keys, like ticks you save, always are)
  const PREF = new Set(["lv-lib", "lv-pathnote"]);
  const prefOK = () => { try { if (window.LVConsent) return LVConsent.allowed("preferences"); const c = JSON.parse(localStorage.getItem("lv-consent")); return !!(c && c.preferences); } catch { return false; } };
  const ls = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { if (PREF.has(k) && !prefOK()) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch {} dispatchEvent(new Event("lv:changed")); },
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

  // ---------- progress model ----------
  const ticks = slug => { const c = CL[slug]; if (!c) return []; const t = ls.get(c.key, []); return c.items.map((_, i) => !!(Array.isArray(t) && t[i])); };
  const setTicks = (slug, arr) => { const c = CL[slug]; ls.set(c.key, arr); };
  const tickDates = slug => ls.get("lv-" + slug + "-checkdates", {});
  const readPct = slug => Math.round((ls.get("lv-read-" + slug, {}) || {}).pct || 0);
  const quiz = () => ls.get("lv-quiz-app");
  // the path follows the quiz: top match's checklist, plus the next match's opening step; no clear match keeps the general Postiz path
  const pathFor = m => { m = (m || []).filter(s => D.paths && D.paths[s]); const P = D.paths && D.paths[m[0]];
    return P ? {...P, extra: m[1] ? D.paths[m[1]].lead : D.path.extra} : D.path; };
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
    $$("[data-cknext]").forEach(n => { const s = n.dataset.cknext, t = ticks(s), i = t.indexOf(false); n.textContent = i < 0 ? "All done. Nice." : "Next: " + CL[s].items[i].text; });
    $$("[data-pathname]").forEach(n => n.textContent = D.path.title);
    const st = pathSteps(), dn = pathDone();
    $$("[data-pathbar]").forEach(n => n.style.setProperty("--w", (dn / st.length * 100) + "%"));
    $$("[data-pathcount]").forEach(n => n.textContent = `${dn} of ${st.length} · ${Math.round(dn / st.length * 100)}%`);
    $$("[data-pathcount2]").forEach(n => n.textContent = `${dn} of ${st.length}`);
  };
  addEventListener("storage", paint);

  // ---------- checklists (shared everywhere by storage key) ----------
  const toggleTick = (slug, i) => {
    const t = ticks(slug), before = t.slice(); t[i] = !t[i]; setTicks(slug, t);
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
    `<div class="ckf"><span>Ticks stay on this device. Pro saves them to your account.</span><a href="/app/account/#plan">See Pro</a></div></div>`;
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
    const links = $$(".snav [data-r]"), secs = links.map(a => document.getElementById(a.dataset.r)).filter(Boolean);
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
  const stateOf = s => { const k = seen(s.slug).length; return k >= nph(s) ? "done" : k || readPct(s.slug) ? "prog" : "new"; };
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
      + `<span class="num"><b>${esc(s.hv)}</b>${esc(s.hu)}${s.hl && s.hl !== "Verified" ? " " + chip(s.hl) : ""}<small>${esc(s.hd)}${staleChip(s)}</small></span>${s.spark}`
      + `<span class="tags">${wk ? '<span class="tag wkc">This week</span>' : ""}<span class="tag">${esc(s.pattern)}</span><span class="tag">${s.read} min</span></span>`
      + (st === "new" ? "" : `<span class="sp">${bar(k / nph(s))}${st === "done" ? '<span class="done">Done</span>' : `<span>${k} of ${nph(s)} phases</span>`}</span>`)
      + `</a>${s.site ? `<a class="web" href="${esc(s.site)}" target="_blank" rel="noopener" aria-label="${esc(s.name)} website"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></a>` : ""}<button class="star" type="button" data-star="${s.slug}" aria-pressed="${sv}" aria-label="${sv ? "Remove" : "Save"} ${esc(s.name)}">${STAR}</button></article>`; };
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

  // ---------- home ----------
  const homePath = $("[data-homepath]");
  const matches = () => { const q = quiz(); return (q && q.matches && q.matches.length ? q.matches : ["postiz", "stencil-ai", "gojiberry"]).filter(s => S[s]); };
  const likeYouHTML = () => '<div class="ch" style="border-top:1px solid var(--line2)"><h3 style="font:500 13.5px var(--fd);color:var(--text)">Stories like yours</h3></div>' + matches().map(s => { const x = S[s];
    return `<a class="mini" href="${x.href}"><img class="lgs" src="${esc(x.logo)}" alt="">${esc(x.name)}<span class="r">${esc(x.pattern)}${staleChip(x)}</span></a>`; }).join("");
  if (homePath) {
    const q = quiz(), st = pathSteps(), nx = st.find(s => !s.done);
    const cta = $("[data-pathcta]");
    if (q) { if (cta) { cta.textContent = "Retake quiz"; }
      homePath.innerHTML = `<h3 style="font:600 18px var(--fd)">${esc(D.path.title)}</h3><div class="pr" style="display:flex;align-items:center;gap:10px;margin-top:8px;font:500 13px var(--fn)"><span class="bar v"><i data-pathbar></i></span><span data-pathcount2></span></div>` +
        (nx ? `<div class="pstep"><span class="k">${st.indexOf(nx) + 1}</span><b>${esc(nx.text)}</b>${nx.task ? `<small>Task: ${esc(nx.task)}</small>` : ""}${nx.n ? `<a class="tl" href="${CL[D.path.source].href}#todo">Checklist item ${nx.n} · ${esc(nx.from)}</a>` : ""}</div>` : '<p class="pstep">Every step is done. New steps land with new stories.</p>');
    } else homePath.innerHTML = `<p>Eight quick questions match you with 3 stories that started a lot like you, and a ${st.length}-step path.</p><a class="btn btn-p" style="margin-top:12px" href="/app/start/?quiz=1">Take the 2-minute quiz</a>`;
    $$("[data-likeyou]").forEach(n => n.innerHTML = likeYouHTML());
    const pn = $("#pathnote"); if (pn && q && ls.get("lv-pathnote") === "new") { pn.hidden = false; $("[data-closenote]", pn).addEventListener("click", () => { pn.hidden = true; ls.set("lv-pathnote", "seen"); }); }
  }
  const homeCL = () => { const cl = $("[data-homecl]"); if (!cl) return; const q = quiz();
    const rows = D.checklists.map(c => { const t = ticks(c.slug), k = t.filter(Boolean).length; return {c, t, k}; }).filter(x => x.k > 0 && x.k < x.t.length);
    const pr = CL[WEEKS] || D.checklists[0], prT = ticks(pr.slug);
    const list = rows.length ? rows : [{c: pr, t: prT, k: prT.filter(Boolean).length}];
    cl.innerHTML = list.slice(0, 3).map(({c, t, k}) => { const i = t.indexOf(false);
      return `<a class="clrow" href="${c.href}#todo"><img src="${esc(c.logo)}" alt="" width="20" height="20" style="border-radius:4px"><span class="mid"><b>${esc(c.name)}</b><small>${i < 0 ? "All done." : "Next: " + esc(c.items[i].text)}</small></span>${bar(k / t.length)}<span class="ct">${k} of ${t.length}</span></a>`; }).join("")
      + (q ? `<a class="clrow" href="/app/path/"><span style="color:var(--violet)">●</span><span class="mid"><b>Your path · ${esc(D.path.title)}</b><small>${(() => { const s = pathSteps().find(x => !x.done); return s ? "Next: " + esc(s.text) : "All done."; })()}</small></span><span class="bar v"><i data-pathbar></i></span><span class="ct" data-pathcount2></span></a>` : ""); };
  let hf = "all";
  const hcards = $("[data-hcards]");
  const renderHome = () => {
    if (!hcards) return;
    const started = READY.filter(s => stateOf(s) !== "new"), done = READY.filter(s => stateOf(s) === "done");
    const totPh = READY.reduce((a, s) => a + nph(s), 0), seenPh = READY.reduce((a, s) => a + Math.min(nph(s), seen(s.slug).length), 0);
    const tk = D.checklists.reduce((a, c) => { const t = ticks(c.slug); return [a[0] + t.filter(Boolean).length, a[1] + t.length]; }, [0, 0]);
    const sc = READY.map(s => checkRes(s.slug)).filter(Boolean);
    const avg = sc.length ? Math.round(sc.reduce((a, r) => a + r.last / r.n, 0) / sc.length * 100) : 0, best = sc.length ? Math.max(...sc.map(r => Math.round(r.best / r.n * 100))) : 0;
    const tile = (k, v, sub, f) => `<div class="htile"><span class="k">${k}</span><b>${v}</b>${bar(f)}<small>${sub}</small></div>`;
    $("[data-hstats]").innerHTML = tile("Stories started", `${started.length}<small> of ${READY.length}</small>`, `${done.length} finished`, started.length / READY.length)
      + tile("Lessons seen", `${seenPh}<small> of ${totPh}</small>`, "Phases you've read", seenPh / totPh)
      + tile("Checklist ticks", `${tk[0]}<small> of ${tk[1]}</small>`, "Across every story", tk[0] / Math.max(1, tk[1]))
      + tile("Story check", sc.length ? `${avg}%` : "None yet", sc.length ? `Average of ${sc.length} · best ${best}%` : "Take one at the end of a story", avg / 100);
    const adult = ls.get("lv-age") === "21 or older";
    $("[data-hsum]").textContent = started.length ? `You've started ${started.length} of ${READY.length} breakdowns and seen ${seenPh} lessons.${tk[0] ? ` ${tk[0]} checklist ticks so far.` : ""}`
      : `${READY.length} breakdowns ready. Start with this week's${adult ? "." : ": each one ends with steps that fit around school."}`;
    const last = ls.get("lv-last"), L = last && S[last.slug] && S[last.slug].status === "ready" ? S[last.slug] : S[WEEKS];
    if (L) { const n = nph(L), k = Math.min(n, seen(L.slug).length), ph = Math.min(n, (last && last.slug === L.slug && last.ph) || 1), fresh = !last;
      $("[data-hcont]").innerHTML = `<section class="card hcont"><span class="logo big">${logo(L, 40)}</span><div class="mid"><span class="k">${fresh ? "This week's breakdown" : "Continue reading"}</span><h2>${esc(L.title || L.name)}</h2>${bar(k / n)}<span class="pm">${fresh ? `${n} phases · ${L.read} min` : `Phase ${ph} of ${n} · ${k} of ${n} seen`}</span></div><a class="btn btn-p" href="${L.href}#ph${ph}">${fresh ? "Start" : "Resume"} <span class="arr" aria-hidden="true">→</span></a></section>`; }
    const q = quiz(), hq = $("[data-hquiz]");
    if (hq) hq.innerHTML = q ? (() => { const t = q.top && S[q.top] ? S[q.top] : S[(q.matches || [])[0]];
        return `<div class="ch"><h2>Your quiz</h2><a class="tl" href="/app/start/?quiz=1">Retake</a></div><div class="cb">${t ? `<a class="mini" href="${t.href}">${logo(t, 24)}<span><b>${esc(t.name)}</b><small>${esc(t.pattern)}</small></span><span class="r">Top match</span></a>` : ""}<p class="qm">${q.top && q.why && q.why.length ? "Matched on: " + esc(q.why.join(" · ")) : "No single story matched your answers, so you got the general path."}</p></div>`; })()
      : `<div class="ch"><h2>Your quiz</h2></div><div class="cb"><p>Eight quick questions match you with 3 stories that started a lot like you.</p><a class="btn btn-p" style="margin-top:12px" href="/app/start/?quiz=1">Take the 2-minute quiz</a></div>`;
    $$("[data-hf]").forEach(b => b.setAttribute("aria-pressed", b.dataset.hf === hf));
    const sv = savedList(), list = READY.filter(s => hf === "all" || (hf === "saved" ? sv.includes(s.slug) : stateOf(s) === hf)).sort((a, b) => (b.slug === WEEKS) - (a.slug === WEEKS));
    hcards.innerHTML = list.length ? list.map(storyCard).join("") : `<div class="empty"><p>${hf === "saved" ? "Nothing saved yet. Tap the star on a story to keep it here." : "No stories here yet."}</p></div>`;
    const act = arr("lv-activity");
    $("[data-hact]").innerHTML = act.length ? act.map(a => `<li><span>${esc(a.m)}</span><time>${ago(a.t)}</time></li>`).join("") : '<li class="empty">Read a phase, tick an item or take a story check, and it shows up here.</li>';
    homeCL();
  };
  $$("[data-hf]").forEach(b => b.addEventListener("click", () => { hf = b.dataset.hf; renderHome(); syncStars(); }));

  // ---------- saved ----------
  const renderSaved = () => { const sc = $("[data-savedcards]"); if (!sc) return;
    const L = savedList().map(k => S[k]).filter(Boolean);
    $("[data-savedcount]").textContent = L.length ? `${L.length} saved` : "";
    sc.innerHTML = L.length ? L.map(storyCard).join("") : '<div class="empty"><p>No saved stories yet. Tap the star on any story to keep it here.</p><a class="btn btn-s" href="/app/library/">Open the Library</a></div>';
    const I = savedItems().map(k => { const [slug, i] = k.split(":"), c = CL[slug]; return c && c.items[+i] ? {k, c, i: +i, it: c.items[+i]} : null; }).filter(Boolean);
    $("[data-saveditems]").innerHTML = I.length ? I.map(({k, c, i, it}) => `<div class="sitem"><a href="${c.href}#todo">${logo(c, 20)}<span><b>${esc(it.text)}</b><small>${esc(c.name)} · item ${i + 1}${ticks(c.slug)[i] ? " · ticked" : ""}</small></span></a><button class="ckstar" type="button" data-staritem="${k}" aria-pressed="true" aria-label="Remove this item">${STAR}</button></div>`).join("")
      : '<div class="empty"><p>Star a checklist item at the end of a story to keep it here.</p></div>'; };

  // ---------- library: cards only, ready stories only ----------
  const lout = $("#lout");
  const drawLib = () => {};
  let libDraw = drawLib;
  if (lout) {
    const qs = new URLSearchParams(location.search);
    const st = Object.assign({q: "", tab: "all", pat: "", sort: "new", lp: ""}, ls.get("lv-lib", {}), qs.get("pattern") ? {pat: qs.get("pattern")} : {}, qs.get("tab") ? {tab: qs.get("tab")} : {});
    const pats = [...new Set(READY.map(s => s.pattern))].sort((a, b) => a.localeCompare(b));
    $("#lpat").insertAdjacentHTML("beforeend", pats.map(p => `<option>${esc(p)}</option>`).join(""));
    if (!pats.includes(st.pat)) st.pat = "";
    const ctl = () => { $("#lq").value = st.q; $("#lpat").value = st.pat; $("#lsort").value = st.sort;
      $$("[data-tab]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === st.tab)); $$("[data-lp]").forEach(b => b.setAttribute("aria-pressed", b.dataset.lp === (st.lp || ""))); };
    libDraw = () => {
      ls.set("lv-lib", st); ctl();
      const q = st.q.trim().toLowerCase(), sv = savedList();
      let L = READY.filter(s => (st.tab === "all" || s.tab === st.tab) && (!st.pat || s.pattern === st.pat)
        && (!st.lp || (st.lp === "saved" ? sv.includes(s.slug) : stateOf(s) === st.lp))
        && (!q || [s.name, s.what, s.pattern, ...(s.lessons || [])].join(" ").toLowerCase().includes(q)));
      const key = {new: s => (s.published || "") + (s.stale ? "0" : "1") + String(1e9 - D.stories.indexOf(s)).padStart(10, "0"), mrr: s => s.mrr || 0, growth: s => s.growth == null ? -1e9 : s.growth}[st.sort] || (s => s.published || "");
      L.sort((a, b) => key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0);
      $("[data-lcount]").textContent = L.length === READY.length ? `${READY.length} breakdowns` : `${L.length} of ${READY.length} breakdowns`;
      lout.innerHTML = L.length ? L.map(storyCard).join("") : `<div class="card empty"><h3>No stories match these filters</h3><p>One new breakdown arrives each week.</p><button class="btn btn-s" type="button" data-clearall>Clear filters</button></div>`;
    };
    $("#lq").addEventListener("input", e => { st.q = e.target.value; libDraw(); });
    $("#lpat").addEventListener("change", e => { st.pat = e.target.value; libDraw(); });
    $("#lsort").addEventListener("change", e => { st.sort = e.target.value; libDraw(); });
    $$("[data-tab]").forEach(b => b.addEventListener("click", () => { st.tab = b.dataset.tab; libDraw(); }));
    $$("[data-lp]").forEach(b => b.addEventListener("click", () => { st.lp = b.dataset.lp; libDraw(); }));
    const clear = () => { Object.assign(st, {q: "", tab: "all", pat: "", lp: ""}); libDraw(); };
    $("#lclear").addEventListener("click", clear); lout.addEventListener("click", e => { if (e.target.closest("[data-clearall]")) clear(); });
  }

  // ---------- reader: lessons seen (a phase counts after 1 s at half visible), story check ----------
  if (rd && "IntersectionObserver" in window) {
    const slug = rd.dataset.reader, nm = (S[slug] || {}).name || slug, tmr = new Map();
    if (S[slug]) { const l = ls.get("lv-last"); if (!l || l.slug !== slug) ls.set("lv-last", {slug, ph: 1, t: Date.now()}); }
    const mark = p => { const v = seen(slug); ls.set("lv-last", {slug, ph: p, t: Date.now()}); if (v.includes(p)) return;
      ls.set("lv-seen-" + slug, [...v, p].sort((a, b) => a - b)); logAct(`Saw phase ${p} of ${nm}`); if (v.length + 1 === +rd.dataset.phases) logAct(`Finished ${nm}`); };
    const io = new IntersectionObserver(es => es.forEach(e => { const p = +e.target.dataset.ph;
      if (e.isIntersecting && e.target.open !== false && (e.intersectionRatio >= .5 || e.intersectionRect.height >= innerHeight * .5)) { if (!tmr.has(p)) tmr.set(p, setTimeout(() => mark(p), 1000)); }
      else { clearTimeout(tmr.get(p)); tmr.delete(p); } }), {threshold: [0, .25, .5, .75, 1]});
    $$(".ph[data-ph]", rd).forEach(p => { if (!p.closest(".fade")) io.observe(p); });
  }
  if (rd) {   // phases fold on phones (first open); the section chips follow the scroll
    if (innerWidth < 600) $$("details.ph", rd).forEach((d, i) => { if (i && !(location.hash === "#" + d.id)) d.open = false; });
    const hp = location.hash && document.getElementById(location.hash.slice(1)); if (hp && hp.tagName === "DETAILS") hp.open = true;
    const nav = $(".snav-in"); let lastOn = null;
    addEventListener("scroll", () => { const on = nav && $("a.on", nav); if (on && on !== lastOn) { lastOn = on; nav.scrollTo({left: on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2, behavior: reduce ? "auto" : "smooth"}); } }, {passive: true});
  }
  $$("[data-check]").forEach(box => {
    const slug = box.dataset.check, nm = (S[slug] || {}).name || slug, body = $("[data-checkbody]", box); let Q;
    try { Q = JSON.parse($("script", box).textContent); } catch { return; }
    const form = () => { const r = checkRes(slug);
      body.innerHTML = `<form class="ckform">${Q.map((q, i) => `<fieldset><legend><span class="qn">${i + 1}</span>${esc(q.q)}</legend>${q.o.map((o, j) => `<label class="opt2"><input type="radio" name="q${i}" value="${j}" required><span>${esc(o)}</span></label>`).join("")}</fieldset>`).join("")}`
        + `<div class="ckact"><button class="btn btn-p" type="submit">Check my answers</button>${r ? `<span>Best so far: ${r.best} of ${r.n}</span>` : ""}</div></form>`;
      $("form", body).addEventListener("submit", ev => { ev.preventDefault(); const fd = new FormData(ev.target), got = Q.map((q, i) => +fd.get("q" + i)), score = got.filter((g, i) => g === Q[i].a).length;
        const prev = checkRes(slug) || {best: 0}; ls.set("lv-check-" + slug, {best: Math.max(prev.best, score), last: score, n: Q.length, t: Date.now()}); logAct(`Scored ${score}/${Q.length} on the ${nm} check`);
        body.innerHTML = `<div class="ckres" tabindex="-1"><p class="sc"><b>${score} of ${Q.length}</b> right${score === Q.length ? ". Every one." : ""}</p>${bar(score / Q.length)}<ol>${Q.map((q, i) => { const ok = got[i] === q.a;
          return `<li class="${ok ? "ok" : "no"}"><b>${esc(q.q)}</b><span>${ok ? "Right" : "Not quite"}: ${esc(q.o[q.a])}${ok ? "" : ` (you picked ${esc(q.o[got[i]])})`}</span><small>${esc(q.e)}</small></li>`; }).join("")}</ol><button class="btn btn-s" type="button" data-retake>Retake</button></div>`;
        $(".ckres", body).focus(); $("[data-retake]", body).addEventListener("click", form); }); };
    form();
  });

  const renderAll = () => { renderHome(); renderSaved(); libDraw(); syncStars(); paint(); };
  addEventListener("storage", renderAll);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) renderAll(); });
  addEventListener("lv:changed", () => { clearTimeout(renderAll.t); renderAll.t = setTimeout(() => { renderHome(); renderSaved(); syncStars(); }, 50); });

  // ---------- my path ----------
  const stepsEl = $("[data-steps]");
  function renderPath() {
    if (!stepsEl) return; const st = pathSteps(), cur = st.findIndex(s => !s.done), src = CL[D.path.source];
    const one = (s, i) => { const state = s.done ? "done" : i === cur ? "now" : "";
      return `<div class="pstp ${state}"><span class="dot">${s.done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : i + 1}</span><div><p>${esc(s.text)}</p>${state === "now" && s.task ? `<p class="task">Task: ${esc(s.task)}</p>` : ""}
        <p class="pm">${s.extra ? (s.href ? `<a href="${s.href}">${esc(s.from)} ↗</a>` : esc(s.from)) : `Checklist item ${s.n} · <a href="${src.href}#todo">${esc(s.from)} ↗</a>`}</p>${state === "now" ? `<button class="btn btn-p" type="button" data-stepdone="${i}">Mark step done</button>` : s.done ? `<button class="tl" type="button" data-stepundo="${i}">Undo</button>` : ""}</div><span class="dt">${s.done && s.date ? "Done " + esc(s.date) : ""}</span></div>`; };
    stepsEl.innerHTML = st.filter(s => !s.extra).map((s, i) => one(s, i)).join("");
    const ex = $("[data-extra]"); if (ex) ex.innerHTML = one(st[st.length - 1], st.length - 1);
    const q = quiz(); const ed = $("[data-editq]"); if (ed) ed.textContent = q ? "Edit answers" : "Take the quiz"; const m = $("[data-matched]"); if (m) m.textContent = !q ? "Take the quiz to match stories to you. The steps work either way." : q.top && q.why ? "Matched on: " + q.why.join(" · ") : q.top === null ? "No single story matched your answers, so this is the general path." : "From your quiz: " + (q.summary || "");
    const ps = $("[data-pathsrc]"); if (ps) ps.innerHTML = `<img src="${esc(src.logo)}" alt="" width="16" height="16" style="vertical-align:-3px;margin-right:6px">From the ${esc(src.name)} breakdown`;
    $$("[data-likeyou]").forEach(n => { if (!n.closest("section").querySelector("[data-homepath]")) n.innerHTML = matches().map(s => { const x = S[s];
      return `<a class="mini${x.status === "soon" ? " soon" : ""}" href="${x.href}" style="min-height:56px"><img class="lgs" src="${esc(x.logo)}" alt=""><span><span style="display:block">${esc(x.name)}</span><small class="meta">${x.status === "ready" ? esc(x.pattern) : "Coming soon"}${staleChip(x)}</small></span><span class="r">›</span></a>`; }).join(""); });
    paint();
  }
  if (stepsEl) {
    stepsEl.parentElement.parentElement.addEventListener("click", e => {
      const d = e.target.closest("[data-stepdone],[data-stepundo]"); if (!d) return;
      const i = +(d.dataset.stepdone ?? d.dataset.stepundo), s = pathSteps()[i];
      if (s.extra) { const v = s.done ? null : today(); ls.set("lv-path-extra", v); renderPath(); toast(v ? "Step done. Saved on this device." : "Step reopened."); }
      else toggleTick(D.path.source, s.n - 1);
    });
    renderPath();
  }

  // ---------- checklists page ----------
  const cls = $("[data-cllists]");
  if (cls) {
    const order = D.checklists.slice().sort((a, b) => ticks(b.slug).filter(Boolean).length - ticks(a.slug).filter(Boolean).length);
    const anyTick = D.checklists.some(c => ticks(c.slug).some(Boolean)), first = D.checklists.find(c => !(S[c.slug] || {}).stale) || D.checklists[0];
    const empty = anyTick ? "" : `<section class="card" style="margin-bottom:16px"><div class="empty"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 6l1.2 1.2L7 5.2M4 12l1.2 1.2L7 11.2M4 18l1.2 1.2L7 17.2"/></svg><h3>No ticks yet</h3><p>Each breakdown ends with a short checklist. Tick a step there and it shows up here.</p><a class="btn btn-s" href="${first.href}#todo"><img src="${esc(first.logo)}" alt="" width="18" height="18" style="border-radius:4px">Open the ${esc(first.name)} checklist</a></div></section>`;
    cls.innerHTML = empty + order.map((c, i) => { const n = ticks(c.slug).filter(Boolean).length;
      return `<details class="clgrp" ${n ? "open" : ""}><summary class="gh" style="cursor:pointer;list-style:none;min-height:44px"><img src="${esc(c.logo)}" alt="" width="20" height="20" style="border-radius:4px"><h2>${esc(c.name)} <small>· What you could do at 15 to 20</small></h2><a class="tl" href="${c.href}">Open breakdown</a></summary>${ckListHTML(c)}</details>`; }).join("");
    const soon = D.stories.filter(s => s.status === "soon");
    const cs = $("[data-clsoon]"); if (cs) cs.innerHTML = soon.map(s => `<a class="soonrow" href="${s.href}">${logo(s, 20)}<span class="nm" style="color:var(--muted)">${esc(s.name)}</span><span class="meta">Checklist arrives with the breakdown</span></a>`).join("");
  }

  // ---------- account ----------
  const agesel = $("#agesel");
  if (agesel) {
    agesel.value = ls.get("lv-age", "") || ""; const note = () => { const a = agesel.value; $("[data-agenote]").textContent = !a ? "Set your age range so the right rules apply." : (a === "13 to 15" || a === "16 to 17") ? a + " · a parent pays for paid plans" : a === "21 or older" ? a + " · LaunchVault is built for 15 to 20, but anyone is welcome to read" : a;
      const minor = !a || a === "13 to 15" || a === "16 to 17"; const ps = $("#parent"); if (ps) ps.hidden = !minor; const pl = $('.anav a[href="#parent"]'); if (pl) pl.hidden = !minor; };
    note(); agesel.addEventListener("change", () => { ls.set("lv-age", agesel.value || null); note(); toast("Saved on this device."); });
    const bill = y => { $$("[data-bill]").forEach(b => b.setAttribute("aria-pressed", (b.dataset.bill === "y") === y));
      $('[data-pr="pro"]').textContent = y ? "$6.49" : "$7.99"; $('[data-pr="developer"]').textContent = y ? "$23.99" : "$29.99";
      $('[data-ps="pro"]').textContent = y ? "a month, $77.88 billed yearly · $7.99 monthly" : "a month · $6.49 a month billed yearly"; $('[data-ps="developer"]').textContent = y ? "a month, $287.88 billed yearly · $29.99 monthly" : "a month · $23.99 a month billed yearly"; };
    $$("[data-bill]").forEach(b => b.addEventListener("click", () => bill(b.dataset.bill === "y"))); bill(true);
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
    $("#del").addEventListener("click", () => { if (!confirm("Delete everything LaunchVault saved on this device? This can't be undone.")) return; ls.keys().forEach(ls.del); location.reload(); });
    const so = $("#so"); if (so && window.LVAuth) so.addEventListener("click", () => LVAuth.signOut());
    const nav = $$(".anav a"); addEventListener("scroll", () => { let cur = nav[0]; nav.forEach(a => { const t = document.querySelector(a.getAttribute("href")); if (t && t.getBoundingClientRect().top < 140) cur = a; }); nav.forEach(a => a.classList.toggle("on", a === cur)); }, {passive: true});
  }

  // ---------- onboarding: age -> 8 questions (Skip any) -> result -> Home. Under 13 stops and stores nothing. ----------
  const obc = $("#obc");
  if (obc) {
    const AGES = ["Under 13", "13 to 15", "16 to 17", "18 to 20", "21 or older"];
    const params = new URLSearchParams(location.search);
    let age = ls.get("lv-age"), step = params.get("quiz") && age ? 0 : -1, ans = ((quiz() || {}).answers || []).slice();
    while (ans.length < D.quiz.length) ans.push(null);
    const H = $("[data-obh]"), P = $("[data-obp]");
    const opt = (t, on, i) => `<button class="opt" type="button" role="radio" aria-checked="${on}" data-o="${i}"><i></i>${esc(t)}</button>`;
    const scores = () => { const sc = {}; ans.forEach((a, qi) => { if (a == null) return; const w = D.quiz[qi].w[a] || {}; for (const k in w) sc[k] = (sc[k] || 0) + w[k]; }); return sc; };
    const score = () => { const sc = scores(), base = ["postiz", "stencil-ai", "gojiberry", "windmill-growth", "dm-champ"];
      return base.filter(k => S[k]).sort((a, b) => (sc[b] || 0) - (sc[a] || 0) || base.indexOf(a) - base.indexOf(b)).slice(0, 3); };
    // a real match needs a clear lead; a tie at the top (or no answers) is said plainly
    const topOf = () => { const sc = scores(), v = Object.values(sc).sort((a, b) => b - a); if (!v.length || v[0] === v[1]) return null; return score()[0]; };
    const summary = () => [age, ...ans.map((a, i) => a == null ? null : D.quiz[i].o[a])].filter(Boolean).join(" · ");
    const why = t => t ? ans.map((a, i) => a != null && (D.quiz[i].w[a] || {})[t] ? D.quiz[i].o[a] : null).filter(Boolean) : [];
    const save = () => { const t = topOf(); ls.set("lv-quiz-app", {answers: ans, matches: score(), top: t, why: why(t), summary: summary(), date: today()}); D.path = t ? pathFor(score()) : D.path; };
    const render = () => {
      if (step === -1) { H.innerHTML = "You're in. <em>One quick question.</em>"; P.textContent = "We ask your age range so the right rules apply. It's the only personal detail we keep, and it stays on this device.";
        obc.innerHTML = `<h2>How old are you?</h2><div class="opts" role="radiogroup" aria-label="Age range">${AGES.map((a, i) => opt(a, age === a, i)).join("")}</div><p class="fine">We keep the range, not your birthday. Under 18: a parent pays if you upgrade.</p><div class="obnav"><span class="sp"></span><button class="btn btn-p" type="button" data-next ${age ? "" : "disabled"}>Continue</button></div>`; }
      else if (step === -2) { H.innerHTML = "Thanks for <em>being honest.</em>"; P.textContent = "";
        obc.innerHTML = `<div class="stop"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19.99 14.91A8.5 8.5 0 1 1 10.52 3.63"/><path d="M6.8 15.6l3.7-3.7 2.6 2.6 6.7-6.7"/><path d="M16 7.8h3.8v3.8"/></g></svg><h2>LaunchVault is for 13 and up</h2><p>We didn't save your answer or anything else. Come back when you're 13.</p><a class="btn btn-s" href="/">Back to the site</a></div>`; }
      else if (step < D.quiz.length) { const Q = D.quiz[step];
        H.innerHTML = "Eight questions. <em>Under two minutes.</em>"; P.textContent = "Your answers pick 3 stories that started a lot like you. Skip any question you don't want to answer.";
        obc.innerHTML = `<div class="qp"><span class="bar v"><i style="--w:${step / D.quiz.length * 100}%"></i></span><span>${step + 1} of ${D.quiz.length}</span></div><h2 id="qh">${esc(Q.q)}</h2><div class="opts" role="radiogroup" aria-labelledby="qh">${Q.o.map((o, i) => opt(o, ans[step] === i, i)).join("")}</div>
          <div class="obnav"><button class="bk" type="button" data-back>Back</button><span class="sp"></span><button class="sk" type="button" data-skip>Skip</button><button class="btn btn-p" type="button" data-next>${step === D.quiz.length - 1 ? "See my path" : "Next"}</button></div><a class="tl obskip" href="/app/" data-skipall>Skip the quiz for now</a>`; }
      else { save(); ls.set("lv-pathnote", "new"); const m = score();
        H.innerHTML = `Your path: <em>${esc(D.path.title.toLowerCase().replace(/^./, c => c.toUpperCase()))}.</em>`; const qq = quiz();
        P.innerHTML = `${D.path.steps.length + 1} steps${ADULT() ? "" : " that fit around school"}, from the ${esc(D.path.name || "Postiz")} breakdown. Step 1 is waiting on Home.`
          + (qq.top ? `<small>Matched on: ${esc(qq.why.join(" · "))}</small>` : `<small>Your answers didn't point to one story more than the others, so this is the general path. The 3 stories below are the closest.</small>`)
          + `<small>Your answers: ${esc(summary())} · <a class="tl" href="/app/start/?quiz=1">Edit answers</a></small>`;
        obc.innerHTML = `<h2>Stories like yours</h2><div style="margin-top:8px">${m.map(s => { const x = S[s];
          return `<div class="mrow"><span class="logo">${logo(x, 22)}</span><span style="flex:1;min-width:0"><b>${esc(x.name)}</b><small>${esc(x.pattern)}</small><span class="nm"><b>${esc(x.hv)}</b>${esc(x.hu)}${chip(x.hl)}${esc(x.hd)}${staleChip(x)}</span></span><span class="r">${x.status === "ready" ? `<a href="${x.href}">Read now</a>` : "Breakdown soon"}</span></div>`; }).join("")}</div>
          <a class="btn btn-p" style="width:100%;margin-top:16px" href="/app/">Go to Home</a><p class="fine">Saved on this device. Pro saves your path to your account and updates it as stories land.</p>`; }
      if (render.n++) obc.focus({preventScroll: true});
    };
    render.n = 0;
    obc.addEventListener("click", e => {
      const o = e.target.closest(".opt");
      if (o) { const i = +o.dataset.o; if (step === -1) { age = AGES[i]; } else { ans[step] = ans[step] === i ? null : i; } $$(".opt", obc).forEach(x => x.setAttribute("aria-checked", +x.dataset.o === i && (step === -1 || ans[step] === i))); const nx = $("[data-next]", obc); if (nx) nx.disabled = false; return; }
      if (e.target.closest("[data-next]")) { if (step === -1) { if (age === "Under 13") { ls.keys().forEach(ls.del); age = null; step = -2; } else { ls.set("lv-age", age); step = 0; } } else step++; render(); return; }
      if (e.target.closest("[data-skip]")) { ans[step] = null; step++; render(); return; }
      if (e.target.closest("[data-back]")) { step = step === 0 ? -1 : step - 1; render(); return; }
      if (e.target.closest("[data-skipall]")) { if (age && age !== "Under 13") ls.set("lv-age", age); }
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
      } catch (err) { send.disabled = false; msg.className = "rmsg err"; msg.textContent = "Sorry, that didn't send (" + err.message + "). Please try again in a minute."; }
    });
    d.showModal(); $("#rwhat", d).focus();
  });

  syncChecklists(); renderAll();
})();
