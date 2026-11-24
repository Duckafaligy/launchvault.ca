/* LaunchVault new dashboard (/new/app/): the Vault shell's own behaviour, on top of app.js (same lv-* storage keys).
   Sidebar "Continue" card, recent-activity bell, the paged story reader (one phase at a time, Paper Story reader),
   the upgrade sheet, and the small motion pieces (count-up, chart line draw). Everything honours prefers-reduced-motion. */
(() => {
  "use strict";
  if (!window.LVGate || !LVGate.ok) return;   // nothing runs before the age gate passes (same rule as app.js)
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const get = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} dispatchEvent(new Event("lv:changed")); };
  const arr = k => { const v = get(k, []); return Array.isArray(v) ? v : []; };
  const json = id => { try { return JSON.parse(document.getElementById(id).textContent); } catch { return {}; } };
  const D = json("lvapp"), COV = json("lvcov"), S = Object.fromEntries((D.stories || []).map(s => [s.slug, s]));
  const APP = "/new/app/";

  // ---------- sidebar: continue where you left off (else this week's story stays, as built) ----------
  const cont = () => { const a = $("[data-sbcont]"), l = get("lv-last"), s = l && S[l.slug]; if (!a) return;
    const x = s && s.status === "ready" && !get("lv-done-" + s.slug) ? s : null, cur = x || S[(a.getAttribute("href").match(/story\/([^/]+)/) || [])[1]]; if (!cur) return;
    const n = cur.phases || 1, k = Math.min(n, arr("lv-seen-" + cur.slug).length);
    if (x) { a.href = `${x.href}#ph${Math.min(n, l.ph || 1)}`; $("[data-sbcn]", a).textContent = "Continue: " + x.name; const im = $("img", a); if (im && COV[x.slug]) im.src = COV[x.slug]; }
    $("[data-sbcp]", a).textContent = k ? `${k} of ${n}` : ""; $("[data-sbcb]", a).style.setProperty("--w", (k / n * 100) + "%"); };
  cont(); addEventListener("lv:changed", cont); addEventListener("storage", cont);

  // ---------- bell: what you did lately on this device (lv-activity, written by app.js) ----------
  const bell = $("[data-bell]"), bm = $("#bellm");
  if (bell && bm) {
    const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
    const close = () => { bm.hidden = true; bell.setAttribute("aria-expanded", "false"); };
    bell.addEventListener("click", () => { if (!bm.hidden) return close();
      const L = arr("lv-activity").slice(0, 6);
      bm.innerHTML = `<h2>Recent activity</h2>` + (L.length ? `<ul>${L.map(x => `<li>${esc(x.m)}<small>${ago(x.t)}</small></li>`).join("")}</ul>` : `<p>Nothing yet. What you read, tick and save shows up here.</p>`);
      bm.hidden = false; bell.setAttribute("aria-expanded", "true"); });
    document.addEventListener("click", e => { if (!e.target.closest(".bellw")) close(); });
    addEventListener("keydown", e => { if (e.key === "Escape" && !bm.hidden) { close(); bell.focus(); } });
  }

  // ---------- story reader: one phase at a time ----------
  const rd = $("[data-reader]"), steps = $("[data-rsteps]");
  if (rd && steps) {
    const slug = rd.dataset.reader, n = +rd.dataset.phases, phases = $$(".ph[data-ph]", rd).filter(p => !p.closest(".fade"));
    const names = phases.map(p => ($("summary b", p) || {}).textContent || ""), bar = $("[data-rbar]"), sec = $("#phases", rd);
    const doneB = $("[data-rdonebtn]"), nextB = $("[data-rnextbtn]"), nextL = $("[data-rnextl]"), title = $("[data-rtitle]");
    if (bar && sec) sec.after(bar);
    rd.classList.add("paged");
    const seen = () => arr("lv-seen-" + slug);
    let cur = 0;
    const paint = () => { const sn = seen();
      $$("[data-rstep]", steps).forEach(a => { const k = +a.dataset.rstep; a.className = k === cur ? "cur" : sn.includes(k) ? "seen" : ""; if (k === cur) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current"); });
      const el = phases[cur - 1], locked = !!(el && el.closest("[hidden]")); rd.classList.toggle("curlock", locked);
      const last = cur >= n, isSeen = sn.includes(cur), fin = !!get("lv-done-" + slug);
      doneB.firstChild.textContent = locked ? "On Pro" : last ? (fin ? "Story finished" : "Finish story") : isSeen ? "Phase done" : "Mark phase done";
      doneB.disabled = locked || (last && fin); doneB.classList.toggle("dn", isSeen);
      nextL.textContent = last ? "Checklist" : "Next: " + names[cur]; nextB.setAttribute("aria-label", last ? "Go to the checklist" : "Next phase: " + names[cur]); };
    const show = (k, scroll) => { k = Math.max(1, Math.min(n, k || 1)); cur = k;
      phases.forEach(p => { const on = +p.dataset.ph === k; p.classList.toggle("on", on); if (on) p.open = true; });
      title.textContent = `Phase ${k}: ${names[k - 1]}`; paint();
      if (scroll) (innerWidth <= 720 ? $(".rht") : $("[data-rhero]")).scrollIntoView({behavior: reduce ? "auto" : "smooth", block: "start"}); };
    const fromHash = () => { const m = /^#ph(\d+)$/.exec(location.hash); return m ? +m[1] : 0; };
    const l = get("lv-last"), sn0 = seen();
    show(fromHash() || (l && l.slug === slug && l.ph) || (sn0.length && sn0.length < n ? Math.max(...sn0) + 1 : 1));
    addEventListener("hashchange", () => { const k = fromHash(); if (k) show(k, true); });
    steps.addEventListener("click", e => { const a = e.target.closest("[data-rstep]"); if (!a) return; e.preventDefault(); show(+a.dataset.rstep, innerWidth <= 720); try { history.replaceState(null, "", "#ph" + cur); } catch {} });
    nextB.addEventListener("click", () => { if (cur >= n) { const t = $("#todo"); if (t) t.scrollIntoView({behavior: reduce ? "auto" : "smooth"}); return; } show(cur + 1, true); });
    doneB.addEventListener("click", () => { const sn = seen();
      if (!sn.includes(cur)) { put("lv-seen-" + slug, [...sn, cur].sort((a, b) => a - b)); }
      if (cur >= n) { const m = $("[data-markread]"); if (m && m.getAttribute("aria-pressed") !== "true") m.click(); const d = $("#done"); if (d) d.scrollIntoView({behavior: reduce ? "auto" : "smooth", block: "center"}); paint(); return; }
      put("lv-last", {slug, ph: cur + 1, t: Date.now()}); show(cur + 1, true); });
    addEventListener("lv:changed", paint);
    const lock = $("#locked", rd); if (lock) new MutationObserver(paint).observe(lock, {attributes: true, attributeFilter: ["hidden"]});
  }

  // ---------- upgrade sheet (Paper Upgrade): explains the plans; paying happens on Account > Plans (Stripe checkout lives there) ----------
  const openUpg = () => { let d = $("dialog.upg");
    if (!d) { d = document.createElement("dialog"); d.className = "upg"; d.setAttribute("aria-labelledby", "upgH");
      d.innerHTML = `<form method="dialog"><button class="rbtn x" type="submit" aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h2 id="upgH">Upgrade to Pro</h2><p class="us">Unlock every phase of every breakdown.</p>
        <div class="seg hug" role="group" aria-label="Billing"><button type="button" data-ub="m" aria-pressed="true">Monthly</button><button type="button" data-ub="y" aria-pressed="false">Yearly<em>save up to 20%</em></button></div>
        <label class="upo"><span class="h"><input type="radio" name="up" value="pro" checked>Pro<span class="bd">Recommended</span><b data-up>$7.99</b></span><small data-us>a month, or $6.49 a month billed yearly ($77.88)</small>
          <ul><li>Every breakdown, every phase</li><li>Checklists saved to your account</li><li>Your path saved and updated as stories land</li></ul></label>
        <label class="upo"><span class="h"><input type="radio" name="up" value="lifetime">Lifetime<span class="bd g">Beta only</span><b>$149.99</b></span><small>once, no subscription</small>
          <ul><li>Everything in Pro, for as long as LaunchVault runs</li></ul></label>
        <div class="upn"><b>Under 18? A parent pays.</b>Checkout opens for a parent to pay, and the receipt goes to whoever pays.</div>
        <a class="btn btn-p go" href="${APP}account/#plan" data-ugo>Choose Pro<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 3l4 4-4 4"/></svg></a>
        <p class="fine">You finish on the Plans page. Payments run through Stripe.</p></form>`;
      document.body.appendChild(d);
      d.addEventListener("click", e => { if (e.target === d) d.close();
        const b = e.target.closest("[data-ub]"); if (b) { const y = b.dataset.ub === "y"; $$("[data-ub]", d).forEach(x => x.setAttribute("aria-pressed", x === b));
          $("[data-up]", d).textContent = y ? "$6.49" : "$7.99"; $("[data-us]", d).textContent = y ? "a month, billed yearly ($77.88). Monthly is $7.99" : "a month, or $6.49 a month billed yearly ($77.88)"; } });
      d.addEventListener("change", () => { const v = (d.querySelector("input:checked") || {}).value; $("[data-ugo]", d).firstChild.textContent = v === "lifetime" ? "Choose Lifetime" : "Choose Pro"; }); }
    d.showModal(); };
  document.addEventListener("click", e => { const a = e.target.closest("[data-upg], .avp a"); if (!a || !window.HTMLDialogElement) return;
    const st = ($(".side .plan") || {dataset: {}}).dataset.state; if (st !== "free" || $("#plan")) return;   // paid / judge, or already on Account: the link goes to Plans as usual
    e.preventDefault(); openUpg(); });

  // ---------- Ask: a question typed on Home arrives filled in (not sent) ----------
  { const inp = $("#asIn"), q = new URLSearchParams(location.search).get("q");
    if (inp && q) { inp.value = q.slice(0, 400); inp.dispatchEvent(new Event("input")); try { history.replaceState(null, "", location.pathname); } catch {} } }
  // links inside assistant replies point at the story pages of this app
  document.addEventListener("click", e => { const a = e.target.closest('a[href^="/app/"]'); if (a) a.setAttribute("href", "/new" + a.getAttribute("href")); }, true);

  // ---------- motion: numbers count up once, the chart line draws in ----------
  if (!reduce) {
    const done = new WeakSet();
    const count = el => { if (done.has(el)) return; done.add(el); const to = +el.dataset.count; if (!(to > 0)) return; const t0 = performance.now();
      const f = t => { const p = Math.min(1, (t - t0) / 600), v = Math.round(to * (1 - Math.pow(1 - p, 3))); el.textContent = v; if (p < 1 && el.isConnected) requestAnimationFrame(f); else el.textContent = to; }; requestAnimationFrame(f); };
    const scan = () => $$("[data-count]").forEach(count); scan();
    new MutationObserver(scan).observe(document.body, {childList: true, subtree: true});
    addEventListener("load", () => setTimeout(() => $$(".lvchart .plot svg").forEach(svg => {
      const p = [...svg.querySelectorAll("path")].filter(x => getComputedStyle(x).fill === "none" && x.getTotalLength).sort((a, b) => b.getTotalLength() - a.getTotalLength())[0]; if (!p) return;
      const len = p.getTotalLength(); if (!len || p.getAttribute("stroke-dasharray")) return;
      p.animate([{strokeDasharray: len, strokeDashoffset: len}, {strokeDasharray: len, strokeDashoffset: 0}], {duration: 900, easing: "cubic-bezier(.16,1,.3,1)"}); }), 60));
  }
})();
