/* LaunchVault new dashboard (/app/): the Vault shell's own behaviour, on top of app.js (same lv-* storage keys).
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
  const APP = "/app/";

  // ---------- sidebar: continue where you left off (else this week's story stays, as built) ----------
  const cont = () => { const a = $("[data-sbcont]"), l = get("lv-last"), s = l && S[l.slug]; if (!a) return;
    const x = s && s.status === "ready" && !get("lv-done-" + s.slug) ? s : null, cur = x || S[(a.getAttribute("href").match(/story\/([^/]+)/) || [])[1]]; if (!cur) return;
    const n = cur.phases || 1, k = Math.min(n, arr("lv-seen-" + cur.slug).length);
    if (x) { a.href = `${x.href}${Math.min(n, l.ph || 1)}/`; $("[data-sbcn]", a).textContent = "Continue: " + x.name; const im = $("img", a); if (im && COV[x.slug]) im.src = COV[x.slug]; }
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

  // ---------- upgrade sheet (Paper Upgrade): explains the plans; paying happens on Account > Plans (Stripe checkout lives there) ----------
  const openUpg = () => { let d = $("dialog.upg");
    if (!d) { d = document.createElement("dialog"); d.className = "upg"; d.setAttribute("aria-labelledby", "upgH");
      d.innerHTML = `<form method="dialog"><button class="rbtn x" type="submit" aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h2 id="upgH">Upgrade to Pro</h2><p class="us">Every lesson in every story.</p>
        <div class="seg hug" role="group" aria-label="Billing"><button type="button" data-ub="m" aria-pressed="true">Monthly</button><button type="button" data-ub="y" aria-pressed="false">Yearly<em>save up to 20%</em></button></div>
        <label class="upo"><span class="h"><input type="radio" name="up" value="pro" checked>Pro<span class="bd">Recommended</span><b data-up>$7.99</b></span><small data-us>a month, or $6.49 a month billed yearly ($77.88)</small>
          <ul><li>Every lesson in every story</li><li>Checklists saved to your account</li><li>Your path saved and updated as stories land</li></ul></label>
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

  // Saved on phones: Stories / Steps switch
  document.addEventListener("click", e => { const b = e.target.closest("[data-svf]"); if (!b) return; const pg = b.closest(".svd"); pg.dataset.sv = b.dataset.svf;
    $$("[data-svf]", pg).forEach(x => x.setAttribute("aria-pressed", x === b)); });

  // phone "You": the Sign out row at the bottom is the same button as Privacy and data > Sign out
  document.addEventListener("click", e => { if (e.target.closest("[data-soproxy]")) { const so = $("#so"); if (so) so.click(); } });

  // ---------- Ask: a question typed on Home arrives filled in (not sent) ----------
  { const inp = $("#asIn"), q = new URLSearchParams(location.search).get("q");
    if (inp && q) { inp.value = q.slice(0, 400); inp.dispatchEvent(new Event("input")); try { history.replaceState(null, "", location.pathname); } catch {} } }

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
