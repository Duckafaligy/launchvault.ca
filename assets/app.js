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
    const links = $$(".rail [data-r]"), secs = links.map(a => document.getElementById(a.dataset.r)).filter(Boolean);
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

  // ---------- home ----------
  const homePath = $("[data-homepath]");
  const matches = () => { const q = quiz(); return (q && q.matches && q.matches.length ? q.matches : ["postiz", "stencil-ai", "gojiberry"]).filter(s => S[s]); };
  const likeYouHTML = () => '<div class="ch" style="border-top:1px solid var(--line2)"><h3 style="font:500 13.5px var(--fd);color:var(--muted)">Stories like yours</h3></div>' + matches().map(s => { const x = S[s];
    return `<a class="mini${x.status === "soon" ? " soon" : ""}" href="${x.href}"><img class="lgs" src="${esc(x.logo)}" alt="">${esc(x.name)}<span class="r">${x.status === "ready" ? esc(x.pattern) : "Soon"}${staleChip(x)}</span></a>`; }).join("");
  if (homePath) {
    const q = quiz(), st = pathSteps(), nx = st.find(s => !s.done);
    const cta = $("[data-pathcta]");
    if (q) { if (cta) { cta.textContent = "Retake quiz"; }
      homePath.innerHTML = `<p class="meta">${esc(q.summary || "")} <a class="tl" href="/app/start/?quiz=1" style="float:right">Edit</a></p><h3 style="font:600 18px var(--fd);margin-top:6px">${esc(D.path.title)}</h3><div class="pr" style="display:flex;align-items:center;gap:10px;margin-top:8px;font:500 13px var(--fn)"><span class="bar v"><i data-pathbar></i></span><span data-pathcount2></span></div>` +
        (nx ? `<div class="pstep"><span class="k">${st.indexOf(nx) + 1}</span><b>${esc(nx.text)}</b>${nx.task ? `<small>Task: ${esc(nx.task)}</small>` : ""}${nx.n ? `<a class="tl" href="${CL[D.path.source].href}#todo">Checklist item ${nx.n} · ${esc(nx.from)}</a>` : ""}</div>` : '<p class="pstep">Every step is done. New steps land with new stories.</p>');
    } else homePath.innerHTML = `<p>Eight quick questions match you with 3 stories that started a lot like you, and a ${st.length}-step path.</p><a class="btn btn-p" style="margin-top:12px" href="/app/start/?quiz=1">Take the 2-minute quiz</a>`;
    $$("[data-likeyou]").forEach(n => n.innerHTML = likeYouHTML());
    const cl = $("[data-homecl]");
    if (cl) { const rows = D.checklists.map(c => { const t = ticks(c.slug), k = t.filter(Boolean).length; return {c, t, k}; }).filter(x => x.k > 0 && x.k < x.t.length);
      const wk = D.stories.find(x => x.status === "ready" && !x.stale) || {}, pr = CL[wk.slug] || D.checklists[0], prT = ticks(pr.slug);
      const list = rows.length ? rows : [{c: pr, t: prT, k: prT.filter(Boolean).length}];
      cl.innerHTML = list.slice(0, 3).map(({c, t, k}) => { const i = t.indexOf(false);
        return `<a class="clrow" href="${c.href}#todo"><img src="${esc(c.logo)}" alt="" width="20" height="20" style="border-radius:4px"><span class="mid"><b>${esc(c.name)} · What you could do at 15 to 20</b><small>${i < 0 ? "All done." : "Next: " + esc(c.items[i].text)}</small></span><span class="bar"><i style="--w:${k / t.length * 100}%"></i></span><span class="ct">${k} of ${t.length}</span></a>`; }).join("")
        + (q ? `<a class="clrow" href="/app/path/"><span style="color:var(--violet)">●</span><span class="mid"><b>Your path · ${esc(D.path.title)}</b><small>${(() => { const s = pathSteps().find(x => !x.done); return s ? "Next: " + esc(s.text) : "All done."; })()}</small></span><span class="bar v"><i data-pathbar></i></span><span class="ct" data-pathcount2></span></a>` : ""); }
    const w = D.stories.find(s => s.status === "ready" && !s.stale) || D.stories[0], r = ls.get("lv-read-" + w.slug, {}) || {};
    if (r.pct > 0 && r.pct < 98) { $("#contcard").hidden = false; const sub = $("[data-contsub]"); if (sub) sub.textContent = r.ph ? `Phase ${r.ph} of ${r.n} · ${r.name || ""}` : ""; }
    const pn = $("#pathnote"); if (pn && q && ls.get("lv-pathnote") === "new") { pn.hidden = false; $("[data-closenote]", pn).addEventListener("click", () => { pn.hidden = true; ls.set("lv-pathnote", "seen"); }); }
  }

  // ---------- library ----------
  const lout = $("#lout");
  if (lout) {
    const qs = new URLSearchParams(location.search);
    const st = Object.assign({q: "", tab: "all", pat: "", stat: "", sort: "new", ver: false, view: "list", grp: "all"}, ls.get("lv-lib", {}),
      qs.get("group") ? {grp: qs.get("group")} : {}, qs.get("pattern") ? {pat: qs.get("pattern")} : {}, qs.get("tab") ? {tab: qs.get("tab")} : {});
    const pats = [...new Set(D.stories.map(s => s.pattern))].sort((a, b) => (a === "Pattern not checked yet") - (b === "Pattern not checked yet") || a.localeCompare(b));
    $("#lpat").insertAdjacentHTML("beforeend", pats.map(p => `<option>${esc(p)}</option>`).join(""));
    const ctl = () => { $("#lq").value = st.q; $("#lpat").value = st.pat; $("#lstat").value = st.stat; $("#lsort").value = st.sort; $("#lver").setAttribute("aria-checked", st.ver);
      $$("[data-tab]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === st.tab)); $$("[data-view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === st.view));
      $$("[data-grp]").forEach(b => b.setAttribute("aria-pressed", b.dataset.grp === st.grp)); };
    const status = s => { if (s.status === "ready") { const p = readPct(s.slug); return `<span class="st ok">Ready${p ? ` <em>${p}%</em>` : ""}${s.stale ? ' <span class="lb n" title="' + esc(s.stale) + '">Stale</span>' : ""}</span>`; } return `<span class="st">${s.stale ? '<span class="lb n">Stale</span>' : "Coming soon"}</span>`; };
    const row = s => `<a class="lrow${s.status === "soon" ? " soon" : ""}" href="${s.href}"><span class="co">${logo(s, 22)}<span><b>${esc(s.name)}</b><small>${esc(s.what)}</small></span></span><span class="tp">${esc(s.type)}</span><span class="tr">${s.spark}</span><span class="num"><b>${esc(s.hv)}</b>${esc(s.hu)}<small>${esc(s.sub || "Read " + s.hd)}</small><span class="lbm">${chip(s.hl)}${s.stale ? '<span class="lb n">Stale</span>' : ""}</span></span><span class="lbc">${chip(s.hl)}</span>${status(s)}<span class="go" aria-hidden="true">›</span></a>`;
    const card = s => `<a class="lcard" href="${s.href}"><span class="top2">${logo(s, 28)}<b style="color:#0B1220">${esc(s.name)}</b><span class="meta" style="margin-left:auto">${esc(s.type)}</span></span><span class="what">${esc(s.what)}</span>${s.spark}<span class="nl"><b>${esc(s.hv)}</b>${esc(s.hu)}${chip(s.hl)}<span>${esc(s.sub || s.hd)}</span></span><span class="st"><span>${s.status === "ready" ? (s.read ? s.read + " min read" : "Ready") : "Coming soon"}</span>${s.status === "ready" && readPct(s.slug) ? `<span style="color:var(--brand)">${readPct(s.slug)}%</span>` : ""}</span></a>`;
    const draw = () => {
      ls.set("lv-lib", st); ctl();
      const q = st.q.trim().toLowerCase();
      let L = D.stories.filter(s => (st.tab === "all" || s.tab === st.tab) && (!st.pat || s.pattern === st.pat) && (!st.stat || s.status === st.stat) && (!st.ver || s.hl === "Verified")
        && (!q || [s.name, s.what, s.pattern, ...(s.lessons || [])].join(" ").toLowerCase().includes(q)));
      const key = {new: s => (s.status === "ready" ? "1" : "0") + (s.published || "") + (s.stale ? "0" : "1") + String(1e9 - D.stories.indexOf(s)).padStart(10, "0"), mrr: s => s.mrr || 0, growth: s => s.growth == null ? -1e9 : s.growth}[st.sort];
      L.sort((a, b) => key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0);
      if (!L.length) { lout.innerHTML = `<div class="card" style="margin-top:16px"><div class="empty"><h3>No stories match these filters</h3><p>One new breakdown arrives each week.</p><button class="btn btn-s" type="button" data-clearall>Clear filters</button></div></div>`; return; }
      const groups = st.grp === "pattern" ? pats.map(p => [p, L.filter(s => s.pattern === p)]).filter(g => g[1].length) : [["", L]];
      if (st.view === "cards") lout.innerHTML = groups.map(([g, l]) => (g ? `<h2 class="lgroup" style="margin-top:20px;border:1px solid var(--line);border-radius:10px">${esc(g)}</h2>` : "") + `<div class="lcards">${l.map(card).join("")}</div>`).join("");
      else lout.innerHTML = `<div class="ltab"><div class="lhead"><span>Company</span><span class="c-tp">Type</span><span>Trend</span><span class="r">Latest number</span><span>Label</span><span class="c-st">Status</span><span></span></div>` +
        groups.map(([g, l]) => (g ? `<div class="lgroup">${esc(g)}</div>` : "") + l.map(row).join("")).join("") + "</div>";
    };
    $("#lq").addEventListener("input", e => { st.q = e.target.value; draw(); });
    $("#lpat").addEventListener("change", e => { st.pat = e.target.value; draw(); });
    $("#lstat").addEventListener("change", e => { st.stat = e.target.value; draw(); });
    $("#lsort").addEventListener("change", e => { st.sort = e.target.value; draw(); });
    $("#lver").addEventListener("click", () => { st.ver = !st.ver; draw(); });
    $$("[data-tab]").forEach(b => b.addEventListener("click", () => { st.tab = b.dataset.tab; draw(); }));
    $$("[data-view]").forEach(b => b.addEventListener("click", () => { st.view = b.dataset.view; draw(); }));
    $$("[data-grp]").forEach(b => b.addEventListener("click", () => { st.grp = b.dataset.grp; draw(); }));
    const clear = () => { Object.assign(st, {q: "", tab: "all", pat: "", stat: "", ver: false}); draw(); };
    $("#lclear").addEventListener("click", clear); lout.addEventListener("click", e => { if (e.target.closest("[data-clearall]")) clear(); });
    draw();
  }

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

  syncChecklists(); paint();
})();
